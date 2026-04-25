import { useEffect, useState } from "react";
import { API_ORIGIN } from "../lib/api.js";

export function useAnalysisStatus(analysisId: string | null) {
  const [status, setStatus] = useState<string>("QUEUED");
  const [progress, setProgress] = useState(0);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!analysisId) return;

    const url = `${API_ORIGIN}/api/analyses/${analysisId}/status`;
    const es = new EventSource(url, { withCredentials: true });

    es.addEventListener("status", (e) => {
      const d = JSON.parse((e as MessageEvent).data) as { status: string; progress?: number };
      setStatus(d.status);
      setProgress(d.progress ?? 0);
    });

    es.addEventListener("progress", (e) => {
      const d = JSON.parse((e as MessageEvent).data) as { status: string; progress?: number } & Record<string, unknown>;
      setStatus(d.status);
      setProgress(d.progress ?? 0);
      setExtra((prev) => ({ ...prev, ...d }));
    });

    es.addEventListener("completed", (e) => {
      const d = JSON.parse((e as MessageEvent).data) as { analysisId: string; overallScore?: number };
      setStatus("COMPLETED");
      setProgress(100);
      setCompleted(true);
      setExtra((prev) => ({ ...prev, overallScore: d.overallScore }));
      es.close();
    });

    es.addEventListener("error", (e) => {
      const msg = (e as MessageEvent).data as string | undefined;
      if (msg) {
        try {
          const d = JSON.parse(msg) as { message?: string };
          setStatus("FAILED");
          setError(d.message ?? "Analysis failed");
        } catch {
          // network hiccup — EventSource will auto-retry
        }
      }
    });

    return () => es.close();
  }, [analysisId]);

  return { status, progress, extra, completed, error };
}
