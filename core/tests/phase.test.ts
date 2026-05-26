/**
 * Stage-1 plumbing tests for primary (Year 3 → 5) support. The statistical
 * engine is already proven against the oracle for 7/9 and is level-agnostic, so
 * these tests only cover the new plumbing: phase classification + wording, the
 * loader accepting Year 3/5, and buildCohortPairings detecting and pairing the
 * primary phase. Synthetic data — no .xlsx fixtures needed for this.
 */
import { describe, expect, it } from "vitest";
import {
  attributionNote,
  buildCohortPairings,
  COHORT_PHASES,
  detectDomainAndYear,
  inferCohortLevels,
  nextStepLabel,
  phaseFor,
  shortLevel,
  storeKey,
  trackablePhases,
  VALID_YEAR_LEVELS,
  yearOnYearContext,
  type LoadedFile,
  type Store,
  type StudentReportRow,
} from "../src/index";

function row(localStudentId: string, yearLevel: number, proficiencyLevel: string): StudentReportRow {
  return {
    studentId: `psi-${localStudentId}`,
    localStudentId,
    localStudentIdDisplay: localStudentId,
    yearLevel,
    classGroups: null,
    domain: "Reading",
    proficiencyLevel,
    participationCode: "Participated",
    indigenousStatus: null,
    lboteStatus: null,
    atsiGroup: "Not reported",
  };
}

function entry(yearOfTest: number, yearLevel: number, reports: StudentReportRow[]): LoadedFile {
  return {
    yearOfTest,
    yearLevel,
    domain: "Reading",
    studentReports: reports,
    studentResults: [],
    sourceFilename: `test-${yearLevel}.xlsx`,
    participants: reports.length,
    totalStudents: reports.length,
  };
}

describe("phase classification + wording", () => {
  it("maps year levels to the right phase", () => {
    expect(phaseFor(3)).toBe("primary");
    expect(phaseFor(5)).toBe("primary");
    expect(phaseFor(7)).toBe("secondary");
    expect(phaseFor(9)).toBe("secondary");
  });

  it("defines the two within-school cohort pairs", () => {
    expect(COHORT_PHASES).toEqual([
      { phase: "primary", earlier: 3, later: 5 },
      { phase: "secondary", earlier: 7, later: 9 },
    ]);
    expect(shortLevel(3)).toBe("Y3");
  });

  it("frames Year 3 as a baseline (NOT feeder) and Year 7 as feeder", () => {
    const y3 = attributionNote(3, 2026);
    expect(y3).toContain("Year 3");
    expect(y3).toContain("baseline");
    expect(y3).not.toContain("feeder");
    expect(attributionNote(5, 2026)).toContain("primary");
    expect(attributionNote(7, 2026)).toContain("feeder");
    expect(attributionNote(9, 2026)).toContain("secondary");
  });

  it("gives the right next-step for each phase", () => {
    expect(nextStepLabel("primary")).toContain("Year 6");
    expect(nextStepLabel("secondary")).toBe("Year 10");
  });

  it("infers cohort levels from the data, preferring the senior phase", () => {
    expect(inferCohortLevels([3, 5])).toEqual({ earlier: 3, later: 5 });
    expect(inferCohortLevels([7, 9])).toEqual({ earlier: 7, later: 9 });
    expect(inferCohortLevels([3, 5, 7, 9])).toEqual({ earlier: 7, later: 9 });
  });

  it("year-on-year context is phase-correct", () => {
    expect(yearOnYearContext(3)).toContain("baseline");
    expect(yearOnYearContext(3)).not.toContain("secondary");
    expect(yearOnYearContext(7)).toContain("feeder");
  });
});

describe("loader accepts Year 3 and Year 5", () => {
  it("VALID_YEAR_LEVELS includes 3, 5, 7 and 9", () => {
    expect([...VALID_YEAR_LEVELS]).toEqual([3, 5, 7, 9]);
  });

  it("detectDomainAndYear does not reject a Year 3 set", () => {
    expect(detectDomainAndYear([row("A", 3, "Strong")])).toEqual({ domain: "Reading", yearLevel: 3 });
    expect(detectDomainAndYear([row("A", 5, "Strong")])).toEqual({ domain: "Reading", yearLevel: 5 });
  });
});

describe("buildCohortPairings — primary Year 3 → 5", () => {
  function primaryStore(): Store {
    const y3 = entry(2024, 3, [
      row("S1", 3, "Needs additional support"),
      row("S2", 3, "Developing"),
      row("S3", 3, "Strong"),
    ]);
    const y5 = entry(2026, 5, [
      row("S1", 5, "Developing"), // improved out of NAS
      row("S2", 5, "Strong"),
      row("S3", 5, "Strong"),
    ]);
    return new Map<string, LoadedFile>([
      [storeKey(2024, 3, "Reading"), y3],
      [storeKey(2026, 5, "Reading"), y5],
    ]);
  }

  it("detects the primary phase as trackable", () => {
    const phases = trackablePhases(primaryStore(), 2026);
    expect(phases).toEqual([{ phase: "primary", earlier: 3, later: 5 }]);
  });

  it("pairs the Year 3 and Year 5 cohort, recording the levels", () => {
    const pairings = buildCohortPairings(primaryStore(), 2026);
    expect(pairings.has("Reading")).toBe(true);
    const pc = pairings.get("Reading")!;
    expect(pc.earlierLevel).toBe(3);
    expect(pc.laterLevel).toBe(5);
    expect(pc.paired.map((s) => s.localStudentId).sort()).toEqual(["S1", "S2", "S3"]);
  });
});
