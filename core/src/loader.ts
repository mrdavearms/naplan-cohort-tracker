/**
 * SSSR workbook parsing + cleaning, ported from `naplan/loader.py` (raw schema
 * only — the de-identified / pseudonymisation path is out of scope).
 *
 * Filesystem-free: callers hand in workbook bytes (the Tauri layer does the
 * folder dialog + file reads). Excel parsing uses exceljs, which reads from an
 * in-memory buffer in Node, the browser, and the Tauri webview alike.
 */

import ExcelJS from "exceljs";
import {
  PARTICIPATED,
  PROFICIENCY_LEVEL_SET,
  PROFICIENCY_LEVELS,
  VALID_DOMAINS,
  VALID_YEAR_LEVELS,
} from "./constants";
import type { LoadedFile, StudentReportRow, StudentResultRow } from "./types";

export class LoaderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoaderError";
  }
}

type CellValue = string | number | boolean | null;

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, CellValue>[];
}

export interface ParsedWorkbook {
  sheetNames: string[];
  sheet(name: string): ParsedSheet | null;
}

// 2025 SSSR uses Title-Case for some columns. Normalise to the 2026 spellings.
export const STUDENT_REPORTS_ALIASES: Record<string, string> = {
  "Local Student ID": "Local student ID",
  "Student Name": "Student name",
  "Year Level": "Year level",
  "Class Groups": "Class groups",
};

export const STUDENT_RESULTS_ALIASES: Record<string, string> = {
  "Student Marked Response": "Student marked response",
};

const REPORTS_REQUIRED = [
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

const RESULTS_REQUIRED = [
  "Student PSI",
  "Year Level",
  "Class Groups",
  "Item ID",
  "Item difficulty",
  "Domain",
  "Subdomain",
  "Descriptor",
  "Student marked response",
];

/** Reduce an exceljs cell value to a primitive (handles rich text / formula results). */
function toPrimitive(v: unknown): CellValue {
  if (v == null) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o["text"] === "string") return o["text"] as string;
    if ("result" in o) return toPrimitive(o["result"]);
    if (Array.isArray(o["richText"])) {
      return (o["richText"] as Array<{ text?: string }>).map((t) => t.text ?? "").join("");
    }
    return null; // errors, hyperlinks without text, etc.
  }
  return null;
}

function worksheetToSheet(ws: ExcelJS.Worksheet): ParsedSheet {
  const headerValues = ws.getRow(1).values as unknown[]; // exceljs is 1-indexed; [0] unused
  const headers: string[] = [];
  for (let c = 1; c < headerValues.length; c++) {
    const h = toPrimitive(headerValues[c]);
    headers[c - 1] = h == null ? "" : String(h);
  }

  const rows: Record<string, CellValue>[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const values = ws.getRow(r).values as unknown[];
    const obj: Record<string, CellValue> = {};
    let hasContent = false;
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      if (!key) continue;
      const v = toPrimitive(values[c + 1]);
      obj[key] = v;
      if (v != null) hasContent = true;
    }
    if (hasContent) rows.push(obj);
  }

  return { headers: headers.filter((h) => h.length > 0), rows };
}

/** Parse workbook bytes into per-sheet headers + rows. */
export async function parseWorkbook(data: ArrayBuffer | Uint8Array): Promise<ParsedWorkbook> {
  const wb = new ExcelJS.Workbook();
  // Hand exceljs a Uint8Array, not a bare ArrayBuffer. exceljs's *browser* build
  // (the one Vite ships into the WebView) is picky: its bundled JSZip reliably
  // accepts a Uint8Array but rejects some ArrayBuffers — e.g. a slice of a
  // pooled buffer — with "Can't read the data of 'the loaded zip file'". The
  // Uint8Array also preserves byteOffset/length, so a view is read correctly.
  const input = data instanceof Uint8Array ? data : new Uint8Array(data);
  await wb.xlsx.load(input as unknown as ArrayBuffer);

  const byName = new Map<string, ParsedSheet>();
  for (const ws of wb.worksheets) byName.set(ws.name, worksheetToSheet(ws));

  return {
    sheetNames: wb.worksheets.map((ws) => ws.name),
    sheet: (name) => byName.get(name) ?? null,
  };
}

/** Rename only the alias columns that need it (src present, dst absent) — mirrors `_normalise_columns`. */
function normaliseSheet(sheet: ParsedSheet, aliases: Record<string, string>): ParsedSheet {
  const headerSet = new Set(sheet.headers);
  const renames = Object.entries(aliases).filter(
    ([src, dst]) => headerSet.has(src) && !headerSet.has(dst),
  );
  if (renames.length === 0) return sheet;

  const renameMap = new Map(renames);
  const headers = sheet.headers.map((h) => renameMap.get(h) ?? h);
  const rows = sheet.rows.map((row) => {
    const out: Record<string, CellValue> = { ...row };
    for (const [src, dst] of renames) {
      if (src in out) {
        out[dst] = out[src]!;
        delete out[src];
      }
    }
    return out;
  });
  return { headers, rows };
}

