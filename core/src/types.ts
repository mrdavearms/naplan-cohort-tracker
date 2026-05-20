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

/** A student present (and proficiency-scored) in BOTH Y7 and Y9.
 *  LBOTE/ATSI are the Y7 entry-state baseline (never mixed with Y9). */
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

/** A student in Y7 only — left before Y9. Proficiency may be null. */
export interface LeaverRow {
  localStudentId: string;
  classGroupY7: string | null;
  proficiencyY7: string | null;
  lboteStatus: string | null;
  atsiGroup: string | null;
  participationCode: string;
}

/** A student in Y9 only — joined after Y7. Proficiency may be null. */
export interface JoinerRow {
  localStudentId: string;
  classGroupY9: string | null;
  proficiencyY9: string | null;
  lboteStatusY9: string | null;
  atsiGroupY9: string | null;
  participationCode: string;
}

/** Result of pairing one domain's Y7 cohort with its Y9 cohort. */
export interface PairedCohort {
  domain: string;
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
