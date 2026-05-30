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
  cohortAttributionNote,
  cohortNextStep,
  cohortValueAddLabel,
  COHORT_PHASES,
  detectDomainAndYear,
  inferCohortLevels,
  mcnemarPaired,
  NAS,
  nextStepLabel,
  phaseFor,
  shortLevel,
  storeKey,
  trackablePhases,
  VALID_YEAR_LEVELS,
  yearOnYearContext,
  type LoadedFile,
  type PairedStudent,
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

  it("defines the within-school cohort pairs (incl. the P–12 Year 5→7 transition)", () => {
    expect(COHORT_PHASES).toEqual([
      { phase: "primary", earlier: 3, later: 5 },
      { phase: "transition", earlier: 5, later: 7 },
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

  it("cohortNextStep is Year 9 for a 5→7 transition, not Year 10", () => {
    expect(cohortNextStep(5, 7)).toBe("Year 9");
    expect(cohortNextStep(7, 9)).toBe("Year 10");
    expect(cohortNextStep(3, 5)).toContain("Year 6");
  });

  it("value-add label frames 5→7 as the primary–secondary transition", () => {
    expect(cohortValueAddLabel(5, 7)).toContain("transition");
    expect(cohortValueAddLabel(3, 5)).toContain("primary school's");
    expect(cohortValueAddLabel(7, 9)).toContain("secondary school's");
  });

  it("cohort attribution is role-aware: 5→7 is continuous P–12 teaching, NOT feeder", () => {
    const t = cohortAttributionNote(5, 7, 2024, 2026);
    expect(t).toContain("P–12");
    expect(t).toContain("NOT feeder");
    expect(t).toContain("2024");
    expect(t).toContain("2026");
    expect(cohortAttributionNote(7, 9, 2024, 2026)).toContain("feeder-cohort intake");
    expect(cohortAttributionNote(3, 5, 2024, 2026)).toContain("baseline");
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

describe("mcnemarPaired note is labelled by phase", () => {
  const ps = (y7: string, y9: string): PairedStudent => ({
    localStudentId: "x",
    classGroupY7: null,
    proficiencyY7: y7,
    lboteStatus: null,
    atsiGroup: null,
    participationCode: "Participated",
    classGroupY9: null,
    proficiencyY9: y9,
  });
  // one discordant pair (NAS→Strong) so the test-applicable note path runs
  const cohort = [ps(NAS, "Strong"), ps("Strong", "Strong")];

  it("uses Y3/Y5 for a primary cohort (never Y7/Y9)", () => {
    const note = mcnemarPaired(cohort, 3, 5).note;
    expect(note).toContain("Y3");
    expect(note).toContain("Y5");
    expect(note).not.toContain("Y7");
    expect(note).not.toContain("Y9");
  });

  it("defaults to Y7/Y9 when no levels are passed", () => {
    expect(mcnemarPaired(cohort).note).toContain("Y7");
  });

  it("labels the no-change note too", () => {
    const noChange = [ps("Strong", "Strong"), ps(NAS, NAS)]; // zero discordant pairs
    expect(mcnemarPaired(noChange, 3, 5).note).toContain("between Y3 and Y5");
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

describe("combined P–12 school — both cohorts (Stage 2)", () => {
  function combinedStore(): Store {
    const mk = (yr: number, lvl: number, ids: string[]) =>
      entry(yr, lvl, ids.map((id) => row(id, lvl, "Strong")));
    return new Map<string, LoadedFile>([
      [storeKey(2024, 3, "Reading"), mk(2024, 3, ["P1", "P2"])],
      [storeKey(2026, 5, "Reading"), mk(2026, 5, ["P1", "P2"])],
      [storeKey(2024, 7, "Reading"), mk(2024, 7, ["S1", "S2"])],
      [storeKey(2026, 9, "Reading"), mk(2026, 9, ["S1", "S2"])],
    ]);
  }

  it("detects BOTH phases as trackable, in school order", () => {
    expect(trackablePhases(combinedStore(), 2026)).toEqual([
      { phase: "primary", earlier: 3, later: 5 },
      { phase: "secondary", earlier: 7, later: 9 },
    ]);
  });

  it("builds the requested phase's cohort independently", () => {
    const store = combinedStore();
    const primary = buildCohortPairings(store, 2026, { phase: "primary", earlier: 3, later: 5 });
    const secondary = buildCohortPairings(store, 2026, { phase: "secondary", earlier: 7, later: 9 });
    expect(primary.get("Reading")!.earlierLevel).toBe(3);
    expect(primary.get("Reading")!.paired.map((s) => s.localStudentId).sort()).toEqual(["P1", "P2"]);
    expect(secondary.get("Reading")!.earlierLevel).toBe(7);
    expect(secondary.get("Reading")!.paired.map((s) => s.localStudentId).sort()).toEqual(["S1", "S2"]);
  });

  it("defaults to the senior (secondary) phase when none is specified", () => {
    const pc = buildCohortPairings(combinedStore(), 2026).get("Reading")!;
    expect(pc.earlierLevel).toBe(7);
  });
});

describe("P–12 Year 5 → 7 transition cohort", () => {
  // The 5→7 pair needs the SAME students: Year 5 two years before Year 7.
  function transitionStore(): Store {
    const mk = (yr: number, lvl: number, ids: string[]) =>
      entry(yr, lvl, ids.map((id) => row(id, lvl, "Strong")));
    return new Map<string, LoadedFile>([
      [storeKey(2024, 5, "Reading"), mk(2024, 5, ["T1", "T2", "T3"])],
      [storeKey(2026, 7, "Reading"), mk(2026, 7, ["T1", "T2", "T3"])],
    ]);
  }

  it("detects the transition phase as trackable for a P–12 with Year 5 (2024) + Year 7 (2026)", () => {
    expect(trackablePhases(transitionStore(), 2026)).toEqual([
      { phase: "transition", earlier: 5, later: 7 },
    ]);
  });

  it("a normal secondary school (Year 7 + 9 only) never lights up the 5→7 pair", () => {
    const secondaryOnly = new Map<string, LoadedFile>([
      [storeKey(2024, 7, "Reading"), entry(2024, 7, [row("S1", 7, "Strong")])],
      [storeKey(2026, 9, "Reading"), entry(2026, 9, [row("S1", 9, "Strong")])],
    ]);
    expect(trackablePhases(secondaryOnly, 2026)).toEqual([
      { phase: "secondary", earlier: 7, later: 9 },
    ]);
  });

  it("pairs the Year 5 → 7 cohort, recording the levels", () => {
    const pairings = buildCohortPairings(transitionStore(), 2026, {
      phase: "transition",
      earlier: 5,
      later: 7,
    });
    const pc = pairings.get("Reading")!;
    expect(pc.earlierLevel).toBe(5);
    expect(pc.laterLevel).toBe(7);
    expect(pc.paired.map((s) => s.localStudentId).sort()).toEqual(["T1", "T2", "T3"]);
  });
});
