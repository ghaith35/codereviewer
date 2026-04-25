import { z } from "zod";

export const StartAnalysisSchema = z.object({
  repositoryId: z.string().min(1),
  branch: z.string().optional(),
});

export const AnalysisStatusSchema = z.enum([
  "QUEUED",
  "FETCHING_FILES",
  "RUNNING_STATIC",
  "RUNNING_AI",
  "GENERATING_REPORT",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);

export const IssueSeveritySchema = z.enum([
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "INFO",
]);

export const IssueCategorySchema = z.enum([
  "SECURITY",
  "PERFORMANCE",
  "QUALITY",
  "BEST_PRACTICE",
  "MAINTAINABILITY",
]);
