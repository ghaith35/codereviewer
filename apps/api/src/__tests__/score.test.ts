import { describe, it, expect } from "vitest";
import { calculateScores } from "../services/score.js";
import type { IssueInput } from "../services/analyzers/types.js";

const mk = (
  severity: IssueInput["severity"],
  category: IssueInput["category"] = "QUALITY"
): IssueInput => ({
  filePath: "f.ts",
  lineStart: 1,
  severity,
  category,
  source: "ESLINT",
  title: "t",
  description: "d",
});

describe("calculateScores", () => {
  it("returns 100 for no issues", () => {
    expect(calculateScores([], 10)).toEqual({
      overall: 100,
      security: 100,
      performance: 100,
      quality: 100,
    });
  });

  it("penalizes more for fewer files (density)", () => {
    const issues = [mk("HIGH"), mk("HIGH")];
    expect(calculateScores(issues, 100).overall).toBeGreaterThan(
      calculateScores(issues, 5).overall
    );
  });

  it("weights CRITICAL as 10x LOW", () => {
    const withCritical = calculateScores([mk("CRITICAL")], 10).overall;
    const withTenLow = calculateScores(
      Array.from({ length: 10 }, () => mk("LOW")),
      10
    ).overall;
    expect(withCritical).toBe(withTenLow);
  });

  it("floors at 0, never goes negative", () => {
    const massive = Array.from({ length: 100 }, () => mk("CRITICAL"));
    expect(calculateScores(massive, 1).overall).toBe(0);
  });

  it("isolates category scores", () => {
    const issues = [mk("CRITICAL", "SECURITY")];
    const s = calculateScores(issues, 10);
    expect(s.security).toBeLessThan(100);
    expect(s.performance).toBe(100);
    expect(s.quality).toBe(100);
  });

  it("INFO issues do not affect score", () => {
    const issues = Array.from({ length: 50 }, () => mk("INFO"));
    expect(calculateScores(issues, 10).overall).toBe(100);
  });
});
