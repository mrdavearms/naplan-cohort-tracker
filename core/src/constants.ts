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

/** The NAS ("Needs additional support") band — the binary outcome in the
 *  paired McNemar test. */
export const NAS = "Needs additional support";

/** Participation code marking a sat test (vs Absent / Withdrawn / Exempt). */
export const PARTICIPATED = "Participated";

export const VALID_YEAR_LEVELS = [7, 9] as const;
export type YearLevel = (typeof VALID_YEAR_LEVELS)[number];

export const VALID_DOMAINS = [
  "Reading",
  "Numeracy",
  "Spelling",
  "Grammar and Punctuation",
] as const;
export type Domain = (typeof VALID_DOMAINS)[number];
