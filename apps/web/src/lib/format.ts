export { formatDate, formatDatetime, formatBytes, formatDuration } from "@cr/shared";

export function formatScore(score: number | null | undefined): string {
  if (score == null) return "—";
  return score.toFixed(0);
}

export function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}
