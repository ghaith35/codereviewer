import { z } from "zod";
export declare const StartAnalysisSchema: z.ZodObject<{
    repositoryId: z.ZodString;
    branch: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    repositoryId: string;
    branch?: string | undefined;
}, {
    repositoryId: string;
    branch?: string | undefined;
}>;
export declare const AnalysisStatusSchema: z.ZodEnum<["QUEUED", "FETCHING_FILES", "RUNNING_STATIC", "RUNNING_AI", "GENERATING_REPORT", "COMPLETED", "FAILED", "CANCELLED"]>;
export declare const IssueSeveritySchema: z.ZodEnum<["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]>;
export declare const IssueCategorySchema: z.ZodEnum<["SECURITY", "PERFORMANCE", "QUALITY", "BEST_PRACTICE", "MAINTAINABILITY"]>;
//# sourceMappingURL=analysis.d.ts.map