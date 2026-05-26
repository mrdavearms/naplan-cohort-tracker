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
import { COHORT_PHASES, type CohortPhase } from "./phase";
import { bandMovement, cohortHeadline, type BandMovement } from "./sections/cohortTracking";
import { getEntry, type Store } from "./store";
import type { PairedCohort } from "./types";

/** (earlierYear, laterYear) — same students two years apart. */
export function cohortYears(primaryYear: number): [number, number] {
  return [primaryYear - 2, primaryYear];
}

/**
 * The cohort phases that actually have trackable data for `primaryYear`: a phase
 * is trackable when at least one domain has BOTH an earlier-level entry
 * (primaryYear−2) and a later-level entry (primaryYear). Returns them in school
 * order (primary before secondary) — a single-phase school gets one, a combined
 * P–12 school gets both.
 */
export function trackablePhases(store: Store, primaryYear: number): CohortPhase[] {
  const [earlierYear, laterYear] = cohortYears(primaryYear);
  return COHORT_PHASES.filter((p) =>
    VALID_DOMAINS.some(
      (dom) =>
        getEntry(store, earlierYear, p.earlier, dom) && getEntry(store, laterYear, p.later, dom),
    ),
  );
}

/**
 * Build a PairedCohort per domain for a single phase. A primary school's data
 * resolves to the (3 → 5) phase, a secondary school's to (7 → 9). When no phase
 * is given, the trackable phase is detected; if both are present (P–12), the
 * secondary phase is used here — the per-phase view (Section 10) selects between
 * them. Domains are visited in canonical order.
 */
export function buildCohortPairings(
  store: Store,
  primaryYear: number,
  phase?: CohortPhase,
): Map<string, PairedCohort> {
  const phases = trackablePhases(store, primaryYear);
  // Default: prefer the senior phase when more than one is present.
  const active = phase ?? phases[phases.length - 1];
  const out = new Map<string, PairedCohort>();
  if (!active) return out;
  const [earlierYear, laterYear] = cohortYears(primaryYear);
  for (const dom of VALID_DOMAINS) {
    const earlier = getEntry(store, earlierYear, active.earlier, dom);
    const later = getEntry(store, laterYear, active.later, dom);
    if (earlier && later) {
      out.set(
        dom,
        buildPairedCohort(earlier.studentReports, later.studentReports, dom, active.earlier, active.later),
      );
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

export interface CrossDomainRow {
  domain: string;
  pairedN: number;
  y7NasPct: number;
  y9NasPct: number;
  deltaNasPp: number;
  y7MeetingPct: number;
  y9MeetingPct: number;
  deltaMeetingPp: number;
  movement: BandMovement;
}

/** Per-domain headline + movement for the cross-domain overview. Domains appear
 *  in the pairings' insertion order (canonical VALID_DOMAINS order). */
export function crossDomainSummary(pairings: Map<string, PairedCohort>): CrossDomainRow[] {
  const out: CrossDomainRow[] = [];
  for (const pc of pairings.values()) {
    const h = cohortHeadline(pc);
    out.push({
      domain: h.domain,
      pairedN: h.pairedN,
      y7NasPct: h.y7NasPct,
      y9NasPct: h.y9NasPct,
      deltaNasPp: h.deltaNasPp,
      y7MeetingPct: h.y7MeetingPct,
      y9MeetingPct: h.y9MeetingPct,
      deltaMeetingPp: h.deltaMeetingPp,
      movement: bandMovement(pc),
    });
  }
  return out;
}
