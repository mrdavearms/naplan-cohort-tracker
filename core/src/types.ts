/** Core data types ported from `naplan/cohort.py` (PairedCohort, McNemarResult)
 *  and the loader's cleaned-Student-Reports shape. */

/**
 * One row of a cleaned Student Reports sheet, as the loader will produce it.
 * Field names are canonical; the loader maps the 2025/2026 column aliases onto
 * these. `localStudentId` already carries the `{PSI}*` fallback applied during
 * cleaning, but may still be null if no identifier was present at all.
 */
export interface StudentReportRow {
  studentId: string | null;
  localStudentId: string | null;
  /** {studentId}* fallback when localStudentId is blank — for display only,
   *  NOT used for cross-year keying (build_paired_cohort drops null-LSID rows). */
  localStudentIdDisplay: string;
  yearLevel: number | null;
  classGroups: string | null;
  domain: string | null;
  proficiencyLevel: string | null;
  participationCode: string | null;
  indigenousStatus: string | null;
  lboteStatus: string | null;
  /** Derived from indigenousStatus: "ATSI" | "Non-ATSI" | "Not reported". */
  atsiGroup: string;
}

/** One row of a cleaned Student Results Table sheet. */
export interface StudentResultRow {
  studentPsi: string | null;
  yearLevel: number | null;
  classGroups: string | null;
  itemId: string | null;
  itemDifficulty: number | null;
  domain: string | null;
  subdomain: string | null;
  descriptor: string | null;
  studentMarkedResponse: string | null;
  /** Derived from itemDifficulty: "Below 480" | "480-580" | "Above 580" | "Unknown". */
  difficultyBand: string;
}

/** A loaded SSSR entry, keyed by (yearOfTest, yearLevel, domain). */
export interface LoadedFile {
  yearOfTest: number;
  yearLevel: number;
  domain: string;
  studentReports: StudentReportRow[];
  studentResults: StudentResultRow[];
  sourceFilename: string;
  participants: number;
  totalStudents: number;
}

// NOTE: the `*Y7`/`*Y9` field suffixes on the three row types below are
// HISTORICAL and mean "earlier"/"later" — for a primary (Year 3→5) cohort they
// hold Year 3 / Year 5 values, not Year 7/9. See PairedCohort.earlierLevel/laterLevel.

/** A student present (and proficiency-scored) in BOTH the earlier and later year.
 *  LBOTE/ATSI are the earlier-year entry-state baseline (never mixed). */
export interface PairedStudent {
  localStudentId: string;
  classGroupY7: string | null;
  proficiencyY7: string;
  lboteStatus: string | null;
  atsiGroup: string | null;
  participationCode: string;
  classGroupY9: string | null;
  proficiencyY9: string;
}

/** A student in the earlier year only — left before the later year. Proficiency may be null. */
export interface LeaverRow {
  localStudentId: string;
  classGroupY7: string | null;
  proficiencyY7: string | null;
  lboteStatus: string | null;
  atsiGroup: string | null;
  participationCode: string;
}

/** A student in the later year only — joined after the earlier year. Proficiency may be null. */
export interface JoinerRow {
  localStudentId: string;
  classGroupY9: string | null;
  proficiencyY9: string | null;
  lboteStatusY9: string | null;
  atsiGroupY9: string | null;
  participationCode: string;
}

/** Result of pairing one domain's earlier-year cohort with its later-year cohort
 *  (Year 3 → 5 for primary, Year 7 → 9 for secondary). The `*Y7`/`*Y9` field
 *  names on the rows are historical and mean "earlier"/"later", not literally
 *  7/9 — `earlierLevel`/`laterLevel` carry the actual NAPLAN year levels. */
export interface PairedCohort {
  domain: string;
  /** Earlier (entry) NAPLAN year level — 3 (primary) or 7 (secondary). */
  earlierLevel: number;
  /** Later (exit) NAPLAN year level — 5 (primary) or 9 (secondary). */
  laterLevel: number;
  paired: PairedStudent[];
  leavers: LeaverRow[];
  joiners: JoinerRow[];
  /** Students paired by ID but dropped because Y7 or Y9 proficiency was null. */
  pairedFilteredCount: number;
}

/** Result of the paired-binary McNemar test on Y7 NAS → Y9 NAS transitions. */
export interface McNemarResult {
  stayersNas: number;
  stayersNotNas: number;
  /** NAS in Y7, not-NAS in Y9 (improved). */
  movedOutOfNas: number;
  /** not-NAS in Y7, NAS in Y9 (declined). */
  movedIntoNas: number;
  /** null when there are zero discordant pairs (test not applicable). */
  pValue: number | null;
  note: string;
}
