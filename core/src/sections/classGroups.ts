/**
 * Section 7 — Class Group Analysis (pure computation).
 * Ported from `naplan/sections/s7_class_groups.py`.
 *
 * Proficiency distribution per class group, over participating students.
 * Null class groups are bucketed as "(unassigned)", matching the legacy.
 */
import { NAS, PARTICIPATED } from "../constants";
import type { LoadedFile, StudentReportRow } from "../types";
import { PRIVACY_THRESHOLD } from "./equity";
import { proficiencyPercentages, type ProficiencyPercentages } from "./proficiency";

export const UNASSIGNED_CLASS = "(unassigned)";

export interface ClassProficiency {
  classGroup: string;
  n: number;
  percentages: ProficiencyPercentages;
}

/** Per class group: participant count + proficiency-level percentages, sorted by class. */
export function classDistribution(reports: readonly StudentReportRow[]): ClassProficiency[] {
  const byClass = new Map<string, StudentReportRow[]>();
  for (const r of reports) {
    if (r.participationCode !== PARTICIPATED) continue;
    const cls = r.classGroups ?? UNASSIGNED_CLASS;
    const bucket = byClass.get(cls);
    if (bucket) bucket.push(r);
    else byClass.set(cls, [r]);
  }

  const out: ClassProficiency[] = [];
  for (const [classGroup, rows] of byClass) {
    out.push({ classGroup, n: rows.length, percentages: proficiencyPercentages(rows) });
  }
  out.sort((a, b) => a.classGroup.localeCompare(b.classGroup));
  return out;
}

/** One-sentence takeaway for the top of Section 7.
 *
 *  Scoped to ONE domain (the year level's highest-NAS domain) because
 *  `classDistribution` works on a single domain's rows — pooling domains would
 *  produce a number that means nothing. Groups below the suppression threshold
 *  are excluded from the ranking, so a placeholder group (e.g. INC, n=2 at 100%
 *  NAS) can never become the headline. */
export function classGroupsHeadline(
  entries: readonly LoadedFile[],
  yearLevel: number,
): string | null {
  const forLevel = entries.filter((e) => e.yearLevel === yearLevel);
  if (forLevel.length === 0) return null;

  // Pick the worst domain at this level, matching proficiencyHeadline's choice.
  const worstEntry = forLevel.reduce((a, b) =>
    proficiencyPercentages(b.studentReports)[NAS] > proficiencyPercentages(a.studentReports)[NAS]
      ? b
      : a,
  );

  const rows = classDistribution(worstEntry.studentReports);
  const substantive = rows.filter((r) => r.n >= PRIVACY_THRESHOLD);
  if (substantive.length < 2) return null;

  const highest = substantive.reduce((a, b) => (b.percentages[NAS] > a.percentages[NAS] ? b : a));
  return (
    `In ${worstEntry.domain} at Year ${yearLevel}, class ${highest.classGroup} has the highest ` +
    `concentration of students needing additional support: ${highest.percentages[NAS].toFixed(1)}% ` +
    `of its ${highest.n} students. Class patterns reflect how classes were formed and how support ` +
    "was distributed, not teacher performance."
  );
}
