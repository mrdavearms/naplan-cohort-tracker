/**
 * NAPLAN school-phase logic and attribution wording — the single source of
 * truth for "what does a result at this year level mean?".
 *
 * NAPLAN is sat in Years 3, 5, 7 and 9. The within-school growth pairs are
 * Year 3 → 5 (primary) and Year 7 → 9 (secondary); Year 5 → 7 crosses the
 * primary/secondary boundary (different schools), so no single school tracks it.
 *
 * Phase is DATA, inferred from the year level being viewed — never a global
 * setting. A combined (P–12) school shows primary framing on its Year 3/5 views
 * and secondary framing on its Year 7/9 views at the same time, so the framing
 * must travel with the level, not the install.
 *
 * Attribution framing is non-negotiable (CLAUDE.md): NAPLAN is sat in Term 1,
 * so an earlier-year result partly reflects prior schooling. For SECONDARY this
 * is stark — Year 7 is wholly primary-school / feeder output. For PRIMARY the
 * earlier year (Year 3) still substantially reflects this school's own early
 * years, so it is framed as a baseline, not as "someone else's teaching".
 */

export type Phase = "primary" | "secondary";

/** One within-school cohort pair, entry (earlier) → exit (later) level. */
export interface CohortPhase {
  phase: Phase;
  earlier: number;
  later: number;
}

/** The two trackable within-school cohort pairs, in school order. */
export const COHORT_PHASES: readonly CohortPhase[] = [
  { phase: "primary", earlier: 3, later: 5 },
  { phase: "secondary", earlier: 7, later: 9 },
] as const;

/** Which schooling phase a NAPLAN year level belongs to (3,5 → primary; 7,9 → secondary). */
export function phaseFor(level: number): Phase {
  return level <= 5 ? "primary" : "secondary";
}

/** Short level label as used in charts and tables, e.g. "Y7" or "Y3". */
export function shortLevel(level: number): string {
  return `Y${level}`;
}

/**
 * The attribution caveat shown alongside a single-year view. `year` is the
 * calendar year of the test (e.g. 2026), used only in the Term-1 framing.
 */
export function attributionNote(level: number, year: number): string {
  switch (level) {
    case 3:
      return (
        `Year 3 NAPLAN is sat in Term 1 — an early baseline of the cohort. For children who ` +
        `have been here since Foundation it largely reflects this school's early-years teaching, ` +
        `though some arrive later with learning from elsewhere. Treat ${year} Year 3 results as a ` +
        `starting point, not yet a measure of mid-primary teaching.`
      );
    case 5:
      return (
        `Year 5 reflects this school's primary teaching (the cohort has been here roughly five ` +
        `years) — the primary school's contribution. NAPLAN is diagnostic evidence to inform ` +
        `planning, not a target-measurement instrument.`
      );
    case 7:
      return (
        `Year 7 NAPLAN is sat in Term 1 — it reflects students' primary-school learning, not this ` +
        `school's teaching. Treat ${year} Year 7 results as feeder-cohort intake, not a measure of ` +
        `the school improving or declining.`
      );
    default: // 9 (and any other secondary-phase level)
      return (
        `Year 9 reflects the secondary school's contribution (the cohort has had ~2 years here). ` +
        `NAPLAN is diagnostic evidence to inform planning, not a target-measurement instrument.`
      );
  }
}

/**
 * Short caveat for a year-on-year view (different cohorts each year at one level).
 * The entry level (3 / 7) carries the "not a fixed measure" caveat; the exit
 * level (5 / 9) is framed as consecutive cohorts of the school's own students.
 */
export function yearOnYearContext(level: number): string {
  switch (level) {
    case 3:
      return "(different Year 3 cohorts each year — an early-primary baseline, not a fixed measure)";
    case 5:
      return "(consecutive Year 5 cohorts — the primary school's own students)";
    case 7:
      return "(feeder-cohort variation — not a secondary-school performance measure)";
    default: // 9
      return "(consecutive Year 9 cohorts)";
  }
}

/** Label for the school value-add measure across a cohort pair. */
export function cohortValueAddLabel(earlier: number, later: number): string {
  const who = phaseFor(later) === "primary" ? "the primary school's" : "the secondary school's";
  return `${who} value-add (Year ${earlier} → Year ${later})`;
}

/** The next schooling step after the later year of a phase — for follow-up wording. */
export function nextStepLabel(phase: Phase): string {
  return phase === "primary" ? "Year 6 and the move into secondary" : "Year 10";
}
