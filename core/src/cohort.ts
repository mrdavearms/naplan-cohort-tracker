/**
 * Cohort pairing + Section-10 stats, ported from `naplan/cohort.py`.
 * Pure functions over plain arrays — no pandas, no I/O, no DOM.
 *
 * The shape of the world: Y7 (e.g. 2024) Student Reports + Y9 (e.g. 2026)
 * Student Reports → pair on `Local student ID` → paired / leavers / joiners →
 * transition matrix, McNemar, Wilson CI, etc.
 */

import { NAS, PARTICIPATED, PROFICIENCY_LEVELS } from "./constants";
import { mcnemarExactPValue } from "./stats";
import type {
  JoinerRow,
  LeaverRow,
  McNemarResult,
  PairedCohort,
  PairedStudent,
  StudentReportRow,
} from "./types";

/**
 * Pair Y7 students with Y9 students by `Local student ID`.
 *
 * Mirrors `build_paired_cohort`:
 * - both years filtered to participants only (and to non-null IDs);
 * - LBOTE/ATSI taken from the Y7 record exclusively (entry-state baseline);
 * - rows where Y7 or Y9 proficiency is null are dropped from `paired`, and the
 *   dropped count is preserved on `pairedFilteredCount`.
 *
 * Assumes one row per student per domain within a year (true for SSSR exports);
 * a duplicate ID in Y9 resolves to its last occurrence.
 */
export function buildPairedCohort(
  y7StudentReports: readonly StudentReportRow[],
  y9StudentReports: readonly StudentReportRow[],
  domain: string,
  earlierLevel = 7,
  laterLevel = 9,
): PairedCohort {
  const participated = (r: StudentReportRow): boolean =>
    r.participationCode === PARTICIPATED && r.localStudentId != null;

  const f7 = y7StudentReports.filter(participated);
  const f9 = y9StudentReports.filter(participated);

  const idOf = (r: StudentReportRow): string => String(r.localStudentId);
  const y7Ids = new Set(f7.map(idOf));
  const y9Ids = new Set(f9.map(idOf));

  const y9ById = new Map<string, StudentReportRow>();
  for (const r of f9) y9ById.set(idOf(r), r);

  const paired: PairedStudent[] = [];
  let pairedPreFilter = 0;
  for (const r7 of f7) {
    const id = idOf(r7);
    const r9 = y9ById.get(id);
    if (r9 === undefined) continue; // leaver — handled below
    pairedPreFilter++;
    if (r7.proficiencyLevel == null || r9.proficiencyLevel == null) continue;
    paired.push({
      localStudentId: id,
      classGroupY7: r7.classGroups,
      proficiencyY7: r7.proficiencyLevel,
      lboteStatus: r7.lboteStatus,
      atsiGroup: r7.atsiGroup,
      participationCode: PARTICIPATED,
      classGroupY9: r9.classGroups,
      proficiencyY9: r9.proficiencyLevel,
    });
  }
  const pairedFilteredCount = pairedPreFilter - paired.length;

  const leavers: LeaverRow[] = f7
    .filter((r) => !y9Ids.has(idOf(r)))
    .map((r) => ({
      localStudentId: idOf(r),
      classGroupY7: r.classGroups,
      proficiencyY7: r.proficiencyLevel,
      lboteStatus: r.lboteStatus,
      atsiGroup: r.atsiGroup,
      participationCode: PARTICIPATED,
    }));

  const joiners: JoinerRow[] = f9
    .filter((r) => !y7Ids.has(idOf(r)))
    .map((r) => ({
      localStudentId: idOf(r),
      classGroupY9: r.classGroups,
      proficiencyY9: r.proficiencyLevel,
      lboteStatusY9: r.lboteStatus,
      atsiGroupY9: r.atsiGroup,
      participationCode: PARTICIPATED,
    }));

  return { domain, earlierLevel, laterLevel, paired, leavers, joiners, pairedFilteredCount };
}

/**
 * McNemar exact test on the earlier→later NAS transition for the paired cohort
 * (Year 3→5 for primary, 7→9 for secondary). `earlierLevel`/`laterLevel` only
 * label the human-readable `note`; they default to 7/9 so existing callers are
 * unchanged. Returns `pValue: null` when there are zero discordant pairs.
 */
export function mcnemarPaired(
  paired: readonly PairedStudent[],
  earlierLevel = 7,
  laterLevel = 9,
): McNemarResult {
  const eL = `Y${earlierLevel}`;
  const lL = `Y${laterLevel}`;
  let stayersNas = 0;
  let stayersNotNas = 0;
  let movedOutOfNas = 0; // improved
  let movedIntoNas = 0; // declined

  for (const s of paired) {
    const y7Nas = s.proficiencyY7 === NAS;
    const y9Nas = s.proficiencyY9 === NAS;
    if (y7Nas && y9Nas) stayersNas++;
    else if (!y7Nas && !y9Nas) stayersNotNas++;
    else if (y7Nas && !y9Nas) movedOutOfNas++;
    else movedIntoNas++;
  }

  const discordant = movedOutOfNas + movedIntoNas;
  if (discordant === 0) {
    return {
      stayersNas,
      stayersNotNas,
      movedOutOfNas,
      movedIntoNas,
      pValue: null,
      note:
        `No students changed NAS status between ${eL} and ${lL} in this domain; ` +
        "statistical testing is not applicable.",
    };
  }

  const p = mcnemarExactPValue(movedOutOfNas, movedIntoNas);
  const direction = movedOutOfNas > movedIntoNas ? "improvement" : "decline";
  const sig = p < 0.05 ? "statistically significant" : "not statistically significant";
  return {
    stayersNas,
    stayersNotNas,
    movedOutOfNas,
    movedIntoNas,
    pValue: p,
    note:
      `Of ${paired.length} paired students, ${movedOutOfNas} moved out of NAS ` +
      `between ${eL} and ${lL}, ${movedIntoNas} moved into NAS, and ` +
      `${stayersNas + stayersNotNas} stayed in the same NAS state. ` +
      `McNemar exact p = ${p.toFixed(4)} — the cohort ${direction} is ${sig} at p<0.05.`,
  };
}

/**
 * 4×4 transition matrix of counts: rows = Y7 proficiency, columns = Y9
 * proficiency, both ordered by PROFICIENCY_LEVELS. Levels with no students
 * still appear as zero rows/columns. Rows whose proficiency is not one of the
 * four known levels are ignored (mirrors pandas `reindex` dropping labels).
 */
export function transitionMatrix(paired: readonly PairedStudent[]): number[][] {
  const index = new Map<string, number>();
  PROFICIENCY_LEVELS.forEach((lvl, i) => index.set(lvl, i));

  const matrix: number[][] = PROFICIENCY_LEVELS.map(() =>
    PROFICIENCY_LEVELS.map(() => 0),
  );

  for (const s of paired) {
    const row = index.get(s.proficiencyY7);
    const col = index.get(s.proficiencyY9);
    if (row === undefined || col === undefined) continue;
    matrix[row]![col]!++;
  }
  return matrix;
}
