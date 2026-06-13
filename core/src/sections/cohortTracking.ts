/**
 * Section 10 — Cohort tracking drill-downs (pure computation).
 * Ported from `naplan/sections/s10_cohort_tracking.py`.
 *
 * The stats core (McNemar, transition matrix, Wilson CI) lives in cohort.ts.
 * This module ports the drill-down computations: headline summary, attrition /
 * selection-effect, equity sub-cohorts (with privacy suppression), reading
 * subdomain movement, and class-group tracking. The rules-based narrative and
 * interpretation bullets are ported separately (they carry school-identity
 * data). Sub-cohort membership uses Y7 (entry-state) status only.
 */
import { NAS, PROFICIENCY_LEVELS, type ProficiencyLevel } from "../constants";
import { transitionMatrix } from "../cohort";
import type { PairedCohort, PairedStudent, StudentResultRow } from "../types";

export const COHORT_SUPPRESSION_THRESHOLD = 5; // n < 5 suppressed entirely
export const COHORT_CAVEAT_CEILING = 9; // 5..9 shown with a caveat

type LevelMap = Record<ProficiencyLevel, number>;
function emptyLevelMap(): LevelMap {
  return { "Needs additional support": 0, Developing: 0, Strong: 0, Exceeding: 0 };
}

export type PairedYear = "Y7" | "Y9";

/** A test over a single proficiency level — the same shape the v1.3 metric
 *  descriptor (`{label, predicate, lowerIsBetter}`) will supply, so a metric
 *  retrofit can reuse `levelSetCount` without changing its signature. */
export type LevelPredicate = (level: string) => boolean;

const isNas: LevelPredicate = (l) => l === NAS;
const isMeeting: LevelPredicate = (l) => l === "Strong" || l === "Exceeding";

/**
 * How many paired students sit in a given "level set" (e.g. NAS, or Meeting+)
 * for the chosen year. The companion student count behind every percentage and
 * pp delta in Section 10 — so leadership reads "−8.5pp · 6 fewer at NAS", not a
 * bare percentage on a small cohort.
 */
export function levelSetCount(
  paired: readonly PairedStudent[],
  year: PairedYear,
  predicate: LevelPredicate,
): number {
  let count = 0;
  for (const s of paired) {
    const lvl = year === "Y7" ? s.proficiencyY7 : s.proficiencyY9;
    if (predicate(lvl)) count += 1;
  }
  return count;
}

/** % of paired students at each proficiency level for the given year. */
export function pairedProficiencyDistribution(
  paired: readonly PairedStudent[],
  year: PairedYear,
): LevelMap {
  const n = paired.length;
  const counts = emptyLevelMap();
  for (const s of paired) {
    const lvl = year === "Y7" ? s.proficiencyY7 : s.proficiencyY9;
    if (lvl in counts) counts[lvl as ProficiencyLevel] += 1;
  }
  const pct = emptyLevelMap();
  for (const lvl of PROFICIENCY_LEVELS) pct[lvl] = n === 0 ? 0 : (counts[lvl] / n) * 100;
  return pct;
}

export interface BandMovement {
  /** Students who moved up >= 1 proficiency band Y7 -> Y9. */
  up: number;
  /** Students who stayed in the same band. */
  stayed: number;
  /** Students who moved down >= 1 band. */
  down: number;
  total: number;
  upPct: number;
  stayedPct: number;
  downPct: number;
}

/** Up / stayed / down summary of the paired cohort, derived from the
 *  oracle-validated transition matrix (rows = Y7 band, cols = Y9 band, in
 *  PROFICIENCY_LEVELS order). Above the diagonal = up, diagonal = stayed,
 *  below = down. */
export function bandMovement(pc: PairedCohort): BandMovement {
  const m = transitionMatrix(pc.paired);
  let up = 0;
  let stayed = 0;
  let down = 0;
  for (let i = 0; i < m.length; i++) {
    for (let j = 0; j < m.length; j++) {
      const c = m[i]![j]!;
      if (j > i) up += c;
      else if (j === i) stayed += c;
      else down += c;
    }
  }
  const total = up + stayed + down;
  const pct = (x: number): number => (total > 0 ? (x / total) * 100 : 0);
  return { up, stayed, down, total, upPct: pct(up), stayedPct: pct(stayed), downPct: pct(down) };
}

export interface PairedStudentMove {
  localStudentId: string;
  classGroupY7: string | null;
  classGroupY9: string | null;
  proficiencyY7: string;
  proficiencyY9: string;
}