function requireColumns(sheet: ParsedSheet, needed: string[], what: string): void {
  const headerSet = new Set(sheet.headers);
  const missing = needed.filter((c) => !headerSet.has(c));
  if (missing.length > 0) {
    throw new LoaderError(`${what} sheet missing columns: ${missing.join(", ")}`);
  }
}

/** Cell → trimmed string, with blank/whitespace-only treated as missing.
 *  Blank is NOT the same as empty here: an empty `Local student ID` that stayed
 *  as `""` would defeat both the `{PSI}*` display fallback and the cross-year
 *  join guard, silently pairing every blank-ID student against one another. */
const asStr = (v: CellValue | undefined): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
};

const asNum = (v: CellValue | undefined): number | null => {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isNaN(n) ? null : n;
};

/** Normalise the four Indigenous Status text values to ATSI / Non-ATSI / Not reported. */
export function atsiCombined(value: CellValue): string {
  if (value == null) return "Not reported";
  const text = String(value);
  if (text === "Neither Aboriginal nor Torres Strait Islander origin") return "Non-ATSI";
  if (text.includes("Aboriginal") || text.includes("Torres Strait Islander")) return "ATSI";
  return "Not reported";
}

/** Item-difficulty bands per the spec: <480, 480-580, >580. */
export function difficultyBand(diff: CellValue): string {
  const n = asNum(diff);
  if (n == null) return "Unknown";
  if (n < 480) return "Below 480";
  if (n <= 580) return "480-580";
  return "Above 580";
}

/** Clean a raw Student Reports sheet into canonical rows. */
export function cleanStudentReports(rawSheet: ParsedSheet): StudentReportRow[] {
  const sheet = normaliseSheet(rawSheet, STUDENT_REPORTS_ALIASES);
  requireColumns(sheet, REPORTS_REQUIRED, "Student Reports");

  return sheet.rows.map((r) => {
    const studentId = asStr(r["Student ID"]);
    const localStudentId = asStr(r["Local student ID"]);
    const indigenousStatus = asStr(r["Indigenous Status"]);
    return {
      studentId,
      localStudentId,
      localStudentIdDisplay: localStudentId != null ? localStudentId : `${studentId ?? ""}*`,
      yearLevel: asNum(r["Year level"]),
      classGroups: asStr(r["Class groups"]),
      domain: asStr(r["Domain"]),
      proficiencyLevel: asStr(r["Proficiency level"]),
      participationCode: asStr(r["Participation code"]),
      indigenousStatus,
      lboteStatus: asStr(r["LBOTE Status"]),
      atsiGroup: atsiCombined(indigenousStatus),
    };
  });
}

/** Clean a raw Student Results Table sheet into canonical rows. */
export function cleanStudentResults(rawSheet: ParsedSheet): StudentResultRow[] {
  const sheet = normaliseSheet(rawSheet, STUDENT_RESULTS_ALIASES);
  requireColumns(sheet, RESULTS_REQUIRED, "Student Results Table");

  return sheet.rows.map((r) => ({
    studentPsi: asStr(r["Student PSI"]),
    yearLevel: asNum(r["Year Level"]),
    classGroups: asStr(r["Class Groups"]),
    itemId: asStr(r["Item ID"]),
    itemDifficulty: asNum(r["Item difficulty"]),
    domain: asStr(r["Domain"]),
    subdomain: asStr(r["Subdomain"]),
    descriptor: asStr(r["Descriptor"]),
    studentMarkedResponse: asStr(r["Student marked response"]),
    difficultyBand: difficultyBand(r["Item difficulty"] ?? null),
  }));
}

