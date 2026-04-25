export interface AnalyzeJobData {
    analysisId: string;
    userId: string;
    repositoryId: string;
    branch: string;
}
export interface AnalyzeJobResult {
    analysisId: string;
    overallScore: number;
    totalIssues: number;
    durationMs: number;
}
//# sourceMappingURL=jobs.d.ts.map