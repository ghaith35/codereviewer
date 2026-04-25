import type { AnalysisStatus } from "./analysis.js";

export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}

export interface MeResponse {
  id: string;
  githubLogin: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  plan: "FREE" | "PRO";
  analysesUsedMtd: number;
  analysesQuota: number;
}

export interface RepoSummary {
  id: string;
  fullName: string;
  name: string;
  description: string | null;
  private: boolean;
  language: string | null;
  starsCount: number;
  pushedAt: string | null;
  htmlUrl: string;
  lastAnalysis: { id: string; score: number; createdAt: string } | null;
}

export interface ReposResponse {
  repos: RepoSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface SyncResponse {
  added: number;
  updated: number;
  total: number;
}

export interface StartAnalysisBody {
  repositoryId: string;
  branch?: string;
}

export interface StartAnalysisResponse {
  analysisId: string;
  queuePosition: number;
}

export interface AnalysisSummary {
  id: string;
  repositoryId: string;
  repositoryFullName: string;
  status: AnalysisStatus;
  progress: number;
  overallScore: number | null;
  issuesCritical: number;
  issuesHigh: number;
  issuesMedium: number;
  issuesLow: number;
  issuesInfo: number;
  filesAnalyzed: number;
  createdAt: string;
  completedAt: string | null;
}

export interface AnalysisDetail extends AnalysisSummary {
  commitSha: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  securityScore: number | null;
  performanceScore: number | null;
  qualityScore: number | null;
  branch: string;
}

export interface AnalysesResponse {
  analyses: AnalysisSummary[];
  total: number;
}

export interface DashboardStats {
  totalRepos: number;
  totalAnalyses: number;
  totalIssuesFound: number;
  averageScore: number;
  quotaUsed: number;
  quotaLimit: number;
  recentAnalyses: AnalysisSummary[];
}

export interface TrendPoint {
  date: string;
  score: number;
  issuesTotal: number;
}

export interface TrendsResponse {
  points: TrendPoint[];
}
