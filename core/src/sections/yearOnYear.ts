/**
 * Section 3 — Year-on-year change in NAS counts (pure computation).
 * Ported from `naplan/sections/s3_aip_target.py`.
 *
 * The legacy section is a year-on-year NAS diagnostic (the school's AIP sets no
 * specific NAPLAN target). All WHS/AIP-specific prose is school-identity data
 * (handled by Settings + the UI), not code. This module ports only the generic
 * computation, for any domain.
 *
 * Attribution caveat (applied by the UI, not here): Year 7 year-on-year change
 * is feeder-cohort variation, not the secondary school's performance.
 */
import { PARTICIPATED } from "../constants";
import type { StudentReportRow } from "../types";
import { proficiencyCounts, proficiencyPercentages } from "./proficiency";

export interface NasSummary {
  nasCount: number;
  nasPct: number;
  participants: number;
}

/** NAS count + percentage + participant count for one entry. */
export function nasSummary(reports: readonly StudentReportRow[]): NasSummary {
  return {
    nasCount: proficiencyCounts(reports)["Needs additional support"],
    nasPct: proficiencyPercentages(reports)["Needs additional support"],
    participants: reports.filter((r) => r.participationCode === PARTICIPATED).length,
  };
}

export type YearOnYearStatus = "improved" | "flat" | "worsened" | "no_data";

/** Direction from a NAS-count change (new - old): improved when it falls,
 *  flat within +/-2 students, worsened when it rises. */
export function statusForCountDelta(countDelta: number): "improved" | "flat" | "worsened" {
  if (Math.abs(countDelta) <= 2) return "flat";
  return countDelta < 0 ? "improved" : "worsened";
}

export interface YearOnYearPoint {
  year: number;
  summary: NasSummary;
}

export interface YearOnYearChange {
  /** chronological points (earliest first). */
  history: YearOnYearPoint[];
  status: YearOnYearStatus;
  /** last NAS count minus first; null when there's no prior year. */
  countDelta: number | null;
  pctDelta: number | null;
}

/**
 * Compare the earliest available year against the latest. With fewer than two
 * years of data the status is "no_data" (nothing to compare).
 */
export function yearOnYearNas(history: readonly YearOnYearPoint[]): YearOnYearChange {
  const points = [...history].sort((a, b) => a.year - b.year);
  if (points.length < 2) {
    return { history: points, status: "no_data", countDelta: null, pctDelta: null };
  }
  const first = points[0]!.summary;
  const last = points[points.length - 1]!.summary;
  const countDelta = last.nasCount - first.nasCount;
  const pctDelta = last.nasPct - first.nasPct;
  return { history: points, status: statusForCountDelta(countDelta), countDelta, pctDelta };
}
