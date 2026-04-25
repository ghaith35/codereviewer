import type { IssueInput } from "./analyzers/types.js";

const WEIGHTS: Record<IssueInput["severity"], number> = {
  CRITICAL: 20,
  HIGH: 10,
  MEDIUM: 5,
  LOW: 2,
  INFO: 0,
};

export interface Scores {
  overall: number;
  security: number;
  performance: number;
  quality: number;
}

export function calculateScores(issues: IssueInput[], filesAnalyzed: number): Scores {
  const files = Math.max(1, filesAnalyzed);

  const scoreFor = (subset: IssueInput[]) => {
    const raw = subset.reduce((sum, i) => sum + WEIGHTS[i.severity], 0);
    const normalized = raw / files;
    return Math.max(0, Math.round(100 - Math.min(100, normalized * 3)));
  };

  return {
    overall: scoreFor(issues),
    security: scoreFor(issues.filter((i) => i.category === "SECURITY")),
    performance: scoreFor(issues.filter((i) => i.category === "PERFORMANCE")),
    quality: scoreFor(
      issues.filter((i) =>
        ["QUALITY", "MAINTAINABILITY", "BEST_PRACTICE"].includes(i.category)
      )
    ),
  };
}