export interface DeclinedStalled {
  /** Moved down >= 1 proficiency band Y7 -> Y9. */
  declined: PairedStudentMove[];
  /** Needs additional support in BOTH years. */
  stalled: PairedStudentMove[];
}

/** Faculty target lists, by Local Student ID (never names): students who
 *  dropped a band, and students who stalled at NAS across Y7 -> Y9. */
export function declinedOrStalled(pc: PairedCohort): DeclinedStalled {
  const rank = (band: string): number => (PROFICIENCY_LEVELS as readonly string[]).indexOf(band);
  const toMove = (s: PairedStudent): PairedStudentMove => ({
    localStudentId: s.localStudentId,
    classGroupY7: s.classGroupY7,
    classGroupY9: s.classGroupY9,
    proficiencyY7: s.proficiencyY7,
    proficiencyY9: s.proficiencyY9,
  });
  const declined: PairedStudentMove[] = [];
  const stalled: PairedStudentMove[] = [];
  for (const s of pc.paired) {
    const r7 = rank(s.proficiencyY7);
    const r9 = rank(s.proficiencyY9);
    if (r7 >= 0 && r9 >= 0 && r9 < r7) declined.push(toMove(s));
    if (s.proficiencyY7 === NAS && s.proficiencyY9 === NAS) stalled.push(toMove(s));
  }
  return { declined, stalled };
}

export interface ImprovedStudent extends PairedStudentMove {
  /** Was NAS at entry, no longer NAS at exit — the recognition headline. */
  leftNas: boolean;
}

/**
 * 1-4 — the recognition list: matched students who moved UP at least one
 * proficiency band (the mirror of `declinedOrStalled`). Classes are carried so
 * leadership can spot which groups/interventions the improvers shared.
 */
export function improved(pc: PairedCohort): ImprovedStudent[] {
  const rank = (band: string): number => (PROFICIENCY_LEVELS as readonly string[]).indexOf(band);
  const out: ImprovedStudent[] = [];
  for (const s of pc.paired) {
    const r7 = rank(s.proficiencyY7);
    const r9 = rank(s.proficiencyY9);
    if (r7 >= 0 && r9 >= 0 && r9 > r7) {
      out.push({
        localStudentId: s.localStudentId,
        classGroupY7: s.classGroupY7,
        classGroupY9: s.classGroupY9,
        proficiencyY7: s.proficiencyY7,
        proficiencyY9: s.proficiencyY9,
        leftNas: s.proficiencyY7 === NAS && s.proficiencyY9 !== NAS,
      });
    }
  }
  return out;
}

export type FollowUpFlag = "Declined" | "Stalled at NAS";

export interface CrossDomainFollowUpFlag {
  domain: string;
  flag: FollowUpFlag;
}

export interface CrossDomainFollowUpRow {
  localStudentId: string;
  /** One entry per domain the student was flagged in (canonical domain order). */
  flags: CrossDomainFollowUpFlag[];
  domains: string[];
  /** Number of domains flagged — 2+ is a genuine intervention priority. */
  domainCount: number;
}

/**
 * 1-5 — cross-domain follow-up intersection. Joins each domain's declined/stalled
 * list by Local Student ID across the active phase, so a student flagged in
 * multiple domains surfaces as a priority. Sorted by domain count (desc), then
 * Local ID. A student is at most one of declined/stalled within a domain (can't
 * drop a band AND be NAS in both years), so `domainCount` = distinct domains.
 */
export function crossDomainFollowUp(pairings: Map<string, PairedCohort>): CrossDomainFollowUpRow[] {
  const byStudent = new Map<string, CrossDomainFollowUpFlag[]>();
  const add = (id: string, f: CrossDomainFollowUpFlag): void => {
    const list = byStudent.get(id);
    if (list) list.push(f);
    else byStudent.set(id, [f]);
  };
  // pairings iterates in canonical VALID_DOMAINS order, so flags accrue in order.
  for (const pc of pairings.values()) {
    const ds = declinedOrStalled(pc);
    for (const s of ds.declined) add(s.localStudentId, { domain: pc.domain, flag: "Declined" });
    for (const s of ds.stalled) add(s.localStudentId, { domain: pc.domain, flag: "Stalled at NAS" });
  }
  const rows: CrossDomainFollowUpRow[] = [...byStudent.entries()].map(([localStudentId, flags]) => ({
    localStudentId,
    flags,
    domains: flags.map((f) => f.domain),
    domainCount: flags.length,
  }));
  rows.sort((a, b) => b.domainCount - a.domainCount || a.localStudentId.localeCompare(b.localStudentId));
  return rows;
}

