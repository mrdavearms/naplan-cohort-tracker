/**
 * Section 8 — Students Requiring Targeted Support (pure computation).
 * Ported from `naplan/sections/s8_targeted_support.py`.
 *
 * Cross-domain pivot for one year level: one row per participating student,
 * their proficiency in each loaded domain, and a count of domains at NAS.
 * Only students at NAS in >= 1 domain are returned. Local student IDs only
 * (no names) — the {PSI}* display fallback is used.
 */
import { NAS, PARTICIPATED } from "../constants";
import type { LoadedFile } from "../types";

export interface TargetedStudent {
  localStudentIdDisplay: string;
  classGroup: string | null;
  nasDomains: number;
  /** proficiency per loaded domain; null for a domain the student didn't sit. */
  proficiencyByDomain: Record<string, string | null>;
}

export interface TargetedSupportTable {
  yearLevel: number;
  domains: string[];
  students: TargetedStudent[];
  /** students at NAS in >= 1 domain. */
  totalNas: number;
  /** students at NAS in >= 2 domains. */
  multiNas: number;
}

interface StudentAgg {
  localStudentIdDisplay: string;
  classGroup: string | null;
  profByDomain: Map<string, string | null>;
}

/** Class groups sort ascending with null/unassigned last (matches pandas NaN-last). */
function classKey(c: string | null): string {
  return c ?? "￿";
}

export function targetedSupport(
  entries: readonly LoadedFile[],
  yearLevel: number,
): TargetedSupportTable {
  const domainSet = new Set<string>();
  const byStudent = new Map<string, StudentAgg>();

  for (const entry of entries) {
    if (entry.yearLevel !== yearLevel) continue;
    domainSet.add(entry.domain);
    for (const r of entry.studentReports) {
      if (r.participationCode !== PARTICIPATED) continue;
      const key = r.studentId ?? r.localStudentIdDisplay;
      let s = byStudent.get(key);
      if (!s) {
        s = {
          localStudentIdDisplay: r.localStudentIdDisplay,
          classGroup: r.classGroups,
          profByDomain: new Map(),
        };
        byStudent.set(key, s);
      }
      // aggfunc="first": keep the first proficiency seen for a (student, domain).
      if (!s.profByDomain.has(entry.domain)) {
        s.profByDomain.set(entry.domain, r.proficiencyLevel);
      }
    }
  }

  const domains = [...domainSet].sort((a, b) => a.localeCompare(b));

  const students: TargetedStudent[] = [];
  for (const s of byStudent.values()) {
    let nasDomains = 0;
    const proficiencyByDomain: Record<string, string | null> = {};
    for (const d of domains) {
      const prof = s.profByDomain.get(d) ?? null;
      proficiencyByDomain[d] = prof;
      if (prof === NAS) nasDomains += 1;
    }
    if (nasDomains < 1) continue;
    students.push({
      localStudentIdDisplay: s.localStudentIdDisplay,
      classGroup: s.classGroup,
      nasDomains,
      proficiencyByDomain,
    });
  }

  // Sort: NAS domains desc, then class group asc, then local student ID asc.
  students.sort(
    (a, b) =>
      b.nasDomains - a.nasDomains ||
      classKey(a.classGroup).localeCompare(classKey(b.classGroup)) ||
      a.localStudentIdDisplay.localeCompare(b.localStudentIdDisplay),
  );

  return {
    yearLevel,
    domains,
    students,
    totalNas: students.length,
    multiNas: students.filter((s) => s.nasDomains >= 2).length,
  };
}
