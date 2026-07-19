/**
 * Loader normalisation tests. Blank / whitespace-only Local student IDs must
 * behave exactly like missing ones: they fall back to `{PSI}*` and never key a
 * cross-year join (see CLAUDE.md "Keying rule — critical").
 */
import { describe, expect, it } from "vitest";
import { cleanStudentReports, type ParsedSheet } from "../src/index";

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
