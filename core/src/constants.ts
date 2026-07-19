/** Domain constants ported from the legacy `naplan/cohort.py` / `naplan/loader.py`.
 *  String values must match the SSSR data exactly — they drive keying and the
 *  transition matrix. */

/** Proficiency levels in fixed order — the order drives the transition matrix
 *  (rows = Y7 level, columns = Y9 level). */
export const PROFICIENCY_LEVELS = [
  "Needs additional support",
  "Developing",
  "Strong",
  "Exceeding",
] as const;

export type ProficiencyLevel = (typeof PROFICIENCY_LEVELS)[number];

/** Fast membership test for load-time validation. An unrecognised proficiency
 *  string would otherwise be silently skipped by every analytic (NAS counts,
 *  transition matrix, band movement all read 0) with no diagnostic — so the
 *  loader rejects the file instead, the same way it rejects an unknown domain. */
export const PROFICIENCY_LEVEL_SET: ReadonlySet<string> = new Set(PROFICIENCY_LEVELS);

/** The NAS ("Needs additional support") band — the binary outcome in the
 *  paired McNemar test. */
export const NAS = "Needs additional support";

/** Participation code marking a sat test (vs Absent / Withdrawn / Exempt). */
export const PARTICIPATED = "Participated";

/** NAPLAN is sat in Years 3, 5, 7 and 9. The within-school growth pairs are
 *  3→5 (primary) and 7→9 (secondary); see `phase.ts`. */
export const VALID_YEAR_LEVELS = [3, 5, 7, 9] as const;
export type YearLevel = (typeof VALID_YEAR_LEVELS)[number];

export const VALID_DOMAINS = [
  "Reading",
  "Numeracy",
  "Spelling",
  "Grammar and Punctuation",
] as const;
export type Domain = (typeof VALID_DOMAINS)[number];
