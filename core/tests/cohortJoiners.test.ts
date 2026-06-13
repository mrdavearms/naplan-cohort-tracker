/**
 * 1-6 — joiners analysis (exit-year mix of joiners vs stayers).
 */
import { describe, expect, it } from "vitest";
import { joinerAnalysis, type JoinerRow, type PairedCohort, type PairedStudent } from "../src/index";

const NAS = "Needs additional support";

function ps(y9: string): PairedStudent {
  return {
    localStudentId: "s",
    classGroupY7: null,
    proficiencyY7: "Developing",
    lboteStatus: null,
    atsiGroup: "Not reported",
    participationCode: "Participated",
    classGroupY9: null,
    proficiencyY9: y9,
  };
}

function joiner(y9: string | null): JoinerRow {
  return { localStudentId: "j", classGroupY9: null, proficiencyY9: y9, lboteStatusY9: null, atsiGroupY9: null, participationCode: "Participated" };
}

function cohort(paired: PairedStudent[], joiners: JoinerRow[]): PairedCohort {
  return { domain: "Reading", earlierLevel: 7, laterLevel: 9, paired, leavers: [], joiners, pairedFilteredCount: 0 };
}

describe("joinerAnalysis", () => {
  it("compares the exit-year NAS / Meeting+ mix of joiners vs stayers", () => {
    // Stayers (4): 1 NAS, 2 Strong, 1 Developing → NAS 25%, Meeting+ 50%.
    // Joiners (3): 2 NAS, 1 Exceeding → NAS 66.7%, Meeting+ 33.3%.
    const pc = cohort(
      [ps(NAS), ps("Strong"), ps("Strong"), ps("Developing")],
      [joiner(NAS), joiner(NAS), joiner("Exceeding")],
    );
    const a = joinerAnalysis(pc);
    expect(a.stayersN).toBe(4);
    expect(a.joinersN).toBe(3);
    expect(a.stayersNasCount).toBe(1);
    expect(a.joinersNasCount).toBe(2);
    expect(a.stayersNasPct).toBeCloseTo(25, 9);
    expect(a.joinersNasPct).toBeCloseTo(66.6667, 3);
    expect(a.stayersMeetingCount).toBe(2);
    expect(a.joinersMeetingCount).toBe(1);
    expect(a.joinersMeetingPct).toBeCloseTo(33.3333, 3);
  });

  it("excludes null-proficiency joiners from the counts but keeps them in n", () => {
    const a = joinerAnalysis(cohort([ps("Strong")], [joiner(NAS), joiner(null)]));
    expect(a.joinersN).toBe(2); // denominator includes the unscored joiner
    expect(a.joinersNasCount).toBe(1);
    expect(a.joinersNasPct).toBeCloseTo(50, 9);
  });

  it("is zero (no NaN) when there are no joiners", () => {
    const a = joinerAnalysis(cohort([ps("Strong")], []));
    expect(a.joinersN).toBe(0);
    expect(a.joinersNasPct).toBe(0);
    expect(a.joinersMeetingPct).toBe(0);
  });
});
