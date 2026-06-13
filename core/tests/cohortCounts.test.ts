/**
 * 1-1 — student counts beside percentages. Hand-computed expectations for the
 * `levelSetCount` primitive, the count fields on `cohortHeadline`, and the
 * counts now carried by each equity sub-cohort row.
 */
import { describe, expect, it } from "vitest";
import {
  cohortHeadline,
  equitySubCohorts,
  levelSetCount,
  type PairedCohort,
  type PairedStudent,
} from "../src/index";

const NAS = "Needs additional support";

function ps(
  y7: string,
  y9: string,
  opts: { lbote?: string | null; atsi?: string | null } = {},
): PairedStudent {
  return {
    localStudentId: "x",
    classGroupY7: null,
    proficiencyY7: y7,
    lboteStatus: opts.lbote ?? null,
    atsiGroup: opts.atsi ?? "Not reported",
    participationCode: "Participated",
    classGroupY9: null,
    proficiencyY9: y9,
  };
}

function cohort(paired: PairedStudent[]): PairedCohort {
  return { domain: "Reading", earlierLevel: 7, laterLevel: 9, paired, leavers: [], joiners: [], pairedFilteredCount: 0 };
}

// Five paired students, hand-chosen so every count is distinct and checkable:
//   A: NAS → Strong       (left NAS, now Meeting+)
//   B: NAS → Developing    (left NAS, not Meeting+)
//   C: NAS → NAS           (stalled)
//   D: Strong → Strong     (Meeting+ both years)
//   E: Developing → NAS    (into NAS)
const SAMPLE = cohort([
  ps(NAS, "Strong"),
  ps(NAS, "Developing"),
  ps(NAS, NAS),
  ps("Strong", "Strong"),
  ps("Developing", NAS),
]);

describe("levelSetCount", () => {
  const isNas = (l: string) => l === NAS;
  const isMeeting = (l: string) => l === "Strong" || l === "Exceeding";

  it("counts the level set for either year", () => {
    expect(levelSetCount(SAMPLE.paired, "Y7", isNas)).toBe(3); // A,B,C
    expect(levelSetCount(SAMPLE.paired, "Y9", isNas)).toBe(2); // C,E
    expect(levelSetCount(SAMPLE.paired, "Y7", isMeeting)).toBe(1); // D
    expect(levelSetCount(SAMPLE.paired, "Y9", isMeeting)).toBe(2); // A,D
  });

  it("is zero on an empty cohort", () => {
    expect(levelSetCount([], "Y7", isNas)).toBe(0);
  });
});

describe("cohortHeadline counts", () => {
  it("carries the student count behind every percentage and delta", () => {
    const h = cohortHeadline(SAMPLE);
    expect(h.pairedN).toBe(5);
    expect(h.y7NasCount).toBe(3);
    expect(h.y9NasCount).toBe(2);
    expect(h.deltaNasCount).toBe(-1); // one fewer at NAS
    expect(h.y7MeetingCount).toBe(1);
    expect(h.y9MeetingCount).toBe(2);
    expect(h.deltaMeetingCount).toBe(1); // one more Meeting+
    // Percentages stay consistent with the counts (5 paired).
    expect(h.y7NasPct).toBeCloseTo(60, 9);
    expect(h.y9NasPct).toBeCloseTo(40, 9);
    expect(h.deltaNasPp).toBeCloseTo(-20, 9);
    expect(h.deltaMeetingPp).toBeCloseTo(20, 9);
  });

  it("is all-zero (no NaN) for an empty cohort", () => {
    const h = cohortHeadline(cohort([]));
    expect(h).toMatchObject({ y7NasCount: 0, y9NasCount: 0, deltaNasCount: 0, y7NasPct: 0, deltaNasPp: 0 });
  });
});

describe("equity sub-cohort counts", () => {
  it("exposes the NAS counts behind each visible row, null when suppressed", () => {
    // Five LBOTE-Yes students (n=5, shown): 2 NAS at Y7, 1 NAS at Y9.
    const paired = [
      ps(NAS, NAS, { lbote: "Yes" }),
      ps(NAS, "Developing", { lbote: "Yes" }),
      ps("Strong", "Strong", { lbote: "Yes" }),
      ps("Developing", "Strong", { lbote: "Yes" }),
      ps("Strong", "Strong", { lbote: "Yes" }),
    ];
    const rows = equitySubCohorts(cohort(paired));
    const yes = rows.find((r) => r.subgroup === "LBOTE Yes (Y7)")!;
    expect(yes.n).toBe(5);
    expect(yes.suppressed).toBe(false);
    expect(yes.y7NasCount).toBe(2);
    expect(yes.y9NasCount).toBe(1);

    // The empty ATSI group is suppressed → counts null.
    const atsi = rows.find((r) => r.subgroup === "Aboriginal and/or TSI (Y7)")!;
    expect(atsi.suppressed).toBe(true);
    expect(atsi.y7NasCount).toBeNull();
    expect(atsi.y9NasCount).toBeNull();
  });
});
