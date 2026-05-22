import { describe, expect, it } from "vitest";
import { bandMovement, type PairedCohort, type PairedStudent } from "../src/index";

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

function cohort(paired: PairedStudent[]): PairedCohort {
  return { domain: "Reading", paired, leavers: [], joiners: [], pairedFilteredCount: 0 };
}

describe("bandMovement", () => {
  it("classifies up / stayed / down by proficiency-band order", () => {
    // up=2 (NAS→Developing, Strong→Exceeding), stayed=1 (Strong→Strong), down=1 (Exceeding→Developing)
    const pc = cohort([ps(NAS, "Developing"), ps("Strong", "Exceeding"), ps("Strong", "Strong"), ps("Exceeding", "Developing")]);
    const m = bandMovement(pc);
    expect(m).toMatchObject({ up: 2, stayed: 1, down: 1, total: 4 });
    expect(m.upPct).toBeCloseTo(50, 5);
    expect(m.stayedPct).toBeCloseTo(25, 5);
    expect(m.downPct).toBeCloseTo(25, 5);
  });

  it("returns zeroes (no NaN) for an empty cohort", () => {
    const m = bandMovement(cohort([]));
    expect(m).toEqual({ up: 0, stayed: 0, down: 0, total: 0, upPct: 0, stayedPct: 0, downPct: 0 });
  });
});
