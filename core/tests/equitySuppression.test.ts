/**
 * Section 6 suppression tests. Every equity subgroup below the privacy
 * threshold (n < 5) must be suppressed, not just the ATSI count — n=5 is shown,
 * n=4 is suppressed (CLAUDE.md privacy invariant).
 */
import { describe, expect, it } from "vitest";
import { equityBreakdown, PRIVACY_THRESHOLD } from "../src/index";
import type { StudentReportRow } from "../src/types";

function student(over: Partial<StudentReportRow>): StudentReportRow {
  return {
    studentId: "PSI",
    localStudentId: "L",
    localStudentIdDisplay: "L",
    yearLevel: 7,
    classGroups: "7A",
    domain: "Reading",
    proficiencyLevel: "Strong",
    participationCode: "Participated",
    indigenousStatus: "Neither Aboriginal nor Torres Strait Islander origin",
    lboteStatus: "No",
    atsiGroup: "Non-ATSI",
    ...over,
  };
}

const many = (n: number, over: Partial<StudentReportRow>) =>
  Array.from({ length: n }, (_, i) => student({ ...over, localStudentIdDisplay: `L${i}` }));

describe("equityBreakdown — subgroup suppression", () => {
  it("suppresses an LBOTE subgroup below the threshold", () => {
    const reports = [...many(3, { lboteStatus: "Yes" }), ...many(20, { lboteStatus: "No" })];
    const b = equityBreakdown(reports);
    const lboteYes = b.lbote.find((g) => g.label === "LBOTE")!;
    expect(lboteYes.suppressed).toBe(true);
    expect(lboteYes.n).toBe(3);
    expect(lboteYes.priorityGap).toBe(false);
    expect(b.lboteSuppressed).toBe(true);
  });

  it("shows an LBOTE subgroup at exactly the threshold (n=5 is shown)", () => {
    const reports = [...many(5, { lboteStatus: "Yes" }), ...many(20, { lboteStatus: "No" })];
    const b = equityBreakdown(reports);
    expect(b.lbote.find((g) => g.label === "LBOTE")!.suppressed).toBe(false);
    expect(b.lboteSuppressed).toBe(false);
  });

  it("suppresses a small Non-ATSI subgroup even when the ATSI group is large", () => {
    const reports = [
      ...many(40, { atsiGroup: "ATSI", indigenousStatus: "Aboriginal but not Torres Strait Islander origin" }),
      ...many(3, { atsiGroup: "Non-ATSI" }),
    ];
    const b = equityBreakdown(reports);
    expect(b.atsiSuppressed).toBe(false); // 40 ATSI students — the ATSI group itself is shown
    expect(b.nonAtsiSuppressed).toBe(true);
    expect(b.atsi.find((g) => g.label === "Non-Indigenous")!.suppressed).toBe(true);
    expect(b.atsi.find((g) => g.label.startsWith("Aboriginal"))!.suppressed).toBe(false);
  });

  it("zeroes the percentages of a suppressed subgroup so no figure can leak", () => {
    const reports = [...many(2, { lboteStatus: "Yes", proficiencyLevel: "Needs additional support" }), ...many(20, { lboteStatus: "No" })];
    const lboteYes = equityBreakdown(reports).lbote.find((g) => g.label === "LBOTE")!;
    expect(lboteYes.suppressed).toBe(true);
    for (const value of Object.values(lboteYes.percentages)) expect(value).toBe(0);
    expect(lboteYes.nasGapVsCohort).toBe(0);
  });

  it("keeps the threshold at 5", () => {
    expect(PRIVACY_THRESHOLD).toBe(5);
  });
});
