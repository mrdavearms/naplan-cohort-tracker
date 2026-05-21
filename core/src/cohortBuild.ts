/**
 * Cohort-tracking assembly (Section 10) — pure. Pairs the same students from
 * Y7 (primaryYear − 2) to Y9 (primaryYear) per domain, and summarises the
 * Y7↔Y9 ID match rate for the visible banner.
 *
 * Ported from the legacy `naplan/loader.py::cohort_years` and
 * `naplan/sections/s10_cohort_tracking.py::_pair_all_domains`.
 */
import { buildPairedCohort } from "./cohort";
import { VALID_DOMAINS } from "./constants";
import { getEntry, type Store } from "./store";
import type { PairedCohort } from "./types";

/** (y7Year, y9Year) — same students two years apart. */
export function cohortYears(primaryYear: number): [number, number] {
  return [primaryYear - 2, primaryYear];
}

/**
 * Build a PairedCohort for every domain that has BOTH a Y7 entry (primaryYear−2)
 * and a Y9 entry (primaryYear). Domains are visited in canonical order.
 */
export function buildCohortPairings(
  store: Store,
  primaryYear: number,
): Map<string, PairedCohort> {
  const [y7Year, y9Year] = cohortYears(primaryYear);
  const out = new Map<string, PairedCohort>();
  for (const dom of VALID_DOMAINS) {
    const y7 = getEntry(store, y7Year, 7, dom);
    const y9 = getEntry(store, y9Year, 9, dom);
    if (y7 && y9) {
      out.set(dom, buildPairedCohort(y7.studentReports, y9.studentReports, dom));
    }
  }
  return out;
}

export interface CohortMatchRate {
  /** Domain the headline counts are taken from (the largest cohort). */
  representativeDomain: string | null;
  /** Students present and proficiency-scored in BOTH years (matched by Local ID). */
  matched: number;
  /** Sat Y7 here but gone by Y9. */
  leavers: number;
  /** Joined after Y7 (only in Y9). */
  joiners: number;
  /** Paired by ID but dropped — no proficiency record one year (Absent/Withdrawn). */
  filtered: number;
  /** Y7-origin cohort = matched + leavers. */
  y7CohortTotal: number;
  /** This year's Y9 cohort = matched + joiners. */
  y9CohortTotal: number;
  /** matched / y9CohortTotal × 100 (0 when no Y9 cohort). */
  matchRatePct: number;
}

/**
 * Summarise the ID match rate for the banner. Counts are person-level, so —
 * like the legacy headline — they are reported from a single representative
 * domain rather than summed across domains. We pick the domain with the
 * largest total cohort (matched + leavers + joiners) so a sparse first domain
 * can't understate it.
 */
export function cohortMatchRate(pairings: Map<string, PairedCohort>): CohortMatchRate {
  let best: PairedCohort | null = null;
  let bestTotal = -1;
  for (const pc of pairings.values()) {
    const total = pc.paired.length + pc.leavers.length + pc.joiners.length;
    if (total > bestTotal) {
      bestTotal = total;
      best = pc;
    }
  }

  if (!best) {
    return {
      representativeDomain: null,
      matched: 0,
      leavers: 0,
      joiners: 0,
      filtered: 0,
      y7CohortTotal: 0,
      y9CohortTotal: 0,
      matchRatePct: 0,
    };
  }

  const matched = best.paired.length;
  const leavers = best.leavers.length;
  const joiners = best.joiners.length;
  const y9CohortTotal = matched + joiners;
  return {
    representativeDomain: best.domain,
    matched,
    leavers,
    joiners,
    filtered: best.pairedFilteredCount,
    y7CohortTotal: matched + leavers,
    y9CohortTotal,
    matchRatePct: y9CohortTotal > 0 ? (matched / y9CohortTotal) * 100 : 0,
  };
}
