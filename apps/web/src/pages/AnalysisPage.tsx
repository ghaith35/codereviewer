import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, XCircle, FileText } from "lucide-react";
import { api } from "../lib/api.js";
import { AnalysisProgress } from "../components/AnalysisProgress.js";
import { ScoreGauge } from "../components/ScoreGauge.js";
import type { AnalysisDetail } from "@cr/shared";

const TERMINAL = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

export function AnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: analysis, isLoading } = useQuery<AnalysisDetail>({
    queryKey: ["analysis", id],
    queryFn: () => api.get<AnalysisDetail>(`/analyses/${id}`),
    enabled: !!id,
    // Refetch while in-progress so the page stays fresh on revisit
    refetchInterval: (q) =>
      q.state.data && !TERMINAL.has(q.state.data.status) ? 10_000 : false,
  });

  if (isLoading || !analysis) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-300" />
      </div>
    );
  }

  // Determine what to show
  const isTerminal = TERMINAL.has(analysis.status);
  const isFailed = analysis.status === "FAILED" || errorMsg;
  const score = finalScore ?? analysis.overallScore;
  const isCompleted = analysis.status === "COMPLETED" || finalScore !== null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-xl">
        {/* Breadcrumb */}
        <div className="mb-8 flex items-center gap-2 text-sm text-zinc-500">
          <Link to="/dashboard" className="transition hover:text-zinc-300">Dashboard</Link>
          <span>/</span>
          <Link to={`/repos/${analysis.repositoryId}`} className="transition hover:text-zinc-300">
            {analysis.repositoryFullName}
          </Link>
          <span>/</span>
          <span className="text-zinc-400">Analysis</span>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
          <h1 className="mb-1 text-xl font-bold text-white">{analysis.repositoryFullName}</h1>
          <p className="mb-8 text-sm text-zinc-500">Branch: {analysis.branch}</p>

          {/* Completed state */}
          {isCompleted && !isFailed && score != null && (
            <div className="flex flex-col items-center gap-6 text-center">
              <CheckCircle className="h-12 w-12 text-emerald-400" />
              <ScoreGauge score={score} size={180} label="Overall Score" />
              <div className="text-sm text-zinc-400">
                {analysis.filesAnalyzed} files analyzed ·{" "}
                {(analysis.issuesCritical ?? 0) +
                  (analysis.issuesHigh ?? 0) +
                  (analysis.issuesMedium ?? 0) +
                  (analysis.issuesLow ?? 0) +
                  (analysis.issuesInfo ?? 0)}{" "}
                issues found
              </div>
              <button
                onClick={() => navigate(`/analyses/${id}/report`)}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 font-medium text-white transition hover:bg-emerald-500"
              >
                <FileText className="h-4 w-4" />
                View Full Report
              </button>
            </div>
          )}

          {/* Failed state */}
          {isFailed && (
            <div className="flex flex-col items-center gap-4 text-center">
              <XCircle className="h-12 w-12 text-red-400" />
              <p className="font-medium text-white">Analysis Failed</p>
              <p className="text-sm text-zinc-400">
                {analysis.errorMessage ?? errorMsg ?? "An unexpected error occurred"}
              </p>
              <Link
                to={`/repos/${analysis.repositoryId}`}
                className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-700"
              >
                Try again
              </Link>
            </div>
          )}

          {/* In-progress state */}
          {!isTerminal && !isFailed && finalScore === null && (
            <AnalysisProgress
              analysisId={id!}
              onComplete={(s) => setFinalScore(s)}
              onError={(msg) => setErrorMsg(msg)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
