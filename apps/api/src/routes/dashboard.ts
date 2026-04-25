import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import type { DashboardStats, AnalysisSummary, TrendsResponse } from "@cr/shared";

const router = Router();

const TrendsQuery = z.object({
  repositoryId: z.string().optional(),
  days: z.coerce.number().int().min(7).max(90).default(30),
});

// GET /api/dashboard/stats
router.get("/stats", requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const [totalRepos, totalAnalyses, user, recentAnalyses, scoreAgg, issueCounts] = await Promise.all([
    prisma.repository.count({ where: { userId } }),
    prisma.analysis.count({ where: { userId } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { plan: true, analysesUsedMtd: true } }),
    prisma.analysis.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { repository: { select: { fullName: true } } },
    }),
    prisma.analysis.aggregate({
      where: { userId, status: "COMPLETED", overallScore: { not: null } },
      _avg: { overallScore: true },
    }),
    prisma.analysis.aggregate({
      where: { userId, status: "COMPLETED" },
      _sum: {
        issuesCritical: true,
        issuesHigh: true,
        issuesMedium: true,
        issuesLow: true,
        issuesInfo: true,
      },
    }),
  ]);

  const sums = issueCounts._sum;
  const totalIssuesFound =
    (sums.issuesCritical ?? 0) +
    (sums.issuesHigh ?? 0) +
    (sums.issuesMedium ?? 0) +
    (sums.issuesLow ?? 0) +
    (sums.issuesInfo ?? 0);

  const body: DashboardStats = {
    totalRepos,
    totalAnalyses,
    totalIssuesFound,
    averageScore: Math.round(scoreAgg._avg.overallScore ?? 0),
    quotaUsed: user.analysesUsedMtd,
    quotaLimit: user.plan === "FREE" ? 3 : -1,
    recentAnalyses: recentAnalyses.map(toSummary),
  };

  res.json(body);
});

// GET /api/dashboard/trends
router.get("/trends", requireAuth, async (req: Request, res: Response) => {
  const query = TrendsQuery.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "bad_request", message: "Invalid query params" });
    return;
  }

  const { repositoryId, days } = query.data;
  const userId = req.user!.id;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const analyses = await prisma.analysis.findMany({
    where: {
      userId,
      status: "COMPLETED",
      createdAt: { gte: since },
      ...(repositoryId ? { repositoryId } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: {
      createdAt: true,
      overallScore: true,
      issuesCritical: true,
      issuesHigh: true,
      issuesMedium: true,
      issuesLow: true,
      issuesInfo: true,
    },
  });

  const body: TrendsResponse = {
    points: analyses.map((a) => ({
      date: a.createdAt.toISOString().slice(0, 10),
      score: a.overallScore ?? 0,
      issuesTotal:
        a.issuesCritical + a.issuesHigh + a.issuesMedium + a.issuesLow + a.issuesInfo,
    })),
  };

  res.json(body);
});

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
