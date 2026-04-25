import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut, RefreshCw, Star, Lock, Globe, Settings, ChevronRight } from "lucide-react";
import { useMe } from "../hooks/useMe.js";
import { api } from "../lib/api.js";
import { PageSkeleton } from "../components/PageSkeleton.js";
import type { DashboardStats, ReposResponse, RepoSummary, SyncResponse } from "@cr/shared";

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

function RepoCard({ repo }: { repo: RepoSummary }) {
  return (
    <Link
      to={`/repos/${repo.id}`}
      className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition-colors hover:border-zinc-700"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {repo.private ? (
              <Lock className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            ) : (
              <Globe className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
            )}
            <span className="truncate font-medium text-white">{repo.name}</span>
          </div>
          {repo.description && (
            <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{repo.description}</p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-700" />
      </div>

      <div className="flex items-center justify-between text-xs text-zinc-500">
        <div className="flex items-center gap-3">
          {repo.language && (
            <span className="rounded bg-zinc-800 px-1.5 py-0.5">{repo.language}</span>
          )}
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3" /> {repo.starsCount}
          </span>
        </div>
        {repo.lastAnalysis ? (
          <span className={`font-medium ${scoreColor(repo.lastAnalysis.score)}`}>
            {repo.lastAnalysis.score}/100
          </span>
        ) : (
          <span className="text-zinc-600">No analysis</span>
        )}
      </div>
    </Link>
  );
}

export function DashboardPage() {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard/stats"],
    queryFn: () => api.get<DashboardStats>("/dashboard/stats"),
    staleTime: 30_000,
  });

  const { data: reposData, isLoading: reposLoading } = useQuery<ReposResponse>({
    queryKey: ["repos"],
    queryFn: () => api.get<ReposResponse>("/repos?limit=30"),
    staleTime: 30_000,
  });

  const syncMutation = useMutation<SyncResponse>({
    mutationFn: () => api.post<SyncResponse>("/repos/sync"),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["repos"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard/stats"] });
      setSyncMsg(`Synced — added ${data.added}, updated ${data.updated}`);
      setTimeout(() => setSyncMsg(null), 4000);
    },
  });

  async function logout() {
    await api.post("/auth/logout");
    queryClient.clear();
    navigate("/");
  }

  if (statsLoading || reposLoading) return <PageSkeleton />;

  const quotaUsed = stats?.quotaUsed ?? 0;
  const quotaLimit = stats?.quotaLimit ?? 3;
  const quotaPct = quotaLimit > 0 ? Math.min(100, (quotaUsed / quotaLimit) * 100) : 0;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-4">
          <h1 className="text-lg font-bold text-white">CodeReviewer</h1>
          <div className="flex items-center gap-3">
            {me?.avatarUrl && (
              <img src={me.avatarUrl} alt={me.githubLogin} className="h-7 w-7 rounded-full" />
            )}
            <span className="hidden text-sm text-zinc-400 sm:block">{me?.githubLogin}</span>
            <button
              onClick={() => navigate("/settings")}
              className="rounded-md p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-8 py-8">
        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Repositories", value: stats?.totalRepos ?? 0 },
            { label: "Analyses", value: stats?.totalAnalyses ?? 0 },
            { label: "Avg Score", value: stats ? `${stats.averageScore}/100` : "—" },
            {
              label: quotaLimit > 0 ? `Quota (${quotaUsed}/${quotaLimit})` : "Quota",
              value: quotaLimit > 0 ? `${quotaUsed}/${quotaLimit}` : "∞",
              extra: quotaLimit > 0 && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className={`h-full rounded-full transition-all ${quotaPct > 80 ? "bg-red-500" : "bg-emerald-500"}`}
                    style={{ width: `${quotaPct}%` }}
                  />
                </div>
              ),
            },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="text-xs text-zinc-500">{s.label}</div>
              <div className="mt-1 text-2xl font-bold text-white">{s.value}</div>
              {s.extra}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Repos grid */}
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-white">Repositories</h2>
              <button
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`}
                />
                Sync repos
              </button>
            </div>

            {syncMsg && (
              <div className="mb-3 rounded-lg bg-emerald-950 px-4 py-2 text-sm text-emerald-400 ring-1 ring-emerald-800">
                {syncMsg}
              </div>
            )}

            {syncMutation.isError && (
              <div className="mb-3 rounded-lg bg-red-950 px-4 py-2 text-sm text-red-400 ring-1 ring-red-900">
                Sync failed. You can only sync once per minute.
              </div>
            )}

            {reposData?.repos.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-800 p-12 text-center text-zinc-600">
                No repos yet. Click "Sync repos" to import from GitHub.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {reposData?.repos.map((repo) => <RepoCard key={repo.id} repo={repo} />)}
              </div>
            )}
          </div>

          {/* Recent analyses */}
          <div>
            <h2 className="mb-4 font-semibold text-white">Recent Analyses</h2>
            {stats?.recentAnalyses.length === 0 ? (
              <p className="text-sm text-zinc-600">No analyses yet.</p>
            ) : (
              <div className="space-y-2">
                {stats?.recentAnalyses.map((a) => (
                  <Link
                    key={a.id}
                    to={a.status === "COMPLETED" ? `/analyses/${a.id}/report` : `/analyses/${a.id}`}
                    className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 transition hover:border-zinc-700"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white">
                        {a.repositoryFullName}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {new Date(a.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="shrink-0 pl-3">
                      {a.status === "COMPLETED" && a.overallScore != null ? (
                        <span className={`text-sm font-bold ${scoreColor(a.overallScore)}`}>
                          {a.overallScore}
                        </span>
                      ) : (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            a.status === "FAILED"
                              ? "bg-red-950 text-red-400"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {a.status}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
