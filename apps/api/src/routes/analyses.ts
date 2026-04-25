import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma.js";
import { redis, redisSub } from "../lib/redis.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { analyzeQueue } from "../workers/queue.js";
import { ListAnalysesQuery, ListIssuesQuery } from "../schemas/requests.js";
import { canStartAnalysis, canAnalyzePrivateRepo } from "../lib/plan.js";
import { StartAnalysisSchema } from "@cr/shared";
import type { AnalysisSummary, AnalysisDetail, AnalysesResponse } from "@cr/shared";

const router = Router();

// POST /api/analyses — start a new analysis
router.post("/", requireAuth, async (req: Request, res: Response) => {
  const parsed = StartAnalysisSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", message: "Invalid body", details: parsed.error.flatten() });
    return;
  }

  const { repositoryId, branch } = parsed.data;
  const userId = req.user!.id;

  // Per-user rate limit: 20/hour
  const rlKey = `rl:analyses:${userId}`;
  const count = await redis.incr(rlKey);
  if (count === 1) await redis.expire(rlKey, 3600);
  if (count > 20) {
    res.status(429).json({ error: "rate_limited", message: "Too many analyses — limit 20/hour" });
    return;
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const quota = canStartAnalysis(user);
  if (!quota.ok) {
    res.status(402).json({ error: "quota_exceeded", message: "Free plan limited to 3 analyses/month" });
    return;
  }

  const repo = await prisma.repository.findFirst({ where: { id: repositoryId, userId } });
  if (!repo) {
    res.status(404).json({ error: "repo_not_found", message: "Repository not found" });
    return;
  }

  if (repo.private && !canAnalyzePrivateRepo(user)) {
    res.status(403).json({ error: "private_repo_requires_pro", message: "Private repo analysis requires Pro" });
    return;
  }

  const inProgress = await prisma.analysis.findFirst({
    where: {
      repositoryId,
      status: { in: ["QUEUED", "FETCHING_FILES", "RUNNING_STATIC", "RUNNING_AI", "GENERATING_REPORT"] },
    },
  });
  if (inProgress) {
    res.status(409).json({ error: "analysis_in_progress", message: "Another analysis is already running for this repo" });
    return;
  }

  const analysis = await prisma.analysis.create({
    data: {
      userId,
      repositoryId,
      branch: branch ?? repo.defaultBranch,
      status: "QUEUED",
    },
  });

  const job = await analyzeQueue.add(
    "analyze",
    { analysisId: analysis.id, userId, repositoryId, branch: analysis.branch },
    { jobId: `analysis:${analysis.id}` }
  );

  await prisma.analysis.update({ where: { id: analysis.id }, data: { jobId: job.id } });
  await prisma.user.update({ where: { id: userId }, data: { analysesUsedMtd: { increment: 1 } } });

  const queuePosition = await analyzeQueue.getWaitingCount();
  res.status(202).json({ analysisId: analysis.id, queuePosition });
});

// GET /api/analyses
router.get("/", requireAuth, async (req: Request, res: Response) => {
  const query = ListAnalysesQuery.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "bad_request", message: "Invalid query params" });
    return;
  }

  const { repositoryId, status, page, limit } = query.data;
  const userId = req.user!.id;

  const where = {
    userId,
    ...(repositoryId ? { repositoryId } : {}),
    ...(status ? { status: status as any } : {}),
  };

  const [analyses, total] = await Promise.all([
    prisma.analysis.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { repository: { select: { fullName: true } } },
    }),
    prisma.analysis.count({ where }),
  ]);

  const body: AnalysesResponse = {
    analyses: analyses.map(toSummary),
    total,
  };

  res.json(body);
});

// GET /api/analyses/:id
router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const id = String(req.params.id);
  const analysis = await prisma.analysis.findUnique({
    where: { id },
    include: { repository: { select: { fullName: true } } },
  });

  if (!analysis) {
    res.status(404).json({ error: "not_found", message: "Analysis not found" });
    return;
  }

  if (analysis.userId !== userId) {
    res.status(403).json({ error: "forbidden", message: "Access denied" });
    return;
  }

  const body: AnalysisDetail = {
    ...toSummary(analysis),
    commitSha: analysis.commitSha,
    durationMs: analysis.durationMs,
    errorMessage: analysis.errorMessage,
    securityScore: analysis.securityScore,
    performanceScore: analysis.performanceScore,
    qualityScore: analysis.qualityScore,
    branch: analysis.branch,
  };

  res.json(body);
});

