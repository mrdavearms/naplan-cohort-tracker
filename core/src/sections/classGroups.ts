/**
 * Section 7 — Class Group Analysis (pure computation).
 * Ported from `naplan/sections/s7_class_groups.py`.
 *
 * Proficiency distribution per class group, over participating students.
 * Null class groups are bucketed as "(unassigned)", matching the legacy.
 */
import { PARTICIPATED } from "../constants";
import type { StudentReportRow } from "../types";
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
