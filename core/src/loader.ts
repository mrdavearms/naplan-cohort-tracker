/**
 * SSSR workbook parsing + cleaning, ported from `naplan/loader.py` (raw schema
 * only — the de-identified / pseudonymisation path is out of scope).
 *
 * Filesystem-free: callers hand in workbook bytes (the Tauri layer does the
 * folder dialog + file reads). Excel parsing uses exceljs, which reads from an
 * in-memory buffer in Node, the browser, and the Tauri webview alike.
 */

import ExcelJS from "exceljs";
import { VALID_DOMAINS, VALID_YEAR_LEVELS } from "./constants";
import type { StudentReportRow, StudentResultRow } from "./types";

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
  const buf =
    data instanceof Uint8Array
      ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      : data;
  await wb.xlsx.load(buf as ArrayBuffer);

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

const asStr = (v: CellValue | undefined): string | null =>
  v == null ? null : String(v);

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
    throw new LoaderError(`Unexpected year level '${yearLevel}'. Expected 7 or 9.`);
  }
  return { domain, yearLevel };
}