/** Detect the single domain + year level present in a cleaned Student Reports set. */
export function detectDomainAndYear(reports: readonly StudentReportRow[]): {
  domain: string;
  yearLevel: number;
} {
  const domains = [...new Set(reports.map((r) => r.domain).filter((d): d is string => d != null))];
  const years = [...new Set(reports.map((r) => r.yearLevel).filter((y): y is number => y != null))];

  if (domains.length !== 1) {
    throw new LoaderError(
      `Expected a single domain in Student Reports, found: ${JSON.stringify(domains)}`,
    );
  }
  if (years.length !== 1) {
    throw new LoaderError(
      `Expected a single year level in Student Reports, found: ${JSON.stringify(years)}`,
    );
  }
  const domain = domains[0]!;
  const yearLevel = years[0]!;
  if (!(VALID_DOMAINS as readonly string[]).includes(domain)) {
    throw new LoaderError(`Unexpected domain '${domain}'. Expected one of: ${VALID_DOMAINS.join(", ")}`);
  }
  if (!(VALID_YEAR_LEVELS as readonly number[]).includes(yearLevel)) {
    throw new LoaderError(`Unexpected year level '${yearLevel}'. Expected 3, 5, 7 or 9.`);
  }

  // Validate the proficiency vocabulary. Null is expected and fine (Absent /
  // Withdrawn students are excluded from proficiency analytics but kept in
  // participation) — an unrecognised *string* is not, and would silently zero
  // every proficiency analytic rather than failing visibly.
  const unknownLevels = [
    ...new Set(
      reports
        .map((r) => r.proficiencyLevel)
        .filter((p): p is string => p != null && !PROFICIENCY_LEVEL_SET.has(p)),
    ),
  ];
  if (unknownLevels.length > 0) {
    throw new LoaderError(
      `Unrecognised proficiency level(s): ${unknownLevels.map((l) => `'${l}'`).join(", ")}. ` +
        `Expected one of: ${PROFICIENCY_LEVELS.join(", ")}. ` +
        `If VCAA has changed the wording in the SSSR export, this file needs a loader update.`,
    );
  }
  return { domain, yearLevel };
}

/** Detect the single domain + year level from a cleaned Student Results Table
 *  (used to key a results-only file in the 2025 split-file format). */
function detectDomainAndYearFromResults(results: readonly StudentResultRow[]): {
  domain: string;
  yearLevel: number;
} {
  const domains = [...new Set(results.map((r) => r.domain).filter((d): d is string => d != null))];
  const years = [...new Set(results.map((r) => r.yearLevel).filter((y): y is number => y != null))];
  if (domains.length !== 1 || years.length !== 1) {
    throw new LoaderError("could not determine a single domain/year from Student Results Table");
  }
  return { domain: domains[0]!, yearLevel: years[0]! };
}

/** Best-effort year-of-test from a folder/file name (first 20xx found).
 *  The Tauri layer typically supplies the year from the folder name. */
export function detectYearOfTestFromName(name: string): number | null {
  const m = name.match(/\b(20\d{2})\b/);
  return m ? Number(m[1]) : null;
}

// ── Store assembly ──────────────────────────────────────────────────────────
// The in-memory store is keyed by (yearOfTest, yearLevel, domain). Two SSSR
// export formats are handled: 2026 (one workbook with both sheets) and 2025
// (one workbook per sheet, paired by (yearLevel, domain) within a year).

const SHEET_REPORTS = "Student Reports";
const SHEET_RESULTS = "Student Results Table";

export function storeKey(yearOfTest: number, yearLevel: number, domain: string): string {
  return `${yearOfTest}|${yearLevel}|${domain}`;
}

/** A parsed workbook plus the year-of-test the caller (Tauri layer) resolved. */
export interface WorkbookInput {
  filename: string;
  yearOfTest: number;
  workbook: ParsedWorkbook;
}

export interface SkippedFile {
  filename: string;
  reason: string;
}

export interface BuildStoreResult {
  store: Map<string, LoadedFile>;
  skipped: SkippedFile[];
}

function makeLoadedFile(
  yearOfTest: number,
  yearLevel: number,
  domain: string,
  reports: StudentReportRow[],
  results: StudentResultRow[],
  sourceFilename: string,
): LoadedFile {
  const participants = reports.filter((r) => r.participationCode === PARTICIPATED).length;
  return {
    yearOfTest,
    yearLevel,
    domain,
    studentReports: reports,
    studentResults: results,
    sourceFilename,
    participants,
    totalStudents: reports.length,
  };
}

/**
 * Assemble the keyed store from a set of parsed workbooks. Full workbooks
 * (both sheets) register directly; single-sheet workbooks are paired by
 * (yearOfTest, yearLevel, domain). Files that fail to clean, or that lack a
 * pairing partner, are returned in `skipped` rather than throwing.
 */
