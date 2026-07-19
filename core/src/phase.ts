/**
 * NAPLAN school-phase logic and attribution wording — the single source of
 * truth for "what does a result at this year level mean?".
 *
 * NAPLAN is sat in Years 3, 5, 7 and 9. The within-school growth pairs are
 * Year 3 → 5 (primary) and Year 7 → 9 (secondary). Year 5 → 7 crosses the
 * primary/secondary boundary, so ONLY a combined P–12 school can track it — the
 * same students stay enrolled from upper primary into early secondary. A
 * standalone primary (no Year 7) or secondary (no Year 5) never has both files,
 * so the pair simply never lights up for them.
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

/**
 * The kind of a cohort PAIR. Distinct from `Phase` (which classifies a single
 * year level): a 5 → 7 pair is a primary→secondary "transition", trackable only
 * within a combined P–12 school. Each value is unique across COHORT_PHASES, so
 * it doubles as the selector key.
 */
export type CohortKind = "primary" | "transition" | "secondary";

/** One within-school cohort pair, entry (earlier) → exit (later) level. */
export interface CohortPhase {
  phase: CohortKind;
  earlier: number;
  later: number;
}

/** The trackable within-school cohort pairs, in school order. Year 5 → 7 sits
 *  between primary and secondary and only ever applies to a combined P–12. */
export const COHORT_PHASES: readonly CohortPhase[] = [
  { phase: "primary", earlier: 3, later: 5 },
  { phase: "transition", earlier: 5, later: 7 },
  { phase: "secondary", earlier: 7, later: 9 },
] as const;

/** Which schooling phase a NAPLAN year level belongs to (3,5 → primary; 7,9 → secondary). */
export function phaseFor(level: number): Phase {
  return level <= 5 ? "primary" : "secondary";
}

/**
 * Best-guess cohort levels to label/prompt with, given the year levels present
 * in a store. Prefers the secondary pair when any secondary level is present
 * (matching `buildCohortPairings`' senior-phase default), else primary. Used for
 * the match-rate banner's labels and its "no cohort yet" prompt.
 */
export function inferCohortLevels(levelsPresent: readonly number[]): { earlier: number; later: number } {
  if (levelsPresent.some((l) => l >= 7)) return { earlier: 7, later: 9 };
  if (levelsPresent.some((l) => l <= 5)) return { earlier: 3, later: 5 };
  return { earlier: 7, later: 9 };
}

/** Short level label as used in charts and tables, e.g. "Y7" or "Y3". */
export function shortLevel(level: number): string {
  return `Y${level}`;
}

/**
 * The attribution caveat shown alongside a single-year view. `year` is the
 * calendar year of the test (e.g. 2026), used only in the Term-1 framing.
 *
 * `schoolHasPrimaryLevels` matters only at Year 7: in a standalone secondary,
 * Year 7 is feeder-school output and must never be read as this school's
 * teaching — but in a combined P–12 the primary school IS this school, so that
 * framing would be wrong. Defaults to false (the standalone-secondary reading).
 */
export function attributionNote(
  level: number,
  year: number,
  opts?: { schoolHasPrimaryLevels?: boolean },
): string {
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
      if (opts?.schoolHasPrimaryLevels) {
        return (
          `Year 7 NAPLAN is sat in Term 1, so it reflects learning up to the end of primary. In a ` +
          `combined school these are students who have been here since primary, so ${year} Year 7 ` +
          `results largely reflect this school's own teaching — read them as the end point of the ` +
          `primary years, not as the secondary years' contribution. For students who arrived from ` +
          `other primary schools, treat their results as intake.`
        );
      }
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
      return "(consecutive Year 9 cohorts — each reflects the school's own teaching)";
  }
}

/** Label for the school value-add measure across a cohort pair. */
export function cohortValueAddLabel(earlier: number, later: number): string {
  if (earlier === 5 && later === 7) {
    return "the school's value-add across the primary–secondary transition (Year 5 → Year 7)";
  }
  const who = phaseFor(later) === "primary" ? "the primary school's" : "the secondary school's";
  return `${who} value-add (Year ${earlier} → Year ${later})`;
}

/** The next schooling step after the later year of a phase — for follow-up wording. */
export function nextStepLabel(phase: Phase): string {
  return phase === "primary" ? "Year 6 and the move into secondary" : "Year 10";
}

/**
 * The next schooling step after a COHORT'S exit level — for follow-up wording.
 * A 5 → 7 transition cohort's next NAPLAN is Year 9 (still within the P–12),
 * not Year 10; everything else follows the exit level's phase.
 */
export function cohortNextStep(earlierLevel: number, laterLevel: number): string {
  if (earlierLevel === 5 && laterLevel === 7) return "Year 9";
  return nextStepLabel(phaseFor(laterLevel));
}

/**
 * The attribution caveat for a paired COHORT (Section 10), keyed on the
 * transition — NOT just the level, because the same level means different things
 * in different pairs (Year 7 is "feeder intake" as the entry of 7 → 9, but
 * "continuous teaching" as the exit of a P–12's 5 → 7). `earlierYear`/`laterYear`
 * are the calendar years the entry/exit groups sat NAPLAN.
 */
export function cohortAttributionNote(
  earlierLevel: number,
  laterLevel: number,
  earlierYear: number,
  laterYear: number,
): string {
  if (earlierLevel === 3 && laterLevel === 5) {
    return (
      `Year 3 (${earlierYear}) is an early baseline that largely reflects this school's own ` +
      `early-years teaching; Year 5 (${laterYear}) reflects the primary school's contribution. ` +
      `True value-add is these same students tracked Year 3 → Year 5. NAPLAN is sat in Term 1, ` +
      `so it is diagnostic evidence to inform planning, not a target-measurement instrument.`
    );
  }
  if (earlierLevel === 5 && laterLevel === 7) {
    return (
      `In a combined P–12 school the cohort stays enrolled throughout: Year 5 (${earlierYear}) is ` +
      `the entry baseline at the end of upper primary, and Year 7 (${laterYear}) reflects the ` +
      `school's continuous teaching across the move into secondary — NOT feeder intake (the ` +
      `Year 7 framing that applies to a standalone secondary). True value-add is these same ` +
      `students tracked Year 5 → Year 7.`
    );
  }
  // 7 → 9 (and any other secondary pair)
  return (
    `Year 7 (${earlierYear}) NAPLAN is sat in Term 1 — it reflects students' primary-school ` +
    `learning (feeder-cohort intake), not this school's teaching; Year 9 (${laterYear}) reflects ` +
    `the secondary school's contribution (the cohort has had ~2 years here). True value-add is ` +
    `these same students tracked Year 7 → Year 9.`
  );
}