// GET /api/analyses/:id/issues
router.get("/:id/issues", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const id = String(req.params.id);
  const query = ListIssuesQuery.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "bad_request", message: "Invalid query params" });
    return;
  }

  const analysis = await prisma.analysis.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!analysis) {
    res.status(404).json({ error: "not_found", message: "Analysis not found" });
    return;
  }

  if (analysis.userId !== userId) {
    res.status(403).json({ error: "forbidden", message: "Access denied" });
    return;
  }

  const { severity, category, filePath, page, limit } = query.data;

  const where = {
    analysisId: id,
    ...(severity ? { severity: severity as any } : {}),
    ...(category ? { category: category as any } : {}),
    ...(filePath ? { filePath: { contains: filePath } } : {}),
  };

  const [issues, total] = await Promise.all([
    prisma.issue.findMany({
      where,
      orderBy: [{ severity: "asc" }, { lineStart: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.issue.count({ where }),
  ]);

  res.json({ issues, total });
});

// GET /api/analyses/:id/report — client-side PDF for MVP, stub for server-side
router.get("/:id/report", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const id = String(req.params.id);
  const analysis = await prisma.analysis.findUnique({
    where: { id },
    select: { userId: true, status: true },
  });

  if (!analysis) {
    res.status(404).json({ error: "not_found", message: "Analysis not found" });
    return;
  }

  if (analysis.userId !== userId) {
    res.status(403).json({ error: "forbidden", message: "Access denied" });
    return;
  }

  if (analysis.status !== "COMPLETED") {
    res.status(409).json({ error: "analysis_not_complete", message: "Analysis is not yet complete" });
    return;
  }

  // PDF is generated client-side for MVP. Server-side PDF is Pro-only (post-MVP).
  res.status(501).json({ error: "not_implemented", message: "Server-side PDF coming soon — use client-side export" });
});

// GET /api/analyses/:id/status — SSE stream
router.get("/:id/status", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const analysisId = String(req.params.id);

  const analysis = await prisma.analysis.findFirst({
    where: { id: analysisId, userId },
    select: { id: true, status: true, progress: true },
  });

  if (!analysis) {
    res.status(404).json({ error: "not_found", message: "Analysis not found" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });

  sendEvent(res, "status", { status: analysis.status, progress: analysis.progress });

  if (analysis.status === "COMPLETED" || analysis.status === "FAILED") {
    sendEvent(res, analysis.status === "COMPLETED" ? "completed" : "error", { analysisId });
    res.end();
    return;
  }

  const channel = `analysis:${analysisId}`;
  const subscriber = redisSub.duplicate();
  await subscriber.subscribe(channel);

  subscriber.on("message", (_chan, payload) => {
    try {
      const { event, data } = JSON.parse(payload) as { event: string; data: unknown };
      sendEvent(res, event, data);
      if (event === "completed" || event === "error") {
        subscriber.quit();
        res.end();
      }
    } catch {
      // ignore malformed messages
    }
  });

  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 20_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    subscriber.quit();
  });
});

function sendEvent(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function toSummary(a: {
  id: string;
  repositoryId: string;
  status: any;
  progress: number;
  overallScore: number | null;
  issuesCritical: number;
  issuesHigh: number;
  issuesMedium: number;
  issuesLow: number;
  issuesInfo: number;
  filesAnalyzed: number;
  createdAt: Date;
  completedAt: Date | null;
  repository: { fullName: string };
}): AnalysisSummary {
  return {
    id: a.id,
    repositoryId: a.repositoryId,
    repositoryFullName: a.repository.fullName,
    status: a.status,
    progress: a.progress,
    overallScore: a.overallScore,
    issuesCritical: a.issuesCritical,
    issuesHigh: a.issuesHigh,
    issuesMedium: a.issuesMedium,
    issuesLow: a.issuesLow,
    issuesInfo: a.issuesInfo,
    filesAnalyzed: a.filesAnalyzed,
    createdAt: a.createdAt.toISOString(),
    completedAt: a.completedAt?.toISOString() ?? null,
  };
}

export default router;
