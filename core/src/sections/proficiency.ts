/**
 * Section 2 — Proficiency Overview (pure computation).
 * Ported from `naplan/sections/s2_proficiency.py`.
 *
 * Percentages are over PARTICIPATING students; the denominator is the
 * participant count (including participants whose proficiency is null /
 * Absent-in-domain), matching the legacy `len(parts)` denominator.
 */
import { NAS, PARTICIPATED, PROFICIENCY_LEVELS, type ProficiencyLevel } from "../constants";
import type { LoadedFile, StudentReportRow } from "../types";

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

/** One-sentence takeaway for the top of Section 2. */
export function proficiencyHeadline(
  entries: readonly LoadedFile[],
  yearLevel: number,
): string | null {
  const forLevel = entries.filter((e) => e.yearLevel === yearLevel);
  if (forLevel.length === 0) return null;

  const byDomain = forLevel.map((e) => ({
    domain: e.domain,
    nasPct: proficiencyPercentages(e.studentReports)[NAS],
  }));
  const worst = byDomain.reduce((a, b) => (b.nasPct > a.nasPct ? b : a));
  const best = byDomain.reduce((a, b) => (b.nasPct < a.nasPct ? b : a));
  if (worst.domain === best.domain) {
    return `At Year ${yearLevel}, ${worst.nasPct.toFixed(1)}% of students need additional support in ${worst.domain}.`;
  }
  return (
    `At Year ${yearLevel}, ${worst.domain} has the largest group needing additional support ` +
    `(${worst.nasPct.toFixed(1)}%) and ${best.domain} the smallest (${best.nasPct.toFixed(1)}%).`
  );
}
