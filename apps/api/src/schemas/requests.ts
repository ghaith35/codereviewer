import { z } from "zod";

export const ListReposQuery = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["pushedAt", "name"]).default("pushedAt"),
});

export const ListAnalysesQuery = z.object({
  repositoryId: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const ListIssuesQuery = z.object({
  severity: z.string().optional(),
  category: z.string().optional(),
  filePath: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