export interface CohortHeadlineRow {
  domain: string;
  pairedN: number;
  y7NasPct: number;
  y9NasPct: number;
  deltaNasPp: number;
  y7MeetingPct: number;
  y9MeetingPct: number;
  deltaMeetingPp: number;
  // Student counts behind every percentage (1-1) — the same paired denominator.
  y7NasCount: number;
  y9NasCount: number;
  /** Net change in the number at NAS (y9 − y7); negative = fewer at NAS. */
  deltaNasCount: number;
  y7MeetingCount: number;
  y9MeetingCount: number;
  /** Net change in the number Meeting+ (y9 − y7); positive = more Meeting+. */
  deltaMeetingCount: number;
}

/** Per-domain headline: paired NAS% and Meeting+ (Strong+Exceeding), Y7 vs Y9,
 *  each with the student count behind it. */
export function cohortHeadline(pc: PairedCohort): CohortHeadlineRow {
  const n = pc.paired.length;
  const y7NasCount = levelSetCount(pc.paired, "Y7", isNas);
  const y9NasCount = levelSetCount(pc.paired, "Y9", isNas);
  const y7MeetingCount = levelSetCount(pc.paired, "Y7", isMeeting);
  const y9MeetingCount = levelSetCount(pc.paired, "Y9", isMeeting);
  const toPct = (c: number): number => (n === 0 ? 0 : (c / n) * 100);
  return {
    domain: pc.domain,
    pairedN: n,
    y7NasPct: toPct(y7NasCount),
    y9NasPct: toPct(y9NasCount),
    deltaNasPp: toPct(y9NasCount) - toPct(y7NasCount),
    y7MeetingPct: toPct(y7MeetingCount),
    y9MeetingPct: toPct(y9MeetingCount),
    deltaMeetingPp: toPct(y9MeetingCount) - toPct(y7MeetingCount),
    y7NasCount,
    y9NasCount,
    deltaNasCount: y9NasCount - y7NasCount,
    y7MeetingCount,
    y9MeetingCount,
    deltaMeetingCount: y9MeetingCount - y7MeetingCount,
  };
}

export interface AttritionAnalysis {
  domain: string;
  stayersN: number;
  leaversN: number;
  stayersY7Distribution: LevelMap;
  leaversY7Distribution: LevelMap;
  stayersNasCount: number;
  leaversNasCount: number;
  stayersNasPct: number;
  leaversNasPct: number;
}

/** Selection-effect check: Y7 proficiency mix of stayers (paired) vs leavers. */
export function attritionAnalysis(pc: PairedCohort): AttritionAnalysis {
  const stayerN = pc.paired.length;
  const leaverN = pc.leavers.length;

  const stayersDist = emptyLevelMap();
  for (const s of pc.paired) {
    if (s.proficiencyY7 in stayersDist) stayersDist[s.proficiencyY7 as ProficiencyLevel] += 1;
  }
  const leaversDist = emptyLevelMap();
  for (const l of pc.leavers) {
    if (l.proficiencyY7 != null && l.proficiencyY7 in leaversDist) {
      leaversDist[l.proficiencyY7 as ProficiencyLevel] += 1;
    }
  }

  const stayersNasCount = stayersDist[NAS];
  const leaversNasCount = leaversDist[NAS];

  const toPct = (counts: LevelMap, denom: number): LevelMap => {
    const out = emptyLevelMap();
    const d = Math.max(denom, 1);
    for (const lvl of PROFICIENCY_LEVELS) out[lvl] = (counts[lvl] / d) * 100;
    return out;
  };

  return {
    domain: pc.domain,
    stayersN: stayerN,
    leaversN: leaverN,
    stayersY7Distribution: toPct(stayersDist, stayerN),
    leaversY7Distribution: toPct(leaversDist, leaverN),
    stayersNasCount,
    leaversNasCount,
    stayersNasPct: (stayersNasCount / Math.max(stayerN, 1)) * 100,
    leaversNasPct: (leaversNasCount / Math.max(leaverN, 1)) * 100,
  };
}

export interface AttritionComposition {
  stayersN: number;
  leaversN: number;
  /** Entry-year sitters = stayers + leavers (everyone with an earlier-year record). */
  fullCohortN: number;
  stayersEntryNasPct: number;
  fullCohortEntryNasPct: number;
  /** stayers − full cohort, in pp. Negative = the matched group started with a
   *  LOWER NAS rate than the full entry cohort (a lower-need slice stayed). */
  diffPp: number;
}

