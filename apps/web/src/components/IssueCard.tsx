import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { IssueSeverityBadge } from "./IssueSeverityBadge.js";
import type { Issue } from "@cr/shared";

function detectLang(filePath: string): string {
  if (filePath.endsWith(".py")) return "python";
  if (/\.tsx?$/.test(filePath)) return "typescript";
  return "javascript";
}

export function IssueCard({ issue }: { issue: Issue }) {
  const [expanded, setExpanded] = useState(false);
  const lang = detectLang(issue.filePath);
  const hasFix = !!issue.suggestion || !!issue.suggestionCode;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 transition-shadow hover:shadow-md hover:shadow-black/30">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <div className="mt-0.5">
          <IssueSeverityBadge severity={issue.severity} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-medium text-white">{issue.title}</h3>
            <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">
              {issue.source}
            </span>
          </div>
          <div className="mt-1 truncate font-mono text-sm text-zinc-500">
            {issue.filePath}:{issue.lineStart}
            {issue.lineEnd && issue.lineEnd !== issue.lineStart ? `-${issue.lineEnd}` : ""}
          </div>
        </div>
        <ChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 text-zinc-500 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-zinc-800 p-4">
          <p className="whitespace-pre-wrap text-sm text-zinc-300">{issue.description}</p>

          {issue.codeSnippet && (
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-500">Offending code</div>
              <SyntaxHighlighter
                language={lang}
                style={oneLight}
                customStyle={{ fontSize: 13, margin: 0, borderRadius: 6 }}
              >
                {issue.codeSnippet}
              </SyntaxHighlighter>
            </div>
          )}

          {hasFix && (
            <div>
              <div className="mb-1 text-xs font-medium text-emerald-400">Suggested fix</div>
              {issue.suggestion && (
                <p className="mb-2 whitespace-pre-wrap text-sm text-zinc-300">
                  {issue.suggestion}
                </p>
              )}
              {issue.suggestionCode && (
                <SyntaxHighlighter
                  language={lang}
                  style={oneLight}
                  customStyle={{ fontSize: 13, margin: 0, borderRadius: 6, background: "#f0fdf4" }}
                >
                  {issue.suggestionCode}
                </SyntaxHighlighter>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
