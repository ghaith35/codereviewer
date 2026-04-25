import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { GitBranch, Lock, Globe, Star, ExternalLink, Play } from "lucide-react";
import { api } from "../lib/api.js";
import { PageSkeleton } from "../components/PageSkeleton.js";
import type { RepoSummary, AnalysisSummary, StartAnalysisResponse } from "@cr/shared";

type RepoDetail = RepoSummary & { analyses: AnalysisSummary[] };

function statusBadge(status: string) {
  const map: Record<string, string> = {
    COMPLETED: "bg-emerald-950 text-emerald-400",
    FAILED: "bg-red-950 text-red-400",
    QUEUED: "bg-zinc-800 text-zinc-400",
    FETCHING_FILES: "bg-blue-950 text-blue-400",
    RUNNING_STATIC: "bg-blue-950 text-blue-400",
    RUNNING_AI: "bg-purple-950 text-purple-400",
    GENERATING_REPORT: "bg-amber-950 text-amber-400",
  };
  return map[status] ?? "bg-zinc-800 text-zinc-400";
}

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

export function RepositoryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [startError, setStartError] = useState<string | null>(null);

  const { data: repo, isLoading, isError } = useQuery<RepoDetail>({
    queryKey: ["repo", id],
    queryFn: () => api.get<RepoDetail>(`/repos/${id}`),
    enabled: !!id,
  });

  const startMutation = useMutation<StartAnalysisResponse, Error, { repositoryId: string }>({
    mutationFn: (body) => api.post<StartAnalysisResponse>("/analyses", body),
    onSuccess: (data) => navigate(`/analyses/${data.analysisId}`),
    onError: (err) => setStartError((err as { message?: string }).message ?? "Failed to start"),
  });

  if (isLoading) return <PageSkeleton />;
  if (isError || !repo) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400">Repository not found.</p>
          <Link to="/dashboard" className="mt-4 inline-block text-sm text-zinc-500 hover:text-zinc-300">
            ← Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const hasInProgress = repo.analyses.some((a) =>
    ["QUEUED", "FETCHING_FILES", "RUNNING_STATIC", "RUNNING_AI", "GENERATING_REPORT"].includes(a.status)
  );

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-zinc-500">
          <Link to="/dashboard" className="transition hover:text-zinc-300">Dashboard</Link>
          <span>/</span>
          <span className="text-zinc-300">{repo.name}</span>
        </div>

        {/* Repo header */}
        <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                {repo.private ? (
                  <Lock className="h-4 w-4 text-zinc-500" />
                ) : (
                  <Globe className="h-4 w-4 text-zinc-600" />
                )}
                <h1 className="text-xl font-bold text-white">{repo.fullName}</h1>
                <a
                  href={repo.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-500 transition hover:text-zinc-300"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
              {repo.description && (
                <p className="mt-2 text-sm text-zinc-400">{repo.description}</p>
              )}
              <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
                {repo.language && (
                  <span className="rounded bg-zinc-800 px-2 py-0.5">{repo.language}</span>
                )}
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3" /> {repo.starsCount}
                </span>
                {repo.pushedAt && (
                  <span className="flex items-center gap-1">
                    <GitBranch className="h-3 w-3" />
                    Pushed {new Date(repo.pushedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => {
                setStartError(null);
                startMutation.mutate({ repositoryId: repo.id });
              }}
              disabled={startMutation.isPending || hasInProgress}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              {startMutation.isPending ? "Starting…" : hasInProgress ? "In Progress" : "Start Analysis"}
            </button>
          </div>

          {startError && (
            <div className="mt-4 rounded-lg bg-red-950 px-4 py-2 text-sm text-red-400">
              {startError}
            </div>
          )}
        </div>

        {/* Analysis history */}
        <div>
          <h2 className="mb-4 font-semibold text-white">Analysis History</h2>
          {repo.analyses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center text-zinc-600">
              No analyses yet. Start one above.
            </div>
          ) : (
            <div className="space-y-2">
              {repo.analyses.map((a) => (
                <Link
                  key={a.id}
                  to={a.status === "COMPLETED" ? `/analyses/${a.id}/report` : `/analyses/${a.id}`}
                  className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4 transition hover:border-zinc-700"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(a.status)}`}>
                        {a.status}
                      </span>
                      <span className="text-sm text-zinc-400">
                        {new Date(a.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {a.status === "COMPLETED" && (
                      <div className="mt-1 text-xs text-zinc-500">
                        {a.filesAnalyzed} files · {a.issuesCritical + a.issuesHigh + a.issuesMedium + a.issuesLow + a.issuesInfo} issues
                      </div>
                    )}
                  </div>
                  {a.status === "COMPLETED" && a.overallScore != null && (
                    <div className={`text-xl font-bold ${scoreColor(a.overallScore)}`}>
                      {a.overallScore}
                    </div>
                  )}
                  {a.status !== "COMPLETED" && a.status !== "FAILED" && (
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${a.progress}%` }}
                      />
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
