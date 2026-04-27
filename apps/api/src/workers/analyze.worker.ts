import { Worker, type Job } from "bullmq";
import pLimit from "p-limit";
import { prisma } from "../lib/prisma.js";
import { redis, redisPub } from "../lib/redis.js";
import { GitHubService, SUPPORTED_EXTENSIONS } from "../services/github.js";
import { runESLint } from "../services/analyzers/eslint.js";
import { runPylint } from "../services/analyzers/pylint.js";
import { runSemgrep } from "../services/analyzers/semgrep.js";
import { runGemini } from "../services/analyzers/gemini.js";
import { calculateScores } from "../services/score.js";
import type { AnalyzeJobData, AnalyzeJobResult } from "@cr/shared";
import type { AnalysisStatus } from "@prisma/client";

let analyzeWorker: Worker<AnalyzeJobData | Record<string, never>, AnalyzeJobResult | void> | null = null;

async function handleFailedJob(
  job: Job<AnalyzeJobData | Record<string, never>, AnalyzeJobResult | void> | undefined,
  err: Error
) {
  if (!job) return;
  const analysisId = (job.data as Partial<AnalyzeJobData>).analysisId;
  if (!analysisId) {
    console.error(`[worker] ${job.name} failed`, err);
    return;
  }

  await prisma.analysis
    .update({
      where: { id: analysisId },
      data: { status: "FAILED", errorMessage: err.message, completedAt: new Date() },
    })
    .catch(() => {});
  await pushStatus(analysisId, "error", { message: err.message });
}

async function processAnalysis(job: Job<AnalyzeJobData>): Promise<AnalyzeJobResult> {
  const { analysisId, userId, repositoryId, branch } = job.data;
  const startedAt = Date.now();

  const report = async (
    status: AnalysisStatus,
    progress: number,
    extra: Record<string, unknown> = {}
  ) => {
    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status,
        progress,
        ...(status === "FETCHING_FILES" ? { startedAt: new Date() } : {}),
      },
    });
    await pushStatus(analysisId, "progress", { status, progress, ...extra });
  };

  // ── Stage 1: Fetch files ──
  await report("FETCHING_FILES", 5);
  const repo = await prisma.repository.findUniqueOrThrow({ where: { id: repositoryId } });
  const [owner, repoName] = repo.fullName.split("/");
  const github = await GitHubService.forUser(userId);

  // Check rate limit before bulk-fetching blobs
  const rl = await github.getRateLimit();
  const tree = await github.getFileTree(owner, repoName, branch);
  const { keep, skipped } = github.filterFiles(tree);

  if (rl.remaining < keep.length) {
    const waitMs = rl.resetAt.getTime() - Date.now() + 5000;
    if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
  }

  await report("FETCHING_FILES", 15, { totalFiles: keep.length });

  // Download file contents with concurrency cap
  const fetchLimit = pLimit(6);
  const files: Array<{
    path: string;
    content: string;
    language: string;
    sizeBytes: number;
    linesOfCode: number;
  }> = [];

  await Promise.all(
    keep.map((entry) =>
      fetchLimit(async () => {
        const content = await github.getFileContent(owner, repoName, entry.sha);
        if (content === null) return;
        const ext = entry.path.slice(entry.path.lastIndexOf(".")).toLowerCase();
        const language = SUPPORTED_EXTENSIONS[ext] ?? "unknown";
        files.push({
          path: entry.path,
          content,
          language,
          sizeBytes: entry.size,
          linesOfCode: content.split("\n").length,
        });
      })
    )
  );

  // Persist analysis_files rows
  await prisma.analysisFile.createMany({
    data: [
      ...files.map((f) => ({
        analysisId,
        path: f.path,
        language: f.language,
        sizeBytes: f.sizeBytes,
        linesOfCode: f.linesOfCode,
        skipped: false,
      })),
      ...skipped.map((s) => ({
        analysisId,
        path: s.path,
        language: "unknown",
        sizeBytes: 0,
        linesOfCode: 0,
        skipped: true,
        skipReason: s.reason,
      })),
    ],
  });

  await report("RUNNING_STATIC", 30, { filesFetched: files.length });

  // ── Stage 2: Static analysis (parallel) ──
  const jsFiles = files.filter(
    (f) => f.language === "javascript" || f.language === "typescript"
  );
  const pyFiles = files.filter((f) => f.language === "python");

  const [eslintIssues, pylintIssues, semgrepIssues] = await Promise.all([
    jsFiles.length ? runESLint(jsFiles) : [],
    pyFiles.length ? runPylint(pyFiles) : [],
    runSemgrep(files),
  ]);

  await report("RUNNING_STATIC", 55, {
    staticIssues: eslintIssues.length + pylintIssues.length + semgrepIssues.length,
  });

  // ── Stage 3: Gemini AI review ──
  await report("RUNNING_AI", 60);
  const aiIssues = await runGemini(files, (pct) =>
    pushStatus(analysisId, "progress", {
      status: "RUNNING_AI",
      progress: 60 + Math.floor(pct * 30),
    })
  );
  await report("GENERATING_REPORT", 92);

  // ── Stage 4: Aggregate + score ──
  const allIssues = [...eslintIssues, ...pylintIssues, ...semgrepIssues, ...aiIssues];
  const scores = calculateScores(allIssues, files.length);

  // ── Stage 5: Persist in a transaction ──
  await prisma.$transaction([
    prisma.issue.createMany({ data: allIssues.map((i) => ({ ...i, analysisId })) }),
    prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: "COMPLETED",
        progress: 100,
        completedAt: new Date(),
        durationMs: Date.now() - startedAt,
        filesAnalyzed: files.length,
        overallScore: scores.overall,
        securityScore: scores.security,
        performanceScore: scores.performance,
        qualityScore: scores.quality,
        issuesCritical: allIssues.filter((i) => i.severity === "CRITICAL").length,
        issuesHigh: allIssues.filter((i) => i.severity === "HIGH").length,
        issuesMedium: allIssues.filter((i) => i.severity === "MEDIUM").length,
        issuesLow: allIssues.filter((i) => i.severity === "LOW").length,
        issuesInfo: allIssues.filter((i) => i.severity === "INFO").length,
      },
    }),
  ]);

  await pushStatus(analysisId, "completed", { analysisId, overallScore: scores.overall });

  const durationMs = Date.now() - startedAt;
  return { analysisId, overallScore: scores.overall, totalIssues: allIssues.length, durationMs };
}

async function handleQuotaReset() {
  const result = await prisma.user.updateMany({
    data: { analysesUsedMtd: 0 },
  });
  console.log(`[worker] monthly quota reset — cleared ${result.count} users`);
}

async function pushStatus(analysisId: string, event: string, data: unknown) {
  await redisPub.publish(`analysis:${analysisId}`, JSON.stringify({ event, data }));
}

export function startWorker() {
  if (analyzeWorker) return analyzeWorker;

  analyzeWorker = new Worker<AnalyzeJobData | Record<string, never>, AnalyzeJobResult | void>(
    "analyze",
    async (job) => {
      if (job.name === "monthly-quota-reset") return handleQuotaReset();
      return processAnalysis(job as Job<AnalyzeJobData>);
    },
    {
      connection: redis,
      concurrency: 2,
      lockDuration: 300_000,
      stalledInterval: 30_000,
    }
  );

  analyzeWorker.on("failed", handleFailedJob);
  analyzeWorker.on("error", (err) => {
    console.error("[worker] error", err);
  });

  console.log("[worker] analyze ready");
  return analyzeWorker;
}
