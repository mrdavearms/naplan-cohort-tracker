/**
 * Section 6 — Equity Analysis (pure computation).
 * Ported from `naplan/sections/s6_equity.py`.
 *
 * Proficiency distributions by LBOTE status and Indigenous status, over
 * participating students. Indigenous subgroups are suppressed when the ATSI
 * count is below the privacy threshold (n < 5). A subgroup is flagged as a
 * priority equity gap when its NAS rate exceeds the whole-cohort NAS rate by
 * more than 5 percentage points.
 */
import { PARTICIPATED } from "../constants";
import type { StudentReportRow } from "../types";
import { proficiencyPercentages, type ProficiencyPercentages } from "./proficiency";

export const PRIVACY_THRESHOLD = 5;
const NAS_KEY = "Needs additional support";

export interface EquitySubgroup {
  label: string;
  n: number;
  /** All zero when `suppressed` — a suppressed group must expose no figures. */
  percentages: ProficiencyPercentages;
  /** group NAS% minus whole-cohort NAS% (percentage points). 0 when suppressed. */
  nasGapVsCohort: number;
  /** true when nasGapVsCohort > 5. Always false when suppressed. */
  priorityGap: boolean;
  /** true when n < PRIVACY_THRESHOLD — figures withheld to protect individuals. */
  suppressed: boolean;
}

export interface EquityBreakdown {
  cohortNasPct: number;
  lboteReported: boolean;
  lbote: EquitySubgroup[];
  /** true when ANY LBOTE subgroup is below the threshold. */
  lboteSuppressed: boolean;
  atsiSuppressed: boolean;
  atsiCount: number;
  nonAtsiCount: number;
  /** true when the Non-ATSI comparison group is itself below the threshold. */
  nonAtsiSuppressed: boolean;
  /** empty when suppressed (atsiCount < PRIVACY_THRESHOLD). */
  atsi: EquitySubgroup[];
}

function makeSubgroup(
  label: string,
  rows: readonly StudentReportRow[],
  cohortNas: number,
): EquitySubgroup {
  // Below the privacy threshold we publish the count only — never a
  // distribution. In a small school a subgroup percentage is individually
  // identifying, which is exactly what n<5 suppression exists to prevent.
  if (rows.length < PRIVACY_THRESHOLD) {
    return {
      label,
      n: rows.length,
      percentages: proficiencyPercentages([]),
      nasGapVsCohort: 0,
      priorityGap: false,
      suppressed: true,
    };
  }
  const percentages = proficiencyPercentages(rows);
  const gap = percentages[NAS_KEY] - cohortNas;
  return {
    label,
    n: rows.length,
    percentages,
    nasGapVsCohort: gap,
    priorityGap: gap > 5,
    suppressed: false,
  };
}

export function equityBreakdown(reports: readonly StudentReportRow[]): EquityBreakdown {
  const parts = reports.filter((r) => r.participationCode === PARTICIPATED);
  const cohortNas = proficiencyPercentages(reports)[NAS_KEY];

  const lboteYes = parts.filter((r) => r.lboteStatus === "Yes");
  const lboteNo = parts.filter((r) => r.lboteStatus === "No");
  const lboteReported = lboteYes.length > 0 || lboteNo.length > 0;
  const lbote = lboteReported
    ? [makeSubgroup("LBOTE", lboteYes, cohortNas), makeSubgroup("Non-LBOTE", lboteNo, cohortNas)]
    : [];

  const atsiRows = parts.filter((r) => r.atsiGroup === "ATSI");
  const nonAtsiRows = parts.filter((r) => r.atsiGroup === "Non-ATSI");
  const atsiSuppressed = atsiRows.length < PRIVACY_THRESHOLD;
  const atsi = atsiSuppressed
    ? []
    : [
        makeSubgroup("Aboriginal and/or Torres Strait Islander", atsiRows, cohortNas),
        makeSubgroup("Non-Indigenous", nonAtsiRows, cohortNas),
      ];

  return {
    cohortNasPct: cohortNas,
    lboteReported,
    lbote,
    lboteSuppressed: lbote.some((g) => g.suppressed),
    atsiSuppressed,
    atsiCount: atsiRows.length,
    nonAtsiCount: nonAtsiRows.length,
    nonAtsiSuppressed: nonAtsiRows.length < PRIVACY_THRESHOLD,
    atsi,
  };
}
