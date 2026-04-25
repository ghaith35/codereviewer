interface Props {
  score: number;
  size?: number;
  label?: string;
}

export function ScoreGauge({ score, size = 160, label }: Props) {
  const radius = (size - 16) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - score / 100);
  const color =
    score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : score >= 40 ? "#f97316" : "#ef4444";

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#27272a"
          strokeWidth="8"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth="8"
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease-out, stroke 0.3s" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-4xl font-bold" style={{ color }}>
          {score}
        </div>
        {label && (
          <div className="mt-1 text-xs uppercase tracking-wide text-zinc-500">{label}</div>
        )}
      </div>
    </div>
  );
}
