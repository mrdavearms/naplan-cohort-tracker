/**
 * Section 8 (targeted support) unit tests with hand-built multi-domain data.
 * Oracle validation on real data comes in the end-of-Phase-2 parity run.
 */
import { describe, expect, it } from "vitest";
import { targetedSupport, type LoadedFile, type StudentReportRow } from "../src/index";

const NAS = "Needs additional support";

function student(
  id: string,
  classGroup: string | null,
  proficiency: string | null,
): StudentReportRow {
  return {
    studentId: id,
    localStudentId: id,
    localStudentIdDisplay: id,
    yearLevel: 7,
    classGroups: classGroup,
    domain: "Reading",
    proficiencyLevel: proficiency,
    participationCode: "Participated",
    indigenousStatus: null,
    lboteStatus: null,
    atsiGroup: "Not reported",
  };
}

function entry(domain: string, reports: StudentReportRow[]): LoadedFile {
  return {
    yearOfTest: 2026,
    yearLevel: 7,
    domain,
    studentReports: reports.map((r) => ({ ...r, domain })),
    studentResults: [],
    sourceFilename: `${domain}.xlsx`,
    participants: reports.length,
    totalStudents: reports.length,
  };
}

describe("targetedSupport", () => {
  it("pivots across domains, counts NAS domains, filters to NAS>=1", () => {
    const reading = entry("Reading", [
      student("S1", "7A", NAS),
      student("S2", "7A", NAS),
      student("S3", "7B", "Strong"),
      student("S4", "7B", NAS),
    ]);
    const numeracy = entry("Numeracy", [
      student("S1", "7A", NAS),
      student("S2", "7A", "Strong"),
      student("S3", "7B", "Strong"),
      // S4 didn't sit Numeracy
    ]);

    const t = targetedSupport([reading, numeracy], 7);

    expect(t.domains).toEqual(["Numeracy", "Reading"]);
    // S3 (no NAS) excluded; S1, S2, S4 remain.
    expect(t.totalNas).toBe(3);
    expect(t.multiNas).toBe(1); // only S1 is NAS in 2 domains

    // Sorted: S1 (2 NAS) first, then by class then id: S2 (7A), S4 (7B).
    expect(t.students.map((s) => s.localStudentIdDisplay)).toEqual(["S1", "S2", "S4"]);

    const s1 = t.students[0]!;
    expect(s1.nasDomains).toBe(2);
    expect(s1.proficiencyByDomain).toEqual({ Numeracy: NAS, Reading: NAS });

    const s4 = t.students.find((s) => s.localStudentIdDisplay === "S4")!;
    expect(s4.nasDomains).toBe(1);
    expect(s4.proficiencyByDomain).toEqual({ Numeracy: null, Reading: NAS }); // didn't sit Numeracy
  });

  it("returns an empty table when nobody is at NAS", () => {
    const reading = entry("Reading", [student("S1", "7A", "Strong"), student("S2", "7A", "Exceeding")]);
    const t = targetedSupport([reading], 7);
    expect(t.students).toEqual([]);
    expect(t.totalNas).toBe(0);
    expect(t.multiNas).toBe(0);
  });

  it("ignores entries from other year levels", () => {
    const y9 = { ...entry("Reading", [student("X", "9A", NAS)]), yearLevel: 9 };
    const t = targetedSupport([y9], 7);
    expect(t.students).toEqual([]);
    expect(t.domains).toEqual([]);
  });
});
