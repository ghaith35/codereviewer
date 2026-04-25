import { spawn } from "node:child_process";
import { writeFile, mkdtemp, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { IssueInput } from "./types.js";

interface PylintMessage {
  type: "convention" | "refactor" | "warning" | "error" | "fatal";
  module: string;
  obj: string;
  line: number;
  column: number;
  endLine: number | null;
  endColumn: number | null;
  path: string;
  symbol: string;
  message: string;
  "message-id": string;
}

const SEVERITY: Record<PylintMessage["type"], IssueInput["severity"]> = {
  fatal: "CRITICAL",
  error: "HIGH",
  warning: "MEDIUM",
  refactor: "LOW",
  convention: "INFO",
};

export async function runPylint(
  files: Array<{ path: string; content: string }>
): Promise<IssueInput[]> {
  const tmp = await mkdtemp(join(tmpdir(), "cr-pylint-"));
  try {
    const localPaths: Record<string, string> = {};
    for (const f of files) {
      const local = join(tmp, f.path);
      await mkdir(join(local, ".."), { recursive: true });
      await writeFile(local, f.content, "utf8");
      localPaths[local] = f.path;
    }

    const out = await runCmd("pylint", [
      "--output-format=json",
      "--disable=C0114,C0115,C0116",
      "--max-line-length=120",
      "--recursive=y",
      tmp,
    ]);

    let messages: PylintMessage[] = [];
    try {
      messages = JSON.parse(out || "[]");
    } catch {
      // malformed output — treat as no issues
    }

    return messages.map((m) => ({
      filePath: localPaths[m.path] ?? m.path.replace(tmp + "/", ""),
      lineStart: m.line,
      lineEnd: m.endLine ?? m.line,
      columnStart: m.column,
      severity: m["message-id"].startsWith("E06") ? "CRITICAL" : SEVERITY[m.type],
      category: m.symbol.includes("security")
        ? "SECURITY"
        : m.type === "refactor"
          ? "MAINTAINABILITY"
          : "QUALITY",
      source: "PYLINT",
      ruleId: m["message-id"],
      title: m.message.slice(0, 120),
      description: `${m.symbol}: ${m.message}`,
    }));
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

function runCmd(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    // pylint exits non-zero when issues found — that's normal, just resolve
    p.on("close", () => resolve(out));
    p.on("error", () => resolve("")); // pylint not installed → no issues
  });
}
