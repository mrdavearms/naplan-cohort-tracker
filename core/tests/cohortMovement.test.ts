import { describe, expect, it } from "vitest";
import {
  bandMovement,
  crossDomainSummary,
  declinedOrStalled,
  subdomainMovement,
  type PairedCohort,
  type PairedStudent,
  type StudentResultRow,
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

function cohort(paired: PairedStudent[]): PairedCohort {
  return { domain: "Reading", earlierLevel: 7, laterLevel: 9, paired, leavers: [], joiners: [], pairedFilteredCount: 0 };
}

function psFull(id: string, y7: string, y9: string, cg7: string | null, cg9: string | null): PairedStudent {
  return {
    localStudentId: id,
    classGroupY7: cg7,
    proficiencyY7: y7,
    lboteStatus: null,
    atsiGroup: "Not reported",
    participationCode: "Participated",
    classGroupY9: cg9,
    proficiencyY9: y9,
  };
}

describe("declinedOrStalled", () => {
  it("lists students who dropped a band and those who stalled at NAS", () => {
    const pc: PairedCohort = {
      domain: "Reading",
      earlierLevel: 7,
      laterLevel: 9,
      paired: [
        psFull("A", "Strong", "Developing", "07A", "09A"), // declined
        psFull("B", NAS, NAS, "07B", "09C"), // stalled at NAS
        psFull("C", "Developing", "Strong", "07A", "09A"), // improved (excluded)
        psFull("D", "Exceeding", NAS, "07A", "09B"), // declined (and ends at NAS, but NOT stalled — Y7 wasn't NAS)
      ],
      leavers: [],
      joiners: [],
      pairedFilteredCount: 0,
    };
    const r = declinedOrStalled(pc);
    expect(r.declined.map((s) => s.localStudentId)).toEqual(["A", "D"]);
    expect(r.stalled.map((s) => s.localStudentId)).toEqual(["B"]);
    expect(r.declined[0]).toMatchObject({
      localStudentId: "A",
      classGroupY7: "07A",
      classGroupY9: "09A",
      proficiencyY7: "Strong",
      proficiencyY9: "Developing",
    });
  });
});

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

describe("crossDomainSummary", () => {
  it("returns one row per paired domain with NAS%, Meeting+% and movement", () => {
    const reading = cohort([ps(NAS, "Strong"), ps("Strong", "Strong"), ps("Exceeding", "Developing")]);
    const pairings = new Map<string, PairedCohort>([["Reading", reading]]);
    const rows = crossDomainSummary(pairings);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.domain).toBe("Reading");
    expect(rows[0]!.pairedN).toBe(3);
    // movement: up=1 (NAS→Strong), stayed=1 (Strong→Strong), down=1 (Exceeding→Developing)
    expect(rows[0]!.movement).toMatchObject({ up: 1, stayed: 1, down: 1 });
    expect(typeof rows[0]!.y7NasPct).toBe("number");
    expect(typeof rows[0]!.y9MeetingPct).toBe("number");
  });
});

describe("subdomainMovement", () => {
  const r = (subdomain: string, marked: string): StudentResultRow => ({
    studentPsi: "p",
    yearLevel: 9,
    classGroups: null,
    itemId: "i",
    itemDifficulty: 500,
    domain: "Numeracy",
    subdomain,
    descriptor: "d",
    studentMarkedResponse: marked,
    difficultyBand: "480-580",
  });

  it("computes Y7 vs Y9 % correct per subdomain for any domain", () => {
    const y7 = [r("Number", "Correct"), r("Number", "Incorrect")]; // 50%
    const y9 = [r("Number", "Correct"), r("Number", "Correct")]; // 100%
    const out = subdomainMovement(y7, y9);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ subdomain: "Number", y7PctCorrect: 50, y9PctCorrect: 100, deltaPp: 50 });
  });
});
