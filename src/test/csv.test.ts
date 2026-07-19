/**
 * CSV serialisation. Exported tables carry Local Student IDs only — never
 * names — so these tests also guard the privacy invariant at the export edge.
 */
import { describe, expect, it } from "vitest";
import { toCsv } from "../lib/csv";
import { targetedSupport, getPrimaryYearEntries } from "@naplan-cohort-tracker/core";
import { buildSyntheticStore } from "./fixtures";

describe("toCsv", () => {
  it("writes a header row and one row per record", () => {
    expect(toCsv(["ID", "Class"], [["L1", "7A"], ["L2", "7B"]])).toBe("ID,Class\r\nL1,7A\r\nL2,7B");
  });

  it("quotes fields containing a comma", () => {
    expect(toCsv(["Name"], [["Smith, J"]])).toBe('Name\r\n"Smith, J"');
  });

  it("escapes embedded double quotes by doubling them", () => {
    expect(toCsv(["Note"], [['He said "hi"']])).toBe('Note\r\n"He said ""hi"""');
  });

  it("quotes fields containing newlines", () => {
    expect(toCsv(["Note"], [["line1\nline2"]])).toBe('Note\r\n"line1\nline2"');
  });

  it("renders null as an empty field", () => {
    expect(toCsv(["A", "B"], [[null, 3]])).toBe("A,B\r\n,3");
  });

  it("handles an empty row set", () => {
    expect(toCsv(["A", "B"], [])).toBe("A,B");
  });
});

describe("Section 8 CSV contents", () => {
  it("contains Local Student IDs and no student names", async () => {
    const store = await buildSyntheticStore();
    const table = targetedSupport(getPrimaryYearEntries(store, 2026), 9);
    const headers = ["Local Student ID", "Class group", "NAS domains", ...table.domains];
    const rows = table.students.map((s) => [
      s.localStudentIdDisplay,
      s.classGroup ?? "",
      s.nasDomains,
      ...table.domains.map((dom) => s.proficiencyByDomain[dom] ?? ""),
    ]);
    const csv = toCsv(headers, rows);
    const dataOnly = toCsv([], rows);

    expect(csv).toContain("Local Student ID");
    expect(csv).not.toMatch(/Student name|Student Name/);
    // No data field may look like a personal name (two capitalised words). Checked
    // against the data rows only — the header legitimately contains phrases like
    // "Local Student ID" that would false-positive against the full CSV.
    expect(dataOnly).not.toMatch(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/);
  });
});
