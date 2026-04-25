export type AnalysisStatus =
  | "QUEUED"
  | "FETCHING_FILES"
  | "RUNNING_STATIC"
  | "RUNNING_AI"
  | "GENERATING_REPORT"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type IssueSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export type IssueCategory =
  | "SECURITY"
  | "PERFORMANCE"
  | "QUALITY"
  | "BEST_PRACTICE"
  | "MAINTAINABILITY";

export type IssueSource = "ESLINT" | "PYLINT" | "SEMGREP" | "GEMINI";

export type Plan = "FREE" | "PRO";

export interface Issue {
  id: string;
  analysisId: string;
  filePath: string;
  lineStart: number;
  lineEnd?: number | null;
  columnStart?: number | null;
  severity: IssueSeverity;
  category: IssueCategory;
  source: IssueSource;
  ruleId?: string | null;
  title: string;
  description: string;
  codeSnippet?: string | null;
  suggestion?: string | null;
  suggestionCode?: string | null;
  createdAt: string;
}

