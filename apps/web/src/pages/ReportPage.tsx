import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../lib/api.js";
import { ScoreGauge } from "../components/ScoreGauge.js";
import { IssueCard } from "../components/IssueCard.js";
import { IssueSeverityBadge } from "../components/IssueSeverityBadge.js";
import { PageSkeleton } from "../components/PageSkeleton.js";
import { ReportPDF } from "../pdf/ReportPDF.js";
import { downloadPDF } from "../services/pdf.js";
import type { AnalysisDetail, Issue, IssueSeverity } from "@cr/shared";

interface IssuesResponse {
  issues: Issue[];
  total: number;
}

const SEVERITIES: (IssueSeverity | "ALL")[] = ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

export function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const [severity, setSeverity] = useState<IssueSeverity | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [pdfLoading, setPdfLoading] = useState(false);
  const limit = 25;

  const { data: analysis, isLoading: analysisLoading } = useQuery<AnalysisDetail>({
    queryKey: ["analysis", id],
    queryFn: () => api.get<AnalysisDetail>(`/analyses/${id}`),
    enabled: !!id,
  });

  const issuesQuery = useQuery<IssuesResponse>({
    queryKey: ["issues", id, severity, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (severity !== "ALL") params.set("severity", severity);
      return api.get<IssuesResponse>(`/analyses/${id}/issues?${params}`);
    },
    enabled: !!id && analysis?.status === "COMPLETED",
    staleTime: 60_000,
  });

  async function handleDownloadPDF() {
    if (!analysis) return;
    setPdfLoading(true);
    try {
      const allIssues = await api.get<IssuesResponse>(`/analyses/${id}/issues?limit=1000`);
      const filename = `${analysis.repositoryFullName.replace("/", "-")}-review.pdf`;
      await downloadPDF(<ReportPDF analysis={analysis} issues={allIssues.issues} />, filename);
    } finally {
      setPdfLoading(false);
    }
  }

  if (analysisLoading || !analysis) return <PageSkeleton />;

  if (analysis.status !== "COMPLETED") {
    return (
      <div className="flex min-h-screen items-center justify-center text-zinc-400">
        Analysis is not yet complete.{" "}
        <Link to={`/analyses/${id}`} className="ml-2 underline">
          View progress
        </Link>
      </div>
    );
  }

  const totalPages = Math.ceil((issuesQuery.data?.total ?? 0) / limit);
  const totalIssues =
    (analysis.issuesCritical ?? 0) +
    (analysis.issuesHigh ?? 0) +
    (analysis.issuesMedium ?? 0) +
    (analysis.issuesLow ?? 0) +
    (analysis.issuesInfo ?? 0);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950 px-8 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to={`/repos/${analysis.repositoryId}`} className="text-zinc-500 transition hover:text-zinc-300">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="font-semibold text-white">{analysis.repositoryFullName}</h1>
              <p className="text-xs text-zinc-500">
                Analyzed {new Date(analysis.createdAt).toLocaleString()} · Branch:{" "}
                {analysis.branch}
              </p>
            </div>
          </div>
          <button
            onClick={handleDownloadPDF}
            disabled={pdfLoading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {pdfLoading ? "Preparing…" : "Export PDF"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-8 py-8">
        {/* Score breakdown */}
        <section className="mb-10">
          <h2 className="mb-6 font-semibold text-white">Score Breakdown</h2>
          <div className="flex flex-wrap justify-around gap-6 rounded-xl border border-zinc-800 bg-zinc-900 py-8">
            <ScoreGauge score={analysis.overallScore ?? 0} label="Overall" />
            <ScoreGauge score={analysis.securityScore ?? 0} label="Security" />
            <ScoreGauge score={analysis.performanceScore ?? 0} label="Performance" />
            <ScoreGauge score={analysis.qualityScore ?? 0} label="Quality" />
          </div>
        </section>

        {/* Issue stats */}
        <section className="mb-8">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm text-zinc-400">{totalIssues} issues found</span>
            {(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as IssueSeverity[]).map((s) => {
              const count =
                s === "CRITICAL"
                  ? analysis.issuesCritical
                  : s === "HIGH"
                    ? analysis.issuesHigh
                    : s === "MEDIUM"
                      ? analysis.issuesMedium
                      : s === "LOW"
                        ? analysis.issuesLow
                        : analysis.issuesInfo;
              if (!count) return null;
              return (
                <div key={s} className="flex items-center gap-1.5">
                  <IssueSeverityBadge severity={s} />
                  <span className="text-sm text-zinc-400">{count}</span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Issue list */}
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-white">Issues</h2>
            {/* Severity filter tabs */}
            <div className="flex flex-wrap gap-1">
              {SEVERITIES.map((s) => (
                <button
                  key={s}
                  onClick={() => { setSeverity(s); setPage(1); }}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    severity === s
                      ? "bg-zinc-700 text-white"
                      : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {issuesQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-zinc-900" />
              ))}
            </div>
          ) : issuesQuery.data?.issues.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 py-12 text-center text-zinc-600">
              No {severity !== "ALL" ? severity.toLowerCase() : ""} issues found.
            </div>
          ) : (
            <div className="space-y-2">
              {issuesQuery.data?.issues.map((issue) => (
                <IssueCard key={issue.id} issue={issue} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-4">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
                className="flex items-center gap-1 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              <span className="text-sm text-zinc-500">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page === totalPages}
                className="flex items-center gap-1 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-40"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
