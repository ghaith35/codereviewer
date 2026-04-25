import { describe, it, expect } from "vitest";
import { GitHubService } from "../services/github.js";

const svc = new GitHubService("fake-token");
const mk = (path: string, size = 1000) => ({
  path,
  sha: "abc123",
  size,
  type: "blob" as const,
});

describe("GitHubService.filterFiles", () => {
  it("keeps supported source files", () => {
    const { keep } = svc.filterFiles([mk("src/app.ts"), mk("src/utils.js"), mk("main.py")]);
    expect(keep.map((k) => k.path)).toEqual(["main.py", "src/app.ts", "src/utils.js"]);
  });

  it("skips node_modules", () => {
    const { keep, skipped } = svc.filterFiles([
      mk("node_modules/foo/index.js"),
      mk("src/app.ts"),
    ]);
    expect(keep.map((k) => k.path)).toEqual(["src/app.ts"]);
    expect(skipped[0].reason).toBe("ignored-dir");
  });

  it("skips binaries by extension", () => {
    const { keep, skipped } = svc.filterFiles([mk("logo.png"), mk("src/app.ts")]);
    expect(keep).toHaveLength(1);
    expect(skipped[0].reason).toBe("binary-or-minified");
  });

  it("skips minified files", () => {
    const { keep } = svc.filterFiles([mk("bundle.min.js"), mk("src/app.ts")]);
    expect(keep.map((k) => k.path)).toEqual(["src/app.ts"]);
  });

  it("skips too-large files", () => {
    const { keep, skipped } = svc.filterFiles([mk("huge.ts", 500 * 1024)]);
    expect(keep).toHaveLength(0);
    expect(skipped[0].reason).toBe("too-large");
  });

  it("skips unsupported languages", () => {
    const { keep, skipped } = svc.filterFiles([mk("main.go"), mk("src/app.ts")]);
    expect(keep.map((k) => k.path)).toEqual(["src/app.ts"]);
    expect(skipped[0].reason).toBe("unsupported-language");
  });

  it("skips dotfiles", () => {
    const { keep } = svc.filterFiles([mk(".env"), mk("src/app.ts")]);
    expect(keep.map((k) => k.path)).toEqual(["src/app.ts"]);
  });

  it("caps at MAX_FILES_PER_ANALYSIS (200)", () => {
    const entries = Array.from({ length: 300 }, (_, i) => mk(`src/file${i}.ts`));
    const { keep, skipped } = svc.filterFiles(entries);
    expect(keep).toHaveLength(200);
    expect(skipped.some((s) => s.reason === "file-limit")).toBe(true);
  });
});
