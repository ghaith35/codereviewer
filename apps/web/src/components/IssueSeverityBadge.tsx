import type { IssueSeverity } from "@cr/shared";

const STYLES: Record<IssueSeverity, string> = {
  CRITICAL: "bg-red-950 text-red-400 ring-red-500/30",
  HIGH: "bg-orange-950 text-orange-400 ring-orange-500/30",
  MEDIUM: "bg-amber-950 text-amber-400 ring-amber-500/30",
  LOW: "bg-blue-950 text-blue-400 ring-blue-500/30",
  INFO: "bg-zinc-800 text-zinc-400 ring-zinc-600/30",
};

export function IssueSeverityBadge({ severity }: { severity: IssueSeverity }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[severity]}`}
    >
      {severity}
    </span>
  );
}
