import { GoogleGenerativeAI } from "@google/generative-ai";
import pLimit from "p-limit";
import { env } from "../../env.js";
import type { IssueInput } from "./types.js";

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-lite",
  generationConfig: {
    temperature: 0.2,
    maxOutputTokens: 4096,
    responseMimeType: "application/json",
  },
});

const MAX_CHARS_PER_CHUNK = 24_000;
const MAX_FILES_TO_REVIEW = 50;

const PROMPT = `You are a senior software engineer conducting a code review. Analyze the following file for real, concrete issues ONLY. Do not invent problems. Do not comment on style preferences.

Focus on:
- Security vulnerabilities (injection, XSS, auth bypass, hardcoded secrets, unsafe deserialization)
- Performance issues (O(n²) where O(n) is possible, N+1 queries, memory leaks, unnecessary re-renders)
- Correctness bugs (race conditions, missing error handling, off-by-one, null deref)
- Maintainability anti-patterns (god functions, deeply nested callbacks, duplicated logic)

Ignore:
- Missing comments, naming preferences, formatting
- Anything an ESLint/Pylint rule would already catch

Return ONLY a JSON object with this exact shape:
{
  "issues": [
    {
      "lineStart": <number>,
      "lineEnd": <number>,
      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
      "category": "SECURITY" | "PERFORMANCE" | "QUALITY" | "BEST_PRACTICE" | "MAINTAINABILITY",
      "title": "<one sentence, <120 chars>",
      "description": "<2-4 sentences explaining the problem and its impact>",
      "suggestion": "<markdown-formatted fix explanation>",
      "suggestionCode": "<just the replacement code, no markdown fences>"
    }
  ]
}

If there are no real issues, return { "issues": [] }.

File: {{filePath}}
Language: {{language}}

\`\`\`{{language}}
{{content}}
\`\`\``;

interface GeminiIssue {
  lineStart: number;
  lineEnd: number;
  severity: IssueInput["severity"];
  category: IssueInput["category"];
  title: string;
  description: string;
  suggestion: string;
  suggestionCode?: string;
}

export async function runGemini(
  files: Array<{ path: string; content: string; language: string }>,
  onProgress: (pct: number) => void
): Promise<IssueInput[]> {
  const sorted = [...files]
    .filter((f) => !f.path.includes("test") && !f.path.includes("spec"))
    .sort((a, b) => b.content.length - a.content.length)
    .slice(0, MAX_FILES_TO_REVIEW);

  const limit = pLimit(2); // 2 concurrent = well under 15 RPM free tier
  const all: IssueInput[] = [];
  let done = 0;

  await Promise.all(
    sorted.map((file) =>
      limit(async () => {
        try {
          const content =
            file.content.length > MAX_CHARS_PER_CHUNK
              ? file.content.slice(0, MAX_CHARS_PER_CHUNK) + "\n// ...[truncated]"
              : file.content;

          const prompt = PROMPT.replace("{{filePath}}", file.path)
            .replaceAll("{{language}}", file.language)
            .replace("{{content}}", content);

          const issues = await callWithRetry(prompt);

          all.push(
            ...issues.map((i) => ({
              filePath: file.path,
              lineStart: i.lineStart,
              lineEnd: i.lineEnd,
              severity: i.severity,
              category: i.category,
              source: "GEMINI" as const,
              ruleId: `gemini:${i.category.toLowerCase()}`,
              title: i.title,
              description: i.description,
              suggestion: i.suggestion,
              suggestionCode: i.suggestionCode,
            }))
          );
        } catch (err) {
          console.warn(`[gemini] failed for ${file.path}:`, (err as Error).message);
        } finally {
          done += 1;
          onProgress(done / sorted.length);
        }
      })
    )
  );

  return all;
}

async function callWithRetry(prompt: string, attempt = 0): Promise<GeminiIssue[]> {
  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    const parsed = JSON.parse(cleaned) as { issues?: unknown[] };
    if (!Array.isArray(parsed.issues)) return [];
    return parsed.issues.filter(isValidGeminiIssue);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    const is429 = e.status === 429 || e.message?.includes("quota");
    if (is429 && attempt < 3) {
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 2000));
      return callWithRetry(prompt, attempt + 1);
    }
    throw err;
  }
}

function isValidGeminiIssue(i: unknown): i is GeminiIssue {
  const item = i as Record<string, unknown> | null;
  return (
    typeof item?.lineStart === "number" &&
    typeof item?.title === "string" &&
    ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"].includes(item?.severity as string) &&
    ["SECURITY", "PERFORMANCE", "QUALITY", "BEST_PRACTICE", "MAINTAINABILITY"].includes(
      item?.category as string
    )
  );
}
