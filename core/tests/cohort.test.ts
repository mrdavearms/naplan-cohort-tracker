/**
 * Ported from the legacy `tests/test_cohort.py` (the oracle's own regression
 * suite) plus pairing/transition coverage. These are oracle-independent ground
 * truth: they pin the Wilson and McNemar conventions so a future change can't
 * silently drift from statsmodels.
 */
import { describe, expect, it } from "vitest";
import {
  buildPairedCohort,
  mcnemarPaired,
  normInv,
  transitionMatrix,
  wilsonCi,
  type PairedStudent,
  type StudentReportRow,
} from "../src/index";

describe("normInv (Wichura AS241 inverse normal)", () => {
  it("matches the 97.5% standard-normal quantile to machine precision", () => {
    expect(normInv(0.975)).toBeCloseTo(1.959963984540054, 12);
  });
  it("is symmetric about 0.5", () => {
    expect(normInv(0.5)).toBeCloseTo(0, 12);
    expect(normInv(0.025)).toBeCloseTo(-1.959963984540054, 12);
  });
});

describe("wilsonCi (≙ statsmodels proportion_confint method='wilson')", () => {
  // Exact reference values below are statsmodels output, captured directly from
  // the legacy venv:  proportion_confint(k, n, 0.05, "wilson").
  it("50/100 matches statsmodels exactly", () => {
    const [lo, hi] = wilsonCi(50, 100);
    expect(lo).toBeCloseTo(0.4038315303659956, 12);
    expect(hi).toBeCloseTo(0.5961684696340044, 12);
  });

  it("0/10 matches statsmodels exactly (lower 0)", () => {
    const [lo, hi] = wilsonCi(0, 10);
    expect(lo).toBeCloseTo(0, 12);
    expect(hi).toBeCloseTo(0.27753279986288926, 12);
  });

  it("10/10 matches statsmodels exactly (upper 1)", () => {
    const [lo, hi] = wilsonCi(10, 10);
    expect(lo).toBeCloseTo(0.7224672001371106, 12);
    expect(hi).toBeCloseTo(1, 12);
  });

  it("n=0 → [0, 0]", () => {
    expect(wilsonCi(0, 0)).toEqual([0, 0]);
  });
});

/** Minimal PairedStudent for McNemar/transition cases. */
function pair(y7: string, y9: string): PairedStudent {
  return {
    localStudentId: "x",
    classGroupY7: null,
    proficiencyY7: y7,
    lboteStatus: null,
    atsiGroup: null,
    participationCode: "Participated",
    classGroupY9: null,
    proficiencyY9: y9,
  };
}

describe("mcnemarPaired (≙ statsmodels mcnemar exact=True)", () => {
  it("zero discordant → pValue null (honest 'no signal', not 1.0)", () => {
    const paired = [
      pair("Strong", "Strong"),
      pair("Strong", "Strong"),
      pair("Needs additional support", "Needs additional support"),
      pair("Needs additional support", "Needs additional support"),
    ];
    const r = mcnemarPaired(paired);
    expect(r.pValue).toBeNull();
    expect(r.movedOutOfNas).toBe(0);
    expect(r.movedIntoNas).toBe(0);
  });

  it("balanced discordant (2 each way) → not significant (p ~ 1.0)", () => {
    const paired = [
      pair("Needs additional support", "Strong"),
      pair("Needs additional support", "Strong"),
      pair("Strong", "Needs additional support"),
      pair("Strong", "Needs additional support"),
      pair("Strong", "Strong"),
      pair("Strong", "Strong"),
    ];
    const r = mcnemarPaired(paired);
    expect(r.pValue).not.toBeNull();
    expect(r.pValue!).toBeGreaterThan(0.5);
    expect(r.pValue!).toBeCloseTo(1.0, 10);
  });

  it("strong directional (10 move out of NAS) → significant (p < 0.01)", () => {
    const paired = Array.from({ length: 10 }, () =>
      pair("Needs additional support", "Strong"),
    );
    const r = mcnemarPaired(paired);
    expect(r.pValue).not.toBeNull();
    expect(r.pValue!).toBeLessThan(0.01);
    expect(r.pValue!).toBeCloseTo(0.001953125, 9); // 2 * 0.5^10
    expect(r.movedOutOfNas).toBe(10);
  });
});

/** Minimal StudentReportRow factory. */
function sr(
  id: string | null,
  proficiency: string | null,
  participation = "Participated",
): StudentReportRow {
  return {
    localStudentId: id,
    classGroups: null,
    proficiencyLevel: proficiency,
    lboteStatus: null,
    atsiGroup: null,
    participationCode: participation,
  };
}

describe("buildPairedCohort", () => {
  it("splits paired / leavers / joiners and filters null-proficiency pairs", () => {
    const y7 = [
      sr("A", "Strong"),
      sr("B", "Needs additional support"),
      sr("C", "Developing"), // leaver — absent from Y9
      sr("D", "Strong", "Absent"), // excluded entirely (did not participate)
      sr("E", null), // paired by ID but Y7 proficiency null → filtered
    ];
    const y9 = [
      sr("A", "Exceeding"),
      sr("B", "Strong"),
      sr("E", "Strong"),
      sr("F", "Strong"), // joiner — absent from Y7
    ];

    const pc = buildPairedCohort(y7, y9, "Reading");

    expect(pc.paired.map((p) => p.localStudentId).sort()).toEqual(["A", "B"]);
    expect(pc.pairedFilteredCount).toBe(1); // E dropped
    expect(pc.leavers.map((l) => l.localStudentId)).toEqual(["C"]);
    expect(pc.joiners.map((j) => j.localStudentId)).toEqual(["F"]);

    const a = pc.paired.find((p) => p.localStudentId === "A")!;
    expect(a.proficiencyY7).toBe("Strong");
    expect(a.proficiencyY9).toBe("Exceeding");
  });
});

describe("transitionMatrix", () => {
  it("counts Y7→Y9 transitions in PROFICIENCY_LEVELS order", () => {
    // index: NAS=0, Developing=1, Strong=2, Exceeding=3
    const paired = [
      pair("Needs additional support", "Developing"),
      pair("Developing", "Strong"),
      pair("Strong", "Strong"),
      pair("Exceeding", "Exceeding"),
      pair("Needs additional support", "Needs additional support"),
    ];
    const m = transitionMatrix(paired);

    expect(m).toHaveLength(4);
    expect(m.every((r) => r.length === 4)).toBe(true);
    expect(m[0]![0]).toBe(1); // NAS → NAS
    expect(m[0]![1]).toBe(1); // NAS → Developing
    expect(m[1]![2]).toBe(1); // Developing → Strong
    expect(m[2]![2]).toBe(1); // Strong → Strong
    expect(m[3]![3]).toBe(1); // Exceeding → Exceeding
    expect(m[2]![0]).toBe(0); // no Strong → NAS
    expect(m.flat().reduce((a, b) => a + b, 0)).toBe(5);
  });
});
