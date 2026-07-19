/**
 * Section 1 — Participation Summary (pure computation).
 * Ported from `naplan/sections/s1_participation.py`.
 */
import { PARTICIPATED } from "../constants";
import type { LoadedFile, StudentReportRow } from "../types";

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

/** One-sentence takeaway for the top of Section 1. Null when there is nothing
 *  worth leading with (no entries, or every domain at full participation). */
export function participationHeadline(
  entries: readonly LoadedFile[],
  yearLevel: number,
): string | null {
  const forLevel = entries.filter((e) => e.yearLevel === yearLevel);
  if (forLevel.length === 0) return null;

  const rates = forLevel.map((e) => ({
    domain: e.domain,
    rate: e.totalStudents > 0 ? (e.participants / e.totalStudents) * 100 : 100,
    absent: e.totalStudents - e.participants,
  }));
  const lowest = rates.reduce((a, b) => (b.rate < a.rate ? b : a));
  if (lowest.absent === 0) {
    return `Every student sat every tested domain at Year ${yearLevel}.`;
  }
  return (
    `${lowest.domain} had the lowest participation at Year ${yearLevel}: ` +
    `${lowest.rate.toFixed(1)}% of students sat it (${lowest.absent} did not). ` +
    "Students who did not sit are excluded from the proficiency figures but counted here."
  );
}
