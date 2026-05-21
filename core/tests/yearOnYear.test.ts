/**
 * Section 3 (year-on-year NAS) unit tests. nasSummary reuses the
 * oracle-validated proficiency helpers; these pin the delta + status logic.
 */
import { describe, expect, it } from "vitest";
import {
  nasSummary,
  statusForCountDelta,
  yearOnYearNas,
  type StudentReportRow,
  type YearOnYearPoint,
} from "../src/index";

const NAS = "Needs additional support";

function r(proficiency: string, participation = "Participated"): StudentReportRow {
  return {
    studentId: null,
    localStudentId: null,
    localStudentIdDisplay: "*",
    yearLevel: 7,
    classGroups: null,
    domain: "Reading",
    proficiencyLevel: proficiency,
    participationCode: participation,
    indigenousStatus: null,
    lboteStatus: null,
    atsiGroup: "Not reported",
  };
}

describe("nasSummary", () => {
  it("counts NAS over participants and excludes non-participants", () => {
    const reports = [r(NAS), r(NAS), r("Strong"), r("Strong"), r("Strong"), r(NAS, "Absent")];
    const s = nasSummary(reports);
    expect(s.participants).toBe(5); // the Absent row is excluded
    expect(s.nasCount).toBe(2);
    expect(s.nasPct).toBeCloseTo(40, 10);
  });
});

describe("statusForCountDelta", () => {
  it("is flat within +/-2 students", () => {
    expect(statusForCountDelta(0)).toBe("flat");
    expect(statusForCountDelta(2)).toBe("flat");
    expect(statusForCountDelta(-2)).toBe("flat");
  });
  it("improved when NAS falls by >2", () => {
    expect(statusForCountDelta(-3)).toBe("improved");
  });
  it("worsened when NAS rises by >2", () => {
    expect(statusForCountDelta(3)).toBe("worsened");
  });
});

describe("yearOnYearNas", () => {
  const point = (year: number, nasCount: number, nasPct: number): YearOnYearPoint => ({
    year,
    summary: { nasCount, nasPct, participants: 50 },
  });

  it("returns no_data with fewer than two years", () => {
    expect(yearOnYearNas([]).status).toBe("no_data");
    expect(yearOnYearNas([point(2026, 5, 10)]).status).toBe("no_data");
  });

  it("compares earliest vs latest (sorted), reporting deltas + status", () => {
    // Out of order on input; should sort to 2024 -> 2026.
    const change = yearOnYearNas([point(2026, 4, 8), point(2024, 10, 20)]);
    expect(change.history.map((p) => p.year)).toEqual([2024, 2026]);
    expect(change.countDelta).toBe(-6);
    expect(change.pctDelta).toBeCloseTo(-12, 10);
    expect(change.status).toBe("improved");
  });
});
