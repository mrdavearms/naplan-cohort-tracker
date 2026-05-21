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
