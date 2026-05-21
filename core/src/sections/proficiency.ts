/**
 * Section 2 — Proficiency Overview (pure computation).
 * Ported from `naplan/sections/s2_proficiency.py`.
 *
 * Percentages are over PARTICIPATING students; the denominator is the
 * participant count (including participants whose proficiency is null /
 * Absent-in-domain), matching the legacy `len(parts)` denominator.
 */
import { PARTICIPATED, PROFICIENCY_LEVELS, type ProficiencyLevel } from "../constants";
import type { StudentReportRow } from "../types";

export type ProficiencyCounts = Record<ProficiencyLevel, number>;
export type ProficiencyPercentages = Record<ProficiencyLevel, number>;

function emptyLevelMap(): Record<ProficiencyLevel, number> {
  return {
    "Needs additional support": 0,
    Developing: 0,
    Strong: 0,
    Exceeding: 0,
  };
}

/** Count of participating students at each proficiency level. */
export function proficiencyCounts(reports: readonly StudentReportRow[]): ProficiencyCounts {
  const counts = emptyLevelMap();
  for (const r of reports) {
    if (r.participationCode !== PARTICIPATED) continue;
    const lvl = r.proficiencyLevel;
    if (lvl != null && lvl in counts) counts[lvl as ProficiencyLevel] += 1;
  }
  return counts;
}

/** Percentage of participating students at each level (denominator = participants). */
export function proficiencyPercentages(
  reports: readonly StudentReportRow[],
): ProficiencyPercentages {
  const n = reports.filter((r) => r.participationCode === PARTICIPATED).length;
  const counts = proficiencyCounts(reports);
  const pct = emptyLevelMap();
  for (const lvl of PROFICIENCY_LEVELS) {
    pct[lvl] = n === 0 ? 0 : (counts[lvl] / n) * 100;
  }
  return pct;
}
