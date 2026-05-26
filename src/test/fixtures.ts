/** Build a synthetic in-memory store from the committed fake-data fixtures, for
 *  UI rendering tests. Fake data only — no real student data. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanStudentReports,
  cleanStudentResults,
  detectDomainAndYear,
  parseWorkbook,
  storeKey,
  type LoadedFile,
  type Store,
} from "@naplan-cohort-tracker/core";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "../../core/tests/fixtures");
const bytes = (name: string): Uint8Array => readFileSync(join(FIX, name));

async function entry(
  file: string,
  yearOfTest: number,
  opts: { withResults?: boolean } = {},
): Promise<LoadedFile> {
  const wb = await parseWorkbook(bytes(file));
  const reports = cleanStudentReports(wb.sheet("Student Reports")!);
  const results =
    opts.withResults && wb.sheet("Student Results Table")
      ? cleanStudentResults(wb.sheet("Student Results Table")!)
      : [];
  const { domain, yearLevel } = detectDomainAndYear(reports);
  return {
    yearOfTest,
    yearLevel,
    domain,
    studentReports: reports,
    studentResults: results,
    sourceFilename: file,
    participants: reports.filter((r) => r.participationCode === "Participated").length,
    totalStudents: reports.length,
  };
}

/** A store spanning 2024 (Y7) + 2026 (Y9) with a paired Reading cohort and a
 *  full 2026 entry (with item results) for the skill-gap view. */
export async function buildSyntheticStore(): Promise<Store> {
  const entries = await Promise.all([
    entry("synthetic_raw_2026.xlsx", 2026, { withResults: true }),
    entry("synthetic_y7_2024_reading.xlsx", 2024),
    entry("synthetic_y9_2026_reading.xlsx", 2026),
  ]);
  const store: Store = new Map();
  for (const e of entries) store.set(storeKey(e.yearOfTest, e.yearLevel, e.domain), e);
  return store;
}

async function storeFrom(files: [string, number][]): Promise<Store> {
  const store: Store = new Map();
  for (const [file, year] of files) {
    const e = await entry(file, year);
    store.set(storeKey(e.yearOfTest, e.yearLevel, e.domain), e);
  }
  return store;
}

/** A primary school: Year 3 (2024) + Year 5 (2026) paired Reading cohort. */
export function buildPrimaryStore(): Promise<Store> {
  return storeFrom([
    ["synthetic_y3_2024_reading.xlsx", 2024],
    ["synthetic_y5_2026_reading.xlsx", 2026],
  ]);
}

/** A combined P–12 school: both cohorts (Year 3→5 and Year 7→9) at once. */
export function buildCombinedStore(): Promise<Store> {
  return storeFrom([
    ["synthetic_y3_2024_reading.xlsx", 2024],
    ["synthetic_y5_2026_reading.xlsx", 2026],
    ["synthetic_y7_2024_reading.xlsx", 2024],
    ["synthetic_y9_2026_reading.xlsx", 2026],
  ]);
}
