import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { GitHubService, GitHubRateLimitError } from "../services/github.js";
import { ListReposQuery } from "../schemas/requests.js";
import type { ReposResponse, RepoSummary, SyncResponse } from "@cr/shared";

const router = Router();

// GET /api/repos
router.get("/", requireAuth, async (req: Request, res: Response) => {
  const query = ListReposQuery.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "bad_request", message: "Invalid query params", details: query.error.flatten() });
    return;
  }

  const { q, page, limit, sort } = query.data;
  const userId = req.user!.id;

  const where = {
    userId,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { fullName: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [repos, total] = await Promise.all([
    prisma.repository.findMany({
      where,
      orderBy: sort === "name" ? { name: "asc" } : { pushedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        analyses: {
          where: { status: "COMPLETED" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, overallScore: true, createdAt: true },
        },
      },
    }),
    prisma.repository.count({ where }),
  ]);

  const body: ReposResponse = {
    repos: repos.map((r) => mapRepo(r)),
    total,
    page,
    limit,
  };

  res.json(body);
});

// POST /api/repos/sync
router.post("/sync", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;

  // Per-user rate limit: 1/min
  const rlKey = `rl:repos:sync:${userId}`;
  const count = await redis.incr(rlKey);
  if (count === 1) await redis.expire(rlKey, 60);
  if (count > 1) {
    res.status(429).json({ error: "rate_limited", message: "Sync allowed once per minute" });
    return;
  }

  let gh: GitHubService;
  try {
    gh = await GitHubService.forUser(userId);
  } catch {
    res.status(401).json({ error: "github_token_expired", message: "GitHub token invalid — please re-authenticate" });
    return;
  }

  let ghRepos;
  try {
    ghRepos = await gh.listRepos();
  } catch (err) {
    if (err instanceof GitHubRateLimitError) {
      res.status(429).json({ error: "github_rate_limited", message: "GitHub API rate limit reached" });
      return;
    }
    throw err;
  }

  let added = 0;
  let updated = 0;

  for (const repo of ghRepos) {
    const existing = await prisma.repository.findUnique({
      where: { userId_githubId: { userId, githubId: repo.githubId } },
      select: { id: true },
    });

    await prisma.repository.upsert({
      where: { userId_githubId: { userId, githubId: repo.githubId } },
      create: {
        userId,
        githubId: repo.githubId,
        fullName: repo.fullName,
        name: repo.name,
        description: repo.description,
        private: repo.private,
        defaultBranch: repo.defaultBranch,
        language: repo.language,
        htmlUrl: repo.htmlUrl,
        starsCount: repo.starsCount,
        pushedAt: repo.pushedAt ? new Date(repo.pushedAt) : null,
      },
      update: {
        fullName: repo.fullName,
        name: repo.name,
        description: repo.description,
        private: repo.private,
        defaultBranch: repo.defaultBranch,
        language: repo.language,
        htmlUrl: repo.htmlUrl,
        starsCount: repo.starsCount,
        pushedAt: repo.pushedAt ? new Date(repo.pushedAt) : null,
      },
    });

    if (existing) updated++;
    else added++;
  }

  const total = await prisma.repository.count({ where: { userId } });
  const body: SyncResponse = { added, updated, total };
  res.json(body);
});

// GET /api/repos/:id
router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const id = String(req.params.id);
  const repo = await prisma.repository.findUnique({
    where: { id },
    include: {
      analyses: {
        where: { status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, overallScore: true, createdAt: true },
      },
    },
  });

  if (!repo) {
    res.status(404).json({ error: "not_found", message: "Repository not found" });
    return;
  }

  if (repo.userId !== userId) {
    res.status(403).json({ error: "forbidden", message: "Access denied" });
    return;
  }

  const analyses = await prisma.analysis.findMany({
    where: { repositoryId: repo.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      status: true,
      progress: true,
      overallScore: true,
      issuesCritical: true,
      issuesHigh: true,
      issuesMedium: true,
      issuesLow: true,
      issuesInfo: true,
      filesAnalyzed: true,
      createdAt: true,
      completedAt: true,
      repository: { select: { fullName: true } },
    },
  });

  res.json({
    ...mapRepo(repo),
    analyses: analyses.map((a) => ({
      id: a.id,
      repositoryId: repo.id,
      repositoryFullName: repo.fullName,
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
    })),
  });
});

function mapRepo(r: {
  id: string;
  fullName: string;
  name: string;
  description: string | null;
  private: boolean;
  language: string | null;
  starsCount: number;
  pushedAt: Date | null;
  htmlUrl: string;
  analyses: { id: string; overallScore: number | null; createdAt: Date }[];
}): RepoSummary {
  const last = r.analyses[0] ?? null;
  return {
    id: r.id,
    fullName: r.fullName,
    name: r.name,
    description: r.description,
    private: r.private,
    language: r.language,
    starsCount: r.starsCount,
    pushedAt: r.pushedAt?.toISOString() ?? null,
    htmlUrl: r.htmlUrl,
    lastAnalysis: last
      ? { id: last.id, score: last.overallScore ?? 0, createdAt: last.createdAt.toISOString() }
      : null,
  };
}

export default router;