/**
 * Baseline-composition difference (1-2): how the matched (stayers) group's
 * entry-year NAS rate compares to the full entry cohort's (stayers + leavers).
 * This quantifies WHO is in the tracked group; it is NOT a correction to the
 * headline — leavers' exit-year outcomes are unknowable, so their effect on the
 * cohort change cannot be recovered.
 */
export function attritionComposition(pc: PairedCohort): AttritionComposition {
  const stayersN = pc.paired.length;
  const leaversN = pc.leavers.length;
  const fullCohortN = stayersN + leaversN;
  const stayersNas = levelSetCount(pc.paired, "Y7", isNas);
  const leaversNas = pc.leavers.filter((l) => l.proficiencyY7 === NAS).length;
  const stayersEntryNasPct = stayersN > 0 ? (stayersNas / stayersN) * 100 : 0;
  const fullCohortEntryNasPct = fullCohortN > 0 ? ((stayersNas + leaversNas) / fullCohortN) * 100 : 0;
  return {
    stayersN,
    leaversN,
    fullCohortN,
    stayersEntryNasPct,
    fullCohortEntryNasPct,
    diffPp: stayersEntryNasPct - fullCohortEntryNasPct,
  };
}

export interface DetectabilityFloor {
  pairedN: number;
  /** Smallest number of one-directional discordant movers whose exact-McNemar
   *  best-case p (2·0.5^D) clears alpha — 6 at alpha = 0.05. */
  minMovers: number;
  /** minMovers / pairedN × 100, rounded to whole pp — the smallest NAS change
   *  that could possibly reach significance, even with all movement one way. */
  minDeltaPp: number;
  /** false when pairedN < minMovers: no NAS change can reach significance. */
  feasible: boolean;
}

/**
 * 1-3 — the exact-McNemar detectability floor (NOT a power estimate). With all
 * discordant movement one-directional, the exact-McNemar p is 2·0.5^D, so the
 * smallest detectable change needs `minMovers` one-way movers (6 at p<0.05:
 * D=6 → p≈0.031, D=5 → 0.0625). Any offsetting movement only raises the bar, so
 * this is a best-case floor — reused by the v1.5 what-if slider (4-1).
 */
export function detectabilityFloor(pairedN: number, alpha = 0.05): DetectabilityFloor {
  let minMovers = 1;
  while (2 * Math.pow(0.5, minMovers) >= alpha) minMovers += 1;
  return {
    pairedN,
    minMovers,
    minDeltaPp: pairedN > 0 ? Math.round((minMovers / pairedN) * 100) : 0,
    feasible: pairedN >= minMovers,
  };
}

export interface SubCohortRow {
  subgroup: string;
  n: number;
  suppressed: boolean;
  /** true when 5 <= n <= 9 (shown, but treat as indicative). */
  caveat: boolean;
  y7NasPct: number | null;
  y9NasPct: number | null;
  deltaNasPp: number | null;
  // Student counts behind the percentages (1-1); null when suppressed.
  y7NasCount: number | null;
  y9NasCount: number | null;
}

function subCohortRow(label: string, group: PairedStudent[]): SubCohortRow {
  const n = group.length;
  if (n < COHORT_SUPPRESSION_THRESHOLD) {
    return {
      subgroup: label,
      n,
      suppressed: true,
      caveat: false,
      y7NasPct: null,
      y9NasPct: null,
      deltaNasPp: null,
      y7NasCount: null,
      y9NasCount: null,
    };
  }
  const y7Count = levelSetCount(group, "Y7", isNas);
  const y9Count = levelSetCount(group, "Y9", isNas);
  const y7 = (y7Count / n) * 100;
  const y9 = (y9Count / n) * 100;
  return {
    subgroup: label,
    n,
    suppressed: false,
    caveat: n <= COHORT_CAVEAT_CEILING,
    y7NasPct: y7,
    y9NasPct: y9,
    deltaNasPp: y9 - y7,
    y7NasCount: y7Count,
    y9NasCount: y9Count,
  };
}

/** LBOTE and ATSI sub-cohort NAS movement within the matched cohort (Y7 status). */
export function equitySubCohorts(pc: PairedCohort): SubCohortRow[] {
  const p = pc.paired;
  return [
    subCohortRow("LBOTE Yes (Y7)", p.filter((s) => s.lboteStatus === "Yes")),
    subCohortRow("LBOTE No (Y7)", p.filter((s) => s.lboteStatus === "No")),
    subCohortRow("Aboriginal and/or TSI (Y7)", p.filter((s) => s.atsiGroup === "ATSI")),
    subCohortRow("Non-Indigenous (Y7)", p.filter((s) => s.atsiGroup === "Non-ATSI")),
  ];
}

