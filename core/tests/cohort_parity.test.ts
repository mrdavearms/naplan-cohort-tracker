/**
 * End-to-end cohort parity: parse the cross-year fixtures (Y7 2024 + Y9 2026)
 * via exceljs, clean, pair, and run the Section-10 stats — asserting the result
 * matches the oracle snapshot from `verification/gen_cohort_snapshot.py`.
 * This validates buildPairedCohort against the oracle's own build_paired_cohort,
 * not just the hand-built cases in cohort.test.ts.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import {
  buildPairedCohort,
  cleanStudentReports,
  mcnemarPaired,
  NAS,
  parseWorkbook,
  transitionMatrix,
  wilsonCi,
} from "../src/index";

const here = dirname(fileURLToPath(import.meta.url));
const snap = JSON.parse(
  readFileSync(join(here, "fixtures/cohort_snapshot.json"), "utf8"),
) as {
  paired: number;
  leavers: number;
  joiners: number;
  pairedFilteredCount: number;
  y7NasCount: number;
  y9NasCount: number;
  y7NasPct: number;
  y9NasPct: number;
  mcnemar: {
    stayersNas: number;
    stayersNotNas: number;
    movedOutOfNas: number;
    movedIntoNas: number;
    pValue: number;
  };
  transitionMatrix: number[][];
  wilsonY7Nas: [number, number];
  wilsonY9Nas: [number, number];
};

async function loadPaired() {
  const y7wb = await parseWorkbook(readFileSync(join(here, "fixtures/synthetic_y7_2024_reading.xlsx")));
  const y9wb = await parseWorkbook(readFileSync(join(here, "fixtures/synthetic_y9_2026_reading.xlsx")));
  const y7 = cleanStudentReports(y7wb.sheet("Student Reports")!);
  const y9 = cleanStudentReports(y9wb.sheet("Student Reports")!);
  return buildPairedCohort(y7, y9, "Reading");
}

describe("cohort parity with the Python oracle (cross-year fixtures)", () => {
  it("paired / leavers / joiners / filtered counts match", async () => {
    const pc = await loadPaired();
    expect(pc.paired).toHaveLength(snap.paired);
    expect(pc.leavers).toHaveLength(snap.leavers);
    expect(pc.joiners).toHaveLength(snap.joiners);
    expect(pc.pairedFilteredCount).toBe(snap.pairedFilteredCount);
  });

  it("transition matrix matches", async () => {
    const pc = await loadPaired();
    expect(transitionMatrix(pc.paired)).toEqual(snap.transitionMatrix);
  });

  it("McNemar counts + p-value match", async () => {
    const pc = await loadPaired();
    const mc = mcnemarPaired(pc.paired);
    expect(mc.stayersNas).toBe(snap.mcnemar.stayersNas);
    expect(mc.stayersNotNas).toBe(snap.mcnemar.stayersNotNas);
    expect(mc.movedOutOfNas).toBe(snap.mcnemar.movedOutOfNas);
    expect(mc.movedIntoNas).toBe(snap.mcnemar.movedIntoNas);
    expect(mc.pValue).toBeCloseTo(snap.mcnemar.pValue, 12);
  });

  it("NAS% and Wilson CIs match", async () => {
    const pc = await loadPaired();
    const n = pc.paired.length;
    const y7Nas = pc.paired.filter((p) => p.proficiencyY7 === NAS).length;
    const y9Nas = pc.paired.filter((p) => p.proficiencyY9 === NAS).length;
    expect(y7Nas).toBe(snap.y7NasCount);
    expect(y9Nas).toBe(snap.y9NasCount);
    expect((y7Nas / n) * 100).toBeCloseTo(snap.y7NasPct, 10);
    expect((y9Nas / n) * 100).toBeCloseTo(snap.y9NasPct, 10);

    const [lo7, hi7] = wilsonCi(y7Nas, n);
    expect(lo7).toBeCloseTo(snap.wilsonY7Nas[0], 12);
    expect(hi7).toBeCloseTo(snap.wilsonY7Nas[1], 12);
    const [lo9, hi9] = wilsonCi(y9Nas, n);
    expect(lo9).toBeCloseTo(snap.wilsonY9Nas[0], 12);
    expect(hi9).toBeCloseTo(snap.wilsonY9Nas[1], 12);
  });
});
