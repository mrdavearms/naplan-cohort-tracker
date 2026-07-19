/**
 * Loader normalisation tests. Blank / whitespace-only Local student IDs must
 * behave exactly like missing ones: they fall back to `{PSI}*` and never key a
 * cross-year join (see CLAUDE.md "Keying rule — critical").
 */
import { describe, expect, it } from "vitest";
import {
  buildStore,
  cleanStudentReports,
  detectDomainAndYear,
  LoaderError,
  type ParsedSheet,
  type ParsedWorkbook,
} from "../src/index";

const HEADERS = [
  "Student ID",
  "Local student ID",
  "Year level",
  "Class groups",
  "Domain",
  "Proficiency level",
  "Participation code",
  "Indigenous Status",
  "LBOTE Status",
];

function sheet(localIds: (string | null)[]): ParsedSheet {
  return {
    headers: HEADERS,
    rows: localIds.map((localId, i) => ({
      "Student ID": `PSI${i + 1}`,
      "Local student ID": localId,
      "Year level": 7,
      "Class groups": "7A",
      Domain: "Reading",
      "Proficiency level": "Strong",
      "Participation code": "Participated",
      "Indigenous Status": "Neither Aboriginal nor Torres Strait Islander origin",
      "LBOTE Status": "No",
    })),
  };
}

describe("cleanStudentReports — blank Local student ID normalisation", () => {
  it("treats an empty-string Local student ID as missing", () => {
    const [row] = cleanStudentReports(sheet([""]));
    expect(row!.localStudentId).toBeNull();
    expect(row!.localStudentIdDisplay).toBe("PSI1*");
  });

  it("treats a whitespace-only Local student ID as missing", () => {
    const [row] = cleanStudentReports(sheet(["   "]));
    expect(row!.localStudentId).toBeNull();
    expect(row!.localStudentIdDisplay).toBe("PSI1*");
  });

  it("trims surrounding whitespace so the same ID matches across years", () => {
    const [padded, plain] = cleanStudentReports(sheet([" 12345", "12345"]));
    expect(padded!.localStudentId).toBe("12345");
    expect(plain!.localStudentId).toBe("12345");
    expect(padded!.localStudentId).toBe(plain!.localStudentId);
  });

  it("gives distinct blank-ID students distinct display IDs (no collapse)", () => {
    const rows = cleanStudentReports(sheet(["", ""]));
    expect(rows.map((r) => r.localStudentIdDisplay)).toEqual(["PSI1*", "PSI2*"]);
  });

  it("leaves a normal Local student ID untouched", () => {
    const [row] = cleanStudentReports(sheet(["A9981"]));
    expect(row!.localStudentId).toBe("A9981");
    expect(row!.localStudentIdDisplay).toBe("A9981");
  });
});

function reportsWithProficiency(levels: (string | null)[]) {
  return cleanStudentReports({
    headers: HEADERS,
    rows: levels.map((level, i) => ({
      "Student ID": `PSI${i + 1}`,
      "Local student ID": `L${i + 1}`,
      "Year level": 7,
      "Class groups": "7A",
      Domain: "Reading",
      "Proficiency level": level,
      "Participation code": "Participated",
      "Indigenous Status": "Neither Aboriginal nor Torres Strait Islander origin",
      "LBOTE Status": "No",
    })),
  });
}

describe("detectDomainAndYear — proficiency vocabulary validation", () => {
  it("accepts the four canonical levels", () => {
    const reports = reportsWithProficiency([
      "Needs additional support",
      "Developing",
      "Strong",
      "Exceeding",
    ]);
    expect(detectDomainAndYear(reports)).toEqual({ domain: "Reading", yearLevel: 7 });
  });

  it("accepts null proficiency (Absent / Withdrawn students)", () => {
    const reports = reportsWithProficiency(["Strong", null]);
    expect(detectDomainAndYear(reports)).toEqual({ domain: "Reading", yearLevel: 7 });
  });

  it("rejects a re-cased level rather than silently reading it as zero", () => {
    const reports = reportsWithProficiency(["Needs Additional Support"]);
    expect(() => detectDomainAndYear(reports)).toThrow(LoaderError);
    expect(() => detectDomainAndYear(reports)).toThrow(/Needs Additional Support/);
  });

  it("names every unrecognised value in the error", () => {
    const reports = reportsWithProficiency(["Strong", "Emerging", "Consolidating"]);
    expect(() => detectDomainAndYear(reports)).toThrow(/Emerging/);
    expect(() => detectDomainAndYear(reports)).toThrow(/Consolidating/);
  });
});

/** Minimal in-memory workbook carrying just a Student Reports sheet. */
function reportsWorkbook(domain: string, yearLevel: number, proficiency: string): ParsedWorkbook {
  const s: ParsedSheet = {
    headers: HEADERS,
    rows: [
      {
        "Student ID": "PSI1",
        "Local student ID": "L1",
        "Year level": yearLevel,
        "Class groups": "7A",
        Domain: domain,
        "Proficiency level": proficiency,
        "Participation code": "Participated",
        "Indigenous Status": "Neither Aboriginal nor Torres Strait Islander origin",
        "LBOTE Status": "No",
      },
    ],
  };
  return {
    sheetNames: ["Student Reports"],
    sheet: (name) => (name === "Student Reports" ? s : null),
  };
}

describe("buildStore — duplicate key reporting", () => {
  it("reports a superseded duplicate in `skipped` and keeps the last file", () => {
    const { store, skipped } = buildStore([
      { filename: "Reading.xlsx", yearOfTest: 2026, workbook: reportsWorkbook("Reading", 7, "Strong") },
      { filename: "Reading (1).xlsx", yearOfTest: 2026, workbook: reportsWorkbook("Reading", 7, "Developing") },
    ]);

    // Both are reports-only, so neither registers without a results partner —
    // but the DUPLICATE must be reported before the pairing stage discards it.
    const dupes = skipped.filter((s) => /already loaded|duplicate/i.test(s.reason));
    expect(dupes).toHaveLength(1);
    expect(dupes[0]!.filename).toBe("Reading.xlsx");
    expect(dupes[0]!.reason).toContain("Reading (1).xlsx");
    expect(store.size).toBe(0);
  });

  it("does not report distinct keys as duplicates", () => {
    const { skipped } = buildStore([
      { filename: "Reading.xlsx", yearOfTest: 2026, workbook: reportsWorkbook("Reading", 7, "Strong") },
      { filename: "Numeracy.xlsx", yearOfTest: 2026, workbook: reportsWorkbook("Numeracy", 7, "Strong") },
    ]);
    expect(skipped.filter((s) => /already loaded|duplicate/i.test(s.reason))).toHaveLength(0);
  });
});