export interface SubdomainMovement {
  subdomain: string;
  y7PctCorrect: number | null;
  y9PctCorrect: number | null;
  deltaPp: number | null;
}

function accuracyBySubdomain(results: readonly StudentResultRow[]): Map<string, number> {
  const groups = new Map<string, { correct: number; total: number }>();
  for (const r of results) {
    if (r.subdomain == null) continue;
    let g = groups.get(r.subdomain);
    if (!g) {
      g = { correct: 0, total: 0 };
      groups.set(r.subdomain, g);
    }
    g.total += 1;
    if (r.studentMarkedResponse === "Correct") g.correct += 1;
  }
  const out = new Map<string, number>();
  for (const [sub, g] of groups) out.set(sub, g.total > 0 ? (g.correct / g.total) * 100 : 0);
  return out;
}

/** Y7 vs Y9 % correct per subdomain (capability against the year-level
 *  standard). Domain-agnostic — pass either year's Student Results rows. */
export function subdomainMovement(
  y7Results: readonly StudentResultRow[],
  y9Results: readonly StudentResultRow[],
): SubdomainMovement[] {
  const y7 = accuracyBySubdomain(y7Results);
  const y9 = accuracyBySubdomain(y9Results);
  const subs = [...new Set([...y7.keys(), ...y9.keys()])].sort((a, b) => a.localeCompare(b));
  return subs.map((subdomain) => {
    const a = y7.get(subdomain) ?? null;
    const b = y9.get(subdomain) ?? null;
    return { subdomain, y7PctCorrect: a, y9PctCorrect: b, deltaPp: a != null && b != null ? b - a : null };
  });
}

export const LEFT_WHS = "left WHS";

export interface ClassGroupDestination {
  y9Class: string;
  n: number;
}

export interface ClassGroupTrackingRow {
  y7Class: string;
  total: number;
  stayed: number;
  left: number;
  y7NasCount: number;
  y7NasPct: number;
  pairedSubsetN: number;
  y9NasCount: number;
  y9NasPct: number;
  destinations: ClassGroupDestination[];
}

interface ClassMember {
  y9Class: string; // a real class, or LEFT_WHS
  proficiencyY7: string | null;
  proficiencyY9: string | null;
}

/** Per Y7 class: where students went by Y9 (or left), and Y7/Y9 NAS rates. */
export function classGroupTracking(pc: PairedCohort): ClassGroupTrackingRow[] {
  const byClass = new Map<string, ClassMember[]>();
  const add = (y7Class: string | null, m: ClassMember) => {
    if (y7Class == null) return; // pandas drops NaN class groups
    const bucket = byClass.get(y7Class);
    if (bucket) bucket.push(m);
    else byClass.set(y7Class, [m]);
  };
  for (const s of pc.paired) {
    add(s.classGroupY7, { y9Class: s.classGroupY9 ?? "(unassigned)", proficiencyY7: s.proficiencyY7, proficiencyY9: s.proficiencyY9 });
  }
  for (const l of pc.leavers) {
    add(l.classGroupY7, { y9Class: LEFT_WHS, proficiencyY7: l.proficiencyY7, proficiencyY9: null });
  }

  const rows: ClassGroupTrackingRow[] = [];
  for (const [y7Class, members] of byClass) {
    const total = members.length;
    const stayers = members.filter((m) => m.y9Class !== LEFT_WHS);
    const left = total - stayers.length;
    const y7NasCount = members.filter((m) => m.proficiencyY7 === NAS).length;
    const y9NasCount = stayers.filter((m) => m.proficiencyY9 === NAS).length;

    const destCounts = new Map<string, number>();
    for (const m of stayers) destCounts.set(m.y9Class, (destCounts.get(m.y9Class) ?? 0) + 1);
    const destinations: ClassGroupDestination[] = [...destCounts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([y9Class, n]) => ({ y9Class, n }));
    if (left > 0) destinations.push({ y9Class: LEFT_WHS, n: left });

    rows.push({
      y7Class,
      total,
      stayed: stayers.length,
      left,
      y7NasCount,
      y7NasPct: total > 0 ? (y7NasCount / total) * 100 : 0,
      pairedSubsetN: stayers.length,
      y9NasCount,
      y9NasPct: stayers.length > 0 ? (y9NasCount / stayers.length) * 100 : 0,
      destinations,
    });
  }
  rows.sort((a, b) => a.y7Class.localeCompare(b.y7Class));
  return rows;
}
