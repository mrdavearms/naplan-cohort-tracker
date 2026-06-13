/**
 * 1-2 — quantified attrition (baseline-composition) sentence. Hand-computed
 * expectations for `attritionComposition` and the wording invariants of
 * `attritionCompositionSentence` (claims composition only; never a corrected
 * headline).
 */
import { describe, expect, it } from "vitest";
import {
  attritionComposition,
  attritionCompositionSentence,
  type LeaverRow,
  type PairedCohort,
  type PairedStudent,
} from "../src/index";

const NAS = "Needs additional support";

function ps(y7: string, y9: string): PairedStudent {
  return {
    localStudentId: "x",
    classGroupY7: null,
    proficiencyY7: y7,
    lboteStatus: null,
    atsiGroup: "Not reported",
    participationCode: "Participated",
    classGroupY9: null,
    proficiencyY9: y9,
  };
}

function leaver(y7: string | null): LeaverRow {
  return { localStudentId: "l", classGroupY7: null, proficiencyY7: y7, lboteStatus: null, atsiGroup: "Not reported", participationCode: "Participated" };
}

function cohort(paired: PairedStudent[], leavers: LeaverRow[]): PairedCohort {
  return { domain: "Reading", earlierLevel: 7, laterLevel: 9, paired, leavers, joiners: [], pairedFilteredCount: 0 };
}

describe("attritionComposition", () => {
  it("compares stayers' entry NAS rate with the full entry cohort's", () => {
    // 5 stayers, 2 NAS at Y7 (40%); 3 leavers, all NAS at Y7.
    // Full entry cohort: 8 students, 5 NAS → 62.5%. Stayers − full = −22.5 pp.
    const pc = cohort(
      [ps(NAS, "Strong"), ps(NAS, NAS), ps("Strong", "Strong"), ps("Developing", "Strong"), ps("Strong", "Strong")],
      [leaver(NAS), leaver(NAS), leaver(NAS)],
    );
    const c = attritionComposition(pc);
    expect(c.stayersN).toBe(5);
    expect(c.leaversN).toBe(3);
    expect(c.fullCohortN).toBe(8);
    expect(c.stayersEntryNasPct).toBeCloseTo(40, 9);
    expect(c.fullCohortEntryNasPct).toBeCloseTo(62.5, 9);
    expect(c.diffPp).toBeCloseTo(-22.5, 9);
  });

  it("reports a zero difference when nobody leaves", () => {
    const c = attritionComposition(cohort([ps(NAS, "Strong"), ps("Strong", "Strong")], []));
    expect(c.leaversN).toBe(0);
    expect(c.diffPp).toBeCloseTo(0, 9);
  });
});

describe("attritionCompositionSentence", () => {
  it("states the pp difference and disclaims a corrected headline", () => {
    const pc = cohort(
      [ps(NAS, "Strong"), ps(NAS, NAS), ps("Strong", "Strong"), ps("Developing", "Strong"), ps("Strong", "Strong")],
      [leaver(NAS), leaver(NAS), leaver(NAS)],
    );
    const s = attritionCompositionSentence(pc);
    expect(s).toContain("22.5 pp lower than");
    expect(s).toContain("40.0% of 5 stayers");
    expect(s).toContain("62.5% of all 8");
    expect(s).toContain("not a corrected headline");
  });

  it("handles the no-leavers case without claiming a difference", () => {
    const s = attritionCompositionSentence(cohort([ps(NAS, "Strong"), ps("Strong", "Strong")], []));
    expect(s).toContain("no students left");
    expect(s).toContain("no composition difference");
  });
});
