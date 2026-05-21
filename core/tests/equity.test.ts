/**
 * Section 6 (equity) unit tests with hand-verified data. The synthetic fixtures
 * use "Y"/"N" LBOTE values (real data uses "Yes"/"No"), so equity can't be
 * exercised on them — Section 6 is oracle-validated against real data in the
 * end-of-Phase-2 parity run. These tests pin the suppression + gap logic.
 */
import { describe, expect, it } from "vitest";
import { equityBreakdown, PRIVACY_THRESHOLD, type StudentReportRow } from "../src/index";

function row(
  lbote: string | null,
  atsiGroup: string,
  proficiency: string,
): StudentReportRow {
  return {
    studentId: null,
    localStudentId: null,
    localStudentIdDisplay: "*",
    yearLevel: 7,
    classGroups: null,
    domain: "Reading",
    proficiencyLevel: proficiency,
    participationCode: "Participated",
    indigenousStatus: null,
    lboteStatus: lbote,
    atsiGroup,
  };
}

const NAS = "Needs additional support";

describe("equityBreakdown — Indigenous suppression", () => {
  it("suppresses ATSI when count < threshold", () => {
    const reports = [
      row("No", "ATSI", "Strong"),
      row("No", "ATSI", NAS),
      row("No", "Non-ATSI", "Strong"),
      row("No", "Non-ATSI", "Strong"),
    ];
    const eq = equityBreakdown(reports);
    expect(PRIVACY_THRESHOLD).toBe(5);
    expect(eq.atsiCount).toBe(2);
    expect(eq.atsiSuppressed).toBe(true);
    expect(eq.atsi).toEqual([]);
  });

  it("reports ATSI subgroups when count >= threshold, with the gap flagged", () => {
    // 5 ATSI (2 NAS = 40%), 5 Non-ATSI (0 NAS). Cohort NAS = 2/10 = 20%.
    const reports = [
      row("No", "ATSI", NAS),
      row("No", "ATSI", NAS),
      row("No", "ATSI", "Strong"),
      row("No", "ATSI", "Strong"),
      row("No", "ATSI", "Developing"),
      row("No", "Non-ATSI", "Strong"),
      row("No", "Non-ATSI", "Strong"),
      row("No", "Non-ATSI", "Strong"),
      row("No", "Non-ATSI", "Exceeding"),
      row("No", "Non-ATSI", "Developing"),
    ];
    const eq = equityBreakdown(reports);
    expect(eq.cohortNasPct).toBeCloseTo(20, 10);
    expect(eq.atsiSuppressed).toBe(false);
    const atsi = eq.atsi.find((g) => g.label.startsWith("Aboriginal"))!;
    expect(atsi.n).toBe(5);
    expect(atsi.percentages[NAS]).toBeCloseTo(40, 10);
    expect(atsi.nasGapVsCohort).toBeCloseTo(20, 10);
    expect(atsi.priorityGap).toBe(true);
    const nonAtsi = eq.atsi.find((g) => g.label === "Non-Indigenous")!;
    expect(nonAtsi.percentages[NAS]).toBeCloseTo(0, 10);
    expect(nonAtsi.priorityGap).toBe(false);
  });
});

describe("equityBreakdown — LBOTE", () => {
  it("splits Yes/No and flags a priority gap", () => {
    // 4 LBOTE (2 NAS = 50%), 4 Non-LBOTE (0 NAS). Cohort NAS = 2/8 = 25%.
    const reports = [
      row("Yes", "Not reported", NAS),
      row("Yes", "Not reported", NAS),
      row("Yes", "Not reported", "Developing"),
      row("Yes", "Not reported", "Strong"),
      row("No", "Not reported", "Strong"),
      row("No", "Not reported", "Strong"),
      row("No", "Not reported", "Strong"),
      row("No", "Not reported", "Exceeding"),
    ];
    const eq = equityBreakdown(reports);
    expect(eq.lboteReported).toBe(true);
    expect(eq.cohortNasPct).toBeCloseTo(25, 10);
    const lbote = eq.lbote.find((g) => g.label === "LBOTE")!;
    expect(lbote.n).toBe(4);
    expect(lbote.percentages[NAS]).toBeCloseTo(50, 10);
    expect(lbote.nasGapVsCohort).toBeCloseTo(25, 10);
    expect(lbote.priorityGap).toBe(true);
    expect(eq.atsiSuppressed).toBe(true); // 0 ATSI
  });

  it("marks LBOTE unreported when no Yes/No present", () => {
    const reports = [row(null, "Non-ATSI", "Strong"), row(null, "Non-ATSI", NAS)];
    expect(equityBreakdown(reports).lboteReported).toBe(false);
  });
});
