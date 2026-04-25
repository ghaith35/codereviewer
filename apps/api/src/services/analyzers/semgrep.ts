import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { IssueInput } from "./types.js";

const RULESETS = [
  "p/security-audit",
  "p/owasp-top-ten",
  "p/javascript",
  "p/typescript",
  "p/python",
  "p/secrets",
];

interface SemgrepFinding {
  check_id: string;
  path: string;
  start: { line: number; col: number };
  end: { line: number; col: number };
  extra: { message: string; severity: "INFO" | "WARNING" | "ERROR"; metadata?: unknown };
}

const SEV: Record<string, IssueInput["severity"]> = {
  ERROR: "HIGH",
  WARNING: "MEDIUM",
  INFO: "LOW",
};

export async function runSemgrep(
  files: Array<{ path: string; content: string }>
): Promise<IssueInput[]> {
  if (files.length === 0) return [];
  const tmp = await mkdtemp(join(tmpdir(), "cr-semgrep-"));
  try {
    for (const f of files) {
      const local = join(tmp, f.path);
      await mkdir(join(local, ".."), { recursive: true });
      await writeFile(local, f.content, "utf8");
    }

    const args = ["--json", "--quiet", "--timeout=20", "--metrics=off"];
    for (const r of RULESETS) args.push("--config", r);
    args.push(tmp);

    const out = await runCmd("semgrep", args);
    const parsed = JSON.parse(out || "{}") as { results?: SemgrepFinding[] };
    const findings = parsed.results ?? [];

    return findings.map((f) => ({
      filePath: f.path.replace(tmp + "/", ""),
      lineStart: f.start.line,
      lineEnd: f.end.line,
      columnStart: f.start.col,
      severity:
        f.check_id.includes("secret") || f.check_id.includes("injection")
          ? "CRITICAL"
          : (SEV[f.extra.severity] ?? "LOW"),
      category: "SECURITY" as const,
      source: "SEMGREP" as const,
      ruleId: f.check_id,
      title: f.extra.message.split(".")[0].slice(0, 120),
      description: f.extra.message,
    }));
  } catch {
    return []; // never fail the whole analysis because semgrep broke
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

function runCmd(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.on("close", () => resolve(out));
    p.on("error", () => resolve("")); // semgrep not installed → no issues
  });
}
