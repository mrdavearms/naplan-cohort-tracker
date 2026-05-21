/**
 * Section 1 — Participation Summary (pure computation).
 * Ported from `naplan/sections/s1_participation.py`.
 */
import { PARTICIPATED } from "../constants";
import type { StudentReportRow } from "../types";

export interface ParticipationBreakdown {
  participated: number;
  absent: number;
  withdrawn: number;
}

export interface ParticipationSummary {
  total: number;
  participated: number;
  /** participation rate as a percentage (0 when there are no students). */
  rate: number;
}

/** Counts of Participated / Absent / Withdrawn (other codes are ignored, as in the legacy). */
export function participationBreakdown(
  reports: readonly StudentReportRow[],
): ParticipationBreakdown {
  let participated = 0;
  let absent = 0;
  let withdrawn = 0;
  for (const r of reports) {
    if (r.participationCode === PARTICIPATED) participated += 1;
    else if (r.participationCode === "Absent") absent += 1;
    else if (r.participationCode === "Withdrawn") withdrawn += 1;
  }
  return { participated, absent, withdrawn };
}

export function participationSummary(reports: readonly StudentReportRow[]): ParticipationSummary {
  const total = reports.length;
  const participated = reports.filter((r) => r.participationCode === PARTICIPATED).length;
  return { total, participated, rate: total > 0 ? (participated / total) * 100 : 0 };
}