export function buildStore(inputs: readonly WorkbookInput[]): BuildStoreResult {
  const store = new Map<string, LoadedFile>();
  const skipped: SkippedFile[] = [];

  interface PendingReports {
    filename: string;
    reports: StudentReportRow[];
    yearOfTest: number;
    yearLevel: number;
    domain: string;
  }
  const pairSr = new Map<string, PendingReports>();
  const pairSrt = new Map<string, { filename: string; results: StudentResultRow[] }>();

  for (const { filename, yearOfTest, workbook } of inputs) {
    const names = new Set(workbook.sheetNames);
    const hasSr = names.has(SHEET_REPORTS);
    const hasSrt = names.has(SHEET_RESULTS);
    try {
      if (hasSr && hasSrt) {
        const reports = cleanStudentReports(workbook.sheet(SHEET_REPORTS)!);
        const results = cleanStudentResults(workbook.sheet(SHEET_RESULTS)!);
        const { domain, yearLevel } = detectDomainAndYear(reports);
        store.set(
          storeKey(yearOfTest, yearLevel, domain),
          makeLoadedFile(yearOfTest, yearLevel, domain, reports, results, filename),
        );
      } else if (hasSr) {
        const reports = cleanStudentReports(workbook.sheet(SHEET_REPORTS)!);
        const { domain, yearLevel } = detectDomainAndYear(reports);
        pairSr.set(storeKey(yearOfTest, yearLevel, domain), {
          filename,
          reports,
          yearOfTest,
          yearLevel,
          domain,
        });
      } else if (hasSrt) {
        const results = cleanStudentResults(workbook.sheet(SHEET_RESULTS)!);
        const { domain, yearLevel } = detectDomainAndYearFromResults(results);
        pairSrt.set(storeKey(yearOfTest, yearLevel, domain), { filename, results });
      } else {
        skipped.push({ filename, reason: `no '${SHEET_REPORTS}' or '${SHEET_RESULTS}' sheet` });
      }
    } catch (e) {
      skipped.push({ filename, reason: e instanceof Error ? e.message : String(e) });
    }
  }

  // Pair the 2025 split-file format.
  for (const key of [...new Set([...pairSr.keys(), ...pairSrt.keys()])].sort()) {
    const sr = pairSr.get(key);
    const srt = pairSrt.get(key);
    if (sr && srt) {
      store.set(
        key,
        makeLoadedFile(
          sr.yearOfTest,
          sr.yearLevel,
          sr.domain,
          sr.reports,
          srt.results,
          `${sr.filename} + ${srt.filename}`,
        ),
      );
    } else {
      const present = sr ?? srt!;
      const missing = sr ? SHEET_RESULTS : SHEET_REPORTS;
      skipped.push({ filename: present.filename, reason: `missing ${missing} for ${key}` });
    }
  }

  return { store, skipped };
}

// ── Single-file inspection (import-screen "recognised / not recognised") ──────
// A lightweight per-file classifier used by the import UI to show an instant
// status when a file is added, before the full Load. It reuses the same parse +
// clean + detect path as buildStore (no second analysis code path), so a file
// that inspects "ok" will load, and a rejection reason matches what Load reports.

export type WorkbookInspection =
  | {
      status: "ok";
      /** Detected from the file's own rows (7 or 9). */
      yearLevel: number;
      /** Detected from the file's own rows. */
      domain: string;
      /** Which sheets the workbook carries: a full 2026 export, or one half of a
       *  2025 split (which only loads once paired with its partner). */
      sheets: "full" | "reports" | "results";
    }
  | { status: "rejected"; reason: string };

/** Classify a single workbook's bytes for the import screen. Never throws —
 *  unreadable or non-SSSR files come back as `{ status: "rejected", reason }`. */
export async function inspectWorkbook(
  data: ArrayBuffer | Uint8Array,
): Promise<WorkbookInspection> {
  let workbook: ParsedWorkbook;
  try {
    workbook = await parseWorkbook(data);
  } catch {
    return { status: "rejected", reason: "Couldn’t read this file — is it a valid .xlsx?" };
  }

  const names = new Set(workbook.sheetNames);
  const hasSr = names.has(SHEET_REPORTS);
  const hasSrt = names.has(SHEET_RESULTS);

  try {
    if (hasSr) {
      const reports = cleanStudentReports(workbook.sheet(SHEET_REPORTS)!);
      const { domain, yearLevel } = detectDomainAndYear(reports);
      return { status: "ok", yearLevel, domain, sheets: hasSrt ? "full" : "reports" };
    }
    if (hasSrt) {
      const results = cleanStudentResults(workbook.sheet(SHEET_RESULTS)!);
      const { domain, yearLevel } = detectDomainAndYearFromResults(results);
      return { status: "ok", yearLevel, domain, sheets: "results" };
    }
    return {
      status: "rejected",
      reason: `This isn’t a NAPLAN SSSR file (no ‘${SHEET_REPORTS}’ or ‘${SHEET_RESULTS}’ sheet).`,
    };
  } catch (e) {
    return { status: "rejected", reason: e instanceof Error ? e.message : String(e) };
  }
}
