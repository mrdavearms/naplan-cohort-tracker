/**
 * Tests for the Phase 4 core additions that the UI/Tauri shell consumes:
 * settings migration, the filesystem-free load pipeline, store selectors, and
 * the cohort-pairing builder + match-rate summary.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import {
  availableYears,
  buildCohortPairings,
  cleanStudentReports,
  cohortMatchRate,
  cohortYears,
  defaultSettings,
  domainsFor,
  getEntry,
  loadStoreFromFiles,
  migrate,
  parseWorkbook,
  resolveYearOfTest,
  SETTINGS_SCHEMA_VERSION,
  storeEntries,
  storeKey,
  trackablePhases,
  type LoadedFile,
  type RawWorkbookFile,
  type Store,
} from "../src/index";

const here = dirname(fileURLToPath(import.meta.url));
const bytes = (name: string): Uint8Array => readFileSync(join(here, "fixtures", name));

describe("settings.migrate", () => {
  it("returns neutral defaults for null/garbage (no school identity)", () => {
    for (const bad of [null, undefined, 42, "x", []]) {
      const s = migrate(bad);
      expect(s.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION);
      expect(s.schoolName).toBe("");
      expect(s.improvementPlanRefs).toEqual([]);
      expect(s.trackedDomains).toEqual(["Reading", "Numeracy"]);
    }
  });

  it("preserves valid persisted settings", () => {
    const s = migrate({
      schemaVersion: 1,
      schoolName: "Example Secondary College",
      schoolNumber: "1234",
      planLabel: "AIP",
      improvementPlanRefs: [{ role: "data-inquiry", code: "KIS 1.b", description: "Year 7 group" }],
      trackedDomains: ["Reading", "Numeracy", "Spelling"],
    });
    expect(s.schoolName).toBe("Example Secondary College");
    expect(s.schoolNumber).toBe("1234");
    expect(s.planLabel).toBe("AIP");
    expect(s.improvementPlanRefs).toHaveLength(1);
    expect(s.improvementPlanRefs[0]).toEqual({
      role: "data-inquiry",
      code: "KIS 1.b",
      description: "Year 7 group",
    });
    expect(s.trackedDomains).toEqual(["Reading", "Numeracy", "Spelling"]);
  });

  it("drops malformed plan refs without throwing", () => {
    const s = migrate({
      schoolName: "X",
      improvementPlanRefs: [{ role: "a", code: "C" }, { role: "no-code" }, "junk", null],
    });
    expect(s.improvementPlanRefs).toEqual([{ role: "a", code: "C" }]);
  });

  it("defaultSettings is a fresh neutral object each call", () => {
    const a = defaultSettings();
    a.schoolName = "mutated";
    expect(defaultSettings().schoolName).toBe("");
  });
});

describe("pipeline.resolveYearOfTest", () => {
  it("prefers the year in a parent folder over the file name", () => {
    expect(resolveYearOfTest("Naplan 2026/SSSR Extract Reading 2099.xlsx", "SSSR Extract Reading 2099.xlsx")).toBe(2026);
  });
  it("falls back to the file name when no folder year", () => {
    expect(resolveYearOfTest("SSSR Extract Reading 2024.xlsx", "SSSR Extract Reading 2024.xlsx")).toBe(2024);
  });
  it("handles Windows-style separators", () => {
    expect(resolveYearOfTest("Naplan 2025\\sub\\file.xlsx", "file.xlsx")).toBe(2025);
  });
  it("returns null when no year anywhere", () => {
    expect(resolveYearOfTest("data/file.xlsx", "file.xlsx")).toBeNull();
  });
});

describe("pipeline.loadStoreFromFiles", () => {
  it("loads a full 2026 workbook into the keyed store", async () => {
    const files: RawWorkbookFile[] = [
      {
        name: "synthetic_raw_2026.xlsx",
        relativePath: "Naplan 2026/synthetic_raw_2026.xlsx",
        bytes: bytes("synthetic_raw_2026.xlsx"),
      },
    ];
    const { store, skipped, unresolved } = await loadStoreFromFiles(files);
    expect(unresolved).toEqual([]);
    expect(skipped).toEqual([]);
    expect(store.size).toBeGreaterThanOrEqual(1);
    expect(availableYears(store)).toContain(2026);
    expect(storeEntries(store).every((e) => e.yearOfTest === 2026)).toBe(true);
  });

  it("reports files whose year cannot be resolved", async () => {
    const files: RawWorkbookFile[] = [
      { name: "mystery.xlsx", relativePath: "mystery.xlsx", bytes: bytes("synthetic_raw_2026.xlsx") },
    ];
    const { store, unresolved } = await loadStoreFromFiles(files);
    expect(store.size).toBe(0);
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0]!.filename).toBe("mystery.xlsx");
  });

  it("uses a host-assigned yearOfTest, overriding the path/name", async () => {
    // No year in the path or name, but the host (import screen) assigns 2027.
    const files: RawWorkbookFile[] = [
      {
        name: "mystery.xlsx",
        relativePath: "mystery.xlsx",
        bytes: bytes("synthetic_raw_2026.xlsx"),
        yearOfTest: 2027,
      },
    ];
    const { store, unresolved, skipped } = await loadStoreFromFiles(files);
    expect(unresolved).toEqual([]);
    expect(skipped).toEqual([]);
    expect(availableYears(store)).toContain(2027);
    expect(storeEntries(store).every((e) => e.yearOfTest === 2027)).toBe(true);
  });

  it("prefers an assigned yearOfTest even when the path has a different year", async () => {
    const files: RawWorkbookFile[] = [
      {
        name: "synthetic_raw_2026.xlsx",
        relativePath: "Naplan 2026/synthetic_raw_2026.xlsx",
        bytes: bytes("synthetic_raw_2026.xlsx"),
        yearOfTest: 2024,
      },
    ];
    const { store } = await loadStoreFromFiles(files);
    expect(availableYears(store)).toEqual([2024]);
  });
});

describe("store selectors + cohort pairing (Reading Y7 2024 → Y9 2026)", () => {
  // The reading-only fixtures carry just the Student Reports sheet, so we build
  // the store directly from cleaned reports (real SSSR data always pairs both
  // sheets via the loader; cohort pairing itself only needs the reports).
  async function entryFrom(file: string, yearOfTest: number): Promise<LoadedFile> {
    const wb = await parseWorkbook(bytes(file));
    const reports = cleanStudentReports(wb.sheet("Student Reports")!);
    const yearLevel = reports[0]!.yearLevel!;
    const domain = reports[0]!.domain!;
    return {
      yearOfTest,
      yearLevel,
      domain,
      studentReports: reports,
      studentResults: [],
      sourceFilename: file,
      participants: reports.filter((r) => r.participationCode === "Participated").length,
      totalStudents: reports.length,
    };
  }

  async function buildStore2yr(): Promise<Store> {
    const y7 = await entryFrom("synthetic_y7_2024_reading.xlsx", 2024);
    const y9 = await entryFrom("synthetic_y9_2026_reading.xlsx", 2026);
    return new Map<string, LoadedFile>([
      [storeKey(y7.yearOfTest, y7.yearLevel, y7.domain), y7],
      [storeKey(y9.yearOfTest, y9.yearLevel, y9.domain), y9],
    ]);
  }

  it("cohortYears halves correctly", () => {
    expect(cohortYears(2026)).toEqual([2024, 2026]);
  });

  it("exposes entries and pairs the Reading cohort with a coherent match rate", async () => {
    const store = await buildStore2yr();
    expect(availableYears(store)).toEqual([2026, 2024]);
    expect(getEntry(store, 2024, 7, "Reading")).toBeDefined();
    expect(getEntry(store, 2026, 9, "Reading")).toBeDefined();
    expect(domainsFor(store, 2026, 9)).toContain("Reading");

    const pairings = buildCohortPairings(store, 2026);
    expect(pairings.has("Reading")).toBe(true);

    const mr = cohortMatchRate(pairings);
    expect(mr.representativeDomain).toBe("Reading");
    // structural coherence (exact counts depend on the synthetic overlap)
    expect(mr.matched).toBeGreaterThanOrEqual(0);
    expect(mr.y9CohortTotal).toBe(mr.matched + mr.joiners);
    expect(mr.y7CohortTotal).toBe(mr.matched + mr.leavers);
    if (mr.y9CohortTotal > 0) {
      expect(mr.matchRatePct).toBeCloseTo((mr.matched / mr.y9CohortTotal) * 100, 6);
    }
  });
});

describe("primary + combined cohorts through the real parse pipeline", () => {
  // Exercises the actual SSSR parse path (parseWorkbook + cleanStudentReports +
  // column aliases) for Year 3/5 fixtures — the path that synthetic-object tests
  // can't cover. Fixtures: scripts/make-primary-fixtures.mjs.
  async function entry(file: string, yearOfTest: number): Promise<LoadedFile> {
    const wb = await parseWorkbook(bytes(file));
    const reports = cleanStudentReports(wb.sheet("Student Reports")!);
    return {
      yearOfTest,
      yearLevel: reports[0]!.yearLevel!,
      domain: reports[0]!.domain!,
      studentReports: reports,
      studentResults: [],
      sourceFilename: file,
      participants: reports.filter((r) => r.participationCode === "Participated").length,
      totalStudents: reports.length,
    };
  }

  it("parses the Year 3/5 fixtures and pairs the primary cohort", async () => {
    const y3 = await entry("synthetic_y3_2024_reading.xlsx", 2024);
    const y5 = await entry("synthetic_y5_2026_reading.xlsx", 2026);
    expect(y3.yearLevel).toBe(3);
    expect(y5.yearLevel).toBe(5);
    const store = new Map<string, LoadedFile>([
      [storeKey(2024, 3, "Reading"), y3],
      [storeKey(2026, 5, "Reading"), y5],
    ]);
    expect(trackablePhases(store, 2026)).toEqual([{ phase: "primary", earlier: 3, later: 5 }]);
    const pc = buildCohortPairings(store, 2026).get("Reading")!;
    expect(pc.earlierLevel).toBe(3);
    expect(pc.laterLevel).toBe(5);
    expect(pc.paired.length).toBeGreaterThan(0);
  });

  it("a combined P–12 store (Year 3/5/7/9) tracks both phases independently", async () => {
    const store = new Map<string, LoadedFile>();
    for (const [file, yr] of [
      ["synthetic_y3_2024_reading.xlsx", 2024],
      ["synthetic_y5_2026_reading.xlsx", 2026],
      ["synthetic_y7_2024_reading.xlsx", 2024],
      ["synthetic_y9_2026_reading.xlsx", 2026],
    ] as const) {
      const e = await entry(file, yr);
      store.set(storeKey(e.yearOfTest, e.yearLevel, e.domain), e);
    }
    expect(trackablePhases(store, 2026)).toEqual([
      { phase: "primary", earlier: 3, later: 5 },
      { phase: "secondary", earlier: 7, later: 9 },
    ]);
    const primary = buildCohortPairings(store, 2026, { phase: "primary", earlier: 3, later: 5 });
    const secondary = buildCohortPairings(store, 2026, { phase: "secondary", earlier: 7, later: 9 });
    expect(primary.get("Reading")!.earlierLevel).toBe(3);
    expect(secondary.get("Reading")!.earlierLevel).toBe(7);
  });
});
