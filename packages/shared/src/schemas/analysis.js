"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssueCategorySchema = exports.IssueSeveritySchema = exports.AnalysisStatusSchema = exports.StartAnalysisSchema = void 0;
const zod_1 = require("zod");
exports.StartAnalysisSchema = zod_1.z.object({
    repositoryId: zod_1.z.string().min(1),
    branch: zod_1.z.string().optional(),
});
exports.AnalysisStatusSchema = zod_1.z.enum([
    "QUEUED",
    "FETCHING_FILES",
    "RUNNING_STATIC",
    "RUNNING_AI",
    "GENERATING_REPORT",
    "COMPLETED",
    "FAILED",
    "CANCELLED",
]);
exports.IssueSeveritySchema = zod_1.z.enum([
    "CRITICAL",
    "HIGH",
    "MEDIUM",
    "LOW",
    "INFO",
]);
exports.IssueCategorySchema = zod_1.z.enum([
    "SECURITY",
    "PERFORMANCE",
    "QUALITY",
    "BEST_PRACTICE",
    "MAINTAINABILITY",
]);
//# sourceMappingURL=analysis.js.map