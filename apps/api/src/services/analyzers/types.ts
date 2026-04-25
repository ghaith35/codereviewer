export interface IssueInput {
  filePath: string;
  lineStart: number;
  lineEnd?: number;
  columnStart?: number;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  category: "SECURITY" | "PERFORMANCE" | "QUALITY" | "BEST_PRACTICE" | "MAINTAINABILITY";
  source: "ESLINT" | "PYLINT" | "SEMGREP" | "GEMINI";
  ruleId?: string;
  title: string;
  description: string;
  codeSnippet?: string;
  suggestion?: string;
  suggestionCode?: string;
}
