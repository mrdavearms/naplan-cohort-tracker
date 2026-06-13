/**
 * 1-3 — exact-McNemar detectability floor. The D=6 threshold is the load-bearing
 * fact (2·0.5^6 < 0.05 ≤ 2·0.5^5), so it is asserted directly here as well as
 * through `detectabilityFloor`.
 */
import { describe, expect, it } from "vitest";
import { detectabilityFloor, detectabilityNote } from "../src/index";

describe("exact-McNemar best-case threshold", () => {
  it("D=5 cannot reach p<0.05 but D=6 can (2·0.5^D)", () => {
    expect(2 * Math.pow(0.5, 5)).toBeCloseTo(0.0625, 12); // not significant
    expect(2 * Math.pow(0.5, 6)).toBeCloseTo(0.03125, 12); // significant
    expect(2 * Math.pow(0.5, 5)).toBeGreaterThanOrEqual(0.05);
    expect(2 * Math.pow(0.5, 6)).toBeLessThan(0.05);
  });
});

describe("detectabilityFloor", () => {
  it("needs at least 6 one-way movers at alpha=0.05, for any cohort size", () => {
    expect(detectabilityFloor(43).minMovers).toBe(6);
    expect(detectabilityFloor(100).minMovers).toBe(6);
    expect(detectabilityFloor(6).minMovers).toBe(6);
  });

  it("rounds the smallest detectable change to whole pp (n=43 → ±14 pp)", () => {
    const f = detectabilityFloor(43);
    expect(f.minDeltaPp).toBe(14); // round(6/43*100) = round(13.95)
    expect(f.feasible).toBe(true);
  });

  it("is infeasible when the cohort is smaller than the floor", () => {
    const f = detectabilityFloor(4);
    expect(f.minMovers).toBe(6);
    expect(f.feasible).toBe(false);
  });
});

describe("detectabilityNote", () => {
  it("uses the mandatory 'at least … even in the best case' framing", () => {
    const note = detectabilityNote(43);
    expect(note).toContain("at least 6 students");
    expect(note).toContain("even in the best case");
    expect(note).toContain("±14 pp");
  });

  it("says no change can reach significance when the cohort is too small", () => {
    const note = detectabilityNote(4);
    expect(note).toContain("no NAS change can reach statistical significance even in the best case");
    expect(note).toContain("at least 6 students");
  });
});
