import { ESLint, type Linter } from "eslint";
import type { IssueInput } from "./types.js";

const overrideConfig: Linter.Config = {
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2022, sourceType: "module", ecmaFeatures: { jsx: true } },
  env: { es2022: true, node: true },
  plugins: ["@typescript-eslint", "security"],
  rules: {
    // Security
    "no-eval": "error",
    "no-implied-eval": "error",
    "no-new-func": "error",
    "security/detect-non-literal-regexp": "warn",
    "security/detect-object-injection": "warn",
    "security/detect-unsafe-regex": "error",
    // Quality
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
    "no-console": "warn",
    "complexity": ["warn", 15],
    "max-lines-per-function": ["warn", { max: 80 }],
    "no-duplicate-imports": "error",
    "eqeqeq": "error",
    "no-var": "error",
    "prefer-const": "warn",
  },
};

// Plugins resolve from CWD; server must start from apps/api/ (which turbo/pnpm ensures)
const eslint = new ESLint({
  useEslintrc: false,
  allowInlineConfig: false,
  resolvePluginsRelativeTo: process.cwd(),
  overrideConfig,
});

const SEVERITY_MAP: Record<string, IssueInput["severity"]> = {
  "no-eval": "CRITICAL",
  "no-implied-eval": "CRITICAL",
  "no-new-func": "CRITICAL",
  "security/detect-unsafe-regex": "HIGH",
  "security/detect-object-injection": "HIGH",
  "security/detect-non-literal-regexp": "MEDIUM",
  "complexity": "MEDIUM",
  "max-lines-per-function": "LOW",
  "no-console": "LOW",
  "no-unused-vars": "LOW",
  "@typescript-eslint/no-unused-vars": "LOW",
  "@typescript-eslint/no-explicit-any": "LOW",
};

const CATEGORY_MAP: Record<string, IssueInput["category"]> = {
  "no-eval": "SECURITY",
  "no-implied-eval": "SECURITY",
  "no-new-func": "SECURITY",
  "security/detect-unsafe-regex": "SECURITY",
  "security/detect-object-injection": "SECURITY",
  "security/detect-non-literal-regexp": "SECURITY",
  "complexity": "MAINTAINABILITY",
  "max-lines-per-function": "MAINTAINABILITY",
  "no-console": "QUALITY",
  "no-unused-vars": "QUALITY",
  "@typescript-eslint/no-unused-vars": "QUALITY",
  "@typescript-eslint/no-explicit-any": "QUALITY",
};

export async function runESLint(
  files: Array<{ path: string; content: string }>
): Promise<IssueInput[]> {
  const issues: IssueInput[] = [];
  for (const file of files) {
    try {
      const results = await eslint.lintText(file.content, { filePath: file.path });
      for (const result of results) {
        for (const m of result.messages) {
          const ruleId = m.ruleId ?? "eslint:unknown";
          issues.push({
            filePath: file.path,
            lineStart: m.line,
            lineEnd: m.endLine ?? m.line,
            columnStart: m.column,
            severity: SEVERITY_MAP[ruleId] ?? (m.severity === 2 ? "MEDIUM" : "LOW"),
            category: CATEGORY_MAP[ruleId] ?? "QUALITY",
            source: "ESLINT",
            ruleId,
            title: m.message.split(".")[0].slice(0, 120),
            description: m.message,
            codeSnippet: extractSnippet(file.content, m.line),
          });
        }
      }
    } catch {
      // parse errors — skip the file, don't fail the whole analysis
    }
  }
  return issues;
}

function extractSnippet(content: string, line: number, ctx = 3): string {
  const lines = content.split("\n");
  const start = Math.max(0, line - 1 - ctx);
  const end = Math.min(lines.length, line + ctx);
  const snippet = lines
    .slice(start, end)
    .map((l, i) => `${start + i + 1} ${start + i + 1 === line ? "→" : " "} ${l}`)
    .join("\n");
  return redactSecrets(snippet);
}

function redactSecrets(s: string): string {
  return s
    .replace(/(AKIA|ASIA)[0-9A-Z]{16}/g, "$1****REDACTED****")
    .replace(/ghp_[A-Za-z0-9]{36}/g, "ghp_****REDACTED****")
    .replace(/sk-[A-Za-z0-9]{48}/g, "sk-****REDACTED****")
    .replace(/AIza[0-9A-Za-z\-_]{35}/g, "AIza****REDACTED****");
}
