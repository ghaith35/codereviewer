import { useEffect } from "react";
import { useAnalysisStatus } from "../hooks/useAnalysisStatus.js";
import type { AnalysisStatus } from "@cr/shared";

const STAGES: { key: AnalysisStatus; label: string }[] = [
  { key: "FETCHING_FILES", label: "Fetching files" },
  { key: "RUNNING_STATIC", label: "Static analysis" },
  { key: "RUNNING_AI", label: "AI review" },
  { key: "GENERATING_REPORT", label: "Generating report" },
  { key: "COMPLETED", label: "Complete" },
];

const STAGE_ORDER: Record<AnalysisStatus, number> = {
  QUEUED: -1,
  FETCHING_FILES: 0,
  RUNNING_STATIC: 1,
  RUNNING_AI: 2,
  GENERATING_REPORT: 3,
  COMPLETED: 4,
  FAILED: 4,
  CANCELLED: 4,
};

interface Props {
  analysisId: string;
  onComplete: (score: number) => void;
  onError: (message: string) => void;
}

export function AnalysisProgress({ analysisId, onComplete, onError }: Props) {
  const { status, progress, extra, completed, error } = useAnalysisStatus(analysisId);

  useEffect(() => {
    if (completed) onComplete((extra.overallScore as number) ?? 0);
  }, [completed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (error) onError(error);
  }, [error]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentOrder = STAGE_ORDER[status as AnalysisStatus] ?? -1;

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div>
        <div className="mb-2 flex justify-between text-sm text-zinc-400">
          <span>{status.replace(/_/g, " ")}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stage indicators */}
      <div className="flex items-center gap-2">
        {STAGES.map((stage, i) => {
          const done = i < currentOrder;
          const active = i === currentOrder;
          return (
            <div key={stage.key} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                  done
                    ? "bg-emerald-500 text-white"
                    : active
                      ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500"
                      : "bg-zinc-800 text-zinc-600"
                }`}
              >
                {done ? "✓" : i + 1}
              </div>
              <span
                className={`hidden text-center text-xs sm:block ${
                  active ? "text-emerald-400" : done ? "text-zinc-400" : "text-zinc-600"
                }`}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      {typeof extra.totalFiles === "number" && (
        <p className="text-center text-sm text-zinc-500">
          Analyzing {extra.totalFiles as number} files
        </p>
      )}
    </div>
  );
}
