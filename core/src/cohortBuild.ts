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
import { getEntry, storeEntries, type Store } from "./store";
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

export interface CohortReadiness {
  phase: CohortPhase;
  /** Calendar year the entry (earlier) level sat — the exit year minus 2. */
  earlierYear: number;
  /** Calendar year the exit (later) level sat. */
  laterYear: number;
  hasEarlier: boolean;
  hasLater: boolean;
  complete: boolean;
}

/**
 * What two-year cohorts the loaded data can track — and, crucially, which are
 * only HALF present, so the UI can say exactly which file to add (the original
 * "stuck and I don't know why" case becomes self-diagnosing). Scans every
 * calendar year in the store, not just the selected year.
 *
 * The 5 → 7 transition is only considered for a P–12 (a primary-phase AND a
 * secondary-phase level both present) and only surfaced when COMPLETE, so a
 * single-phase school is never nagged about a Year 5 or Year 7 file it will
 * never have.
 */
export function cohortReadiness(store: Store): CohortReadiness[] {
  const entries = storeEntries(store);
  const present = new Set(entries.map((e) => `${e.yearLevel}|${e.yearOfTest}`));
  const has = (level: number, year: number): boolean => present.has(`${level}|${year}`);
  const levels = new Set(entries.map((e) => e.yearLevel));
  const isP12 = [...levels].some((l) => l <= 5) && [...levels].some((l) => l >= 7);

  const out: CohortReadiness[] = [];
  for (const phase of COHORT_PHASES) {
    const transition = phase.phase === "transition";
    if (transition && !isP12) continue;

    // Candidate exit years: any year an entry- or exit-level file is present for.
    const exitYears = new Set<number>();
    for (const e of entries) {
      if (e.yearLevel === phase.later) exitYears.add(e.yearOfTest);
      if (e.yearLevel === phase.earlier) exitYears.add(e.yearOfTest + 2);
    }

    for (const laterYear of exitYears) {
      const hasEarlier = has(phase.earlier, laterYear - 2);
      const hasLater = has(phase.later, laterYear);
      const complete = hasEarlier && hasLater;
      // Only surface the transition when fully present; for primary/secondary,
      // a single present half is the actionable "add the other file" case.
      if (transition && !complete) continue;
      if (!hasEarlier && !hasLater) continue;
      out.push({ phase, earlierYear: laterYear - 2, laterYear, hasEarlier, hasLater, complete });
    }
  }
  // Most recent exit year first; within a year, school order (primary → secondary).
  return out.sort((a, b) => b.laterYear - a.laterYear || a.phase.earlier - b.phase.earlier);
}

export interface CohortMatchRate {
  /** Domain the headline counts are taken from (the largest cohort). */
  representativeDomain: string | null;
  /** Students present and proficiency-scored in BOTH years (matched by Local ID). */
  matched: number;
  /** Sat the entry year here but gone by the exit year. */
  leavers: number;
  /** Joined after the entry year (only in the exit year). */
  joiners: number;
  /** Paired by ID but dropped — no proficiency record one year (Absent/Withdrawn). */
  filtered: number;
  /** Entry-year cohort = matched + leavers (Year 3 for primary, Year 7 for secondary). */
  earlierCohortTotal: number;
  /** Exit-year cohort = matched + joiners (Year 5 for primary, Year 9 for secondary). */
  laterCohortTotal: number;
  /** matched / laterCohortTotal × 100 (0 when no exit-year cohort). */
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
      earlierCohortTotal: 0,
      laterCohortTotal: 0,
      matchRatePct: 0,
    };
  }

  const matched = best.paired.length;
  const leavers = best.leavers.length;
  const joiners = best.joiners.length;
  const laterCohortTotal = matched + joiners;
  return {
    representativeDomain: best.domain,
    matched,
    leavers,
    joiners,
    filtered: best.pairedFilteredCount,
    earlierCohortTotal: matched + leavers,
    laterCohortTotal,
    matchRatePct: laterCohortTotal > 0 ? (matched / laterCohortTotal) * 100 : 0,
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
