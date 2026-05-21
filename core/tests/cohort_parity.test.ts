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
  attritionAnalysis,
  buildPairedCohort,
  classGroupTracking,
  cleanStudentReports,
  cohortHeadline,
  equitySubCohorts,
  mcnemarPaired,
  NAS,
  parseWorkbook,
  readingSubdomainMovement,
  transitionMatrix,
  wilsonCi,
  type StudentResultRow,
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
  drilldowns: {
    headline: Record<string, number>;
    attrition: {
      stayersN: number;
      leaversN: number;
      stayersY7Distribution: Record<string, number>;
      leaversY7Distribution: Record<string, number>;
      stayersNasCount: number;
      leaversNasCount: number;
      stayersNasPct: number;
      leaversNasPct: number;
    };
    equitySubCohorts: Array<{
      subgroup: string;
      n: number;
      suppressed: boolean;
      caveat?: boolean;
      y7NasPct: number | null;
      y9NasPct: number | null;
    }>;
    classGroups: Array<{
      y7Class: string;
      total: number;
      stayed: number;
      left: number;
      y7NasCount: number;
      y7NasPct: number;
      pairedSubsetN: number;
      y9NasCount: number;
      y9NasPct: number;
      destinations: Array<{ y9Class: string; n: number }>;
    }>;
  };
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

describe("Section 10 drill-downs parity (cross-year fixtures)", () => {
  it("headline matches the oracle", async () => {
    const h = cohortHeadline(await loadPaired());
    const w = snap.drilldowns.headline;
    expect(h.pairedN).toBe(w.pairedN);
    expect(h.y7NasPct).toBeCloseTo(w.y7NasPct!, 10);
    expect(h.y9NasPct).toBeCloseTo(w.y9NasPct!, 10);
    expect(h.deltaNasPp).toBeCloseTo(w.deltaNasPp!, 10);
    expect(h.y7MeetingPct).toBeCloseTo(w.y7MeetingPct!, 10);
    expect(h.y9MeetingPct).toBeCloseTo(w.y9MeetingPct!, 10);
    expect(h.deltaMeetingPp).toBeCloseTo(w.deltaMeetingPp!, 10);
  });

  it("attrition matches the oracle", async () => {
    const a = attritionAnalysis(await loadPaired());
    const w = snap.drilldowns.attrition;
    expect(a.stayersN).toBe(w.stayersN);
    expect(a.leaversN).toBe(w.leaversN);
    expect(a.stayersNasCount).toBe(w.stayersNasCount);
    expect(a.leaversNasCount).toBe(w.leaversNasCount);
    expect(a.stayersNasPct).toBeCloseTo(w.stayersNasPct, 10);
    expect(a.leaversNasPct).toBeCloseTo(w.leaversNasPct, 10);
    for (const lvl of Object.keys(w.stayersY7Distribution)) {
      expect(a.stayersY7Distribution[lvl as keyof typeof a.stayersY7Distribution]).toBeCloseTo(
        w.stayersY7Distribution[lvl]!,
        10,
      );
      expect(a.leaversY7Distribution[lvl as keyof typeof a.leaversY7Distribution]).toBeCloseTo(
        w.leaversY7Distribution[lvl]!,
        10,
      );
    }
  });

  it("equity sub-cohorts match the oracle (suppression path)", async () => {
    const e = equitySubCohorts(await loadPaired());
    expect(e).toHaveLength(snap.drilldowns.equitySubCohorts.length);
    for (let i = 0; i < e.length; i++) {
      const g = e[i]!;
      const w = snap.drilldowns.equitySubCohorts[i]!;
      expect(g.subgroup).toBe(w.subgroup);
      expect(g.n).toBe(w.n);
      expect(g.suppressed).toBe(w.suppressed);
      expect(g.y7NasPct).toBe(w.y7NasPct);
      expect(g.y9NasPct).toBe(w.y9NasPct);
    }
  });

  it("class-group tracking matches the oracle", async () => {
    const c = classGroupTracking(await loadPaired());
    expect(c).toHaveLength(snap.drilldowns.classGroups.length);
    for (let i = 0; i < c.length; i++) {
      const g = c[i]!;
      const w = snap.drilldowns.classGroups[i]!;
      expect(g.y7Class).toBe(w.y7Class);
      expect(g.total).toBe(w.total);
      expect(g.stayed).toBe(w.stayed);
      expect(g.left).toBe(w.left);
      expect(g.y7NasCount).toBe(w.y7NasCount);
      expect(g.y7NasPct).toBeCloseTo(w.y7NasPct, 10);
      expect(g.pairedSubsetN).toBe(w.pairedSubsetN);
      expect(g.y9NasCount).toBe(w.y9NasCount);
      expect(g.y9NasPct).toBeCloseTo(w.y9NasPct, 10);
      expect(g.destinations).toEqual(w.destinations);
    }
  });
});

describe("readingSubdomainMovement", () => {
  function res(subdomain: string, response: string): StudentResultRow {
    return {
      studentPsi: "p",
      yearLevel: 7,
      classGroups: null,
      itemId: "i",
      itemDifficulty: 450,
      domain: "Reading",
      subdomain,
      descriptor: "d",
      studentMarkedResponse: response,
      difficultyBand: "Below 480",
    };
  }
  it("computes Y7 vs Y9 % correct per subdomain", () => {
    const y7 = [res("Comprehension", "Correct"), res("Comprehension", "Incorrect"), res("Language", "Correct"), res("Language", "Correct")];
    const y9 = [res("Comprehension", "Correct"), res("Comprehension", "Correct"), res("Literature", "Correct")];
    const m = readingSubdomainMovement(y7, y9);
    expect(m.map((x) => x.subdomain)).toEqual(["Comprehension", "Language", "Literature"]);
    const comp = m.find((x) => x.subdomain === "Comprehension")!;
    expect(comp.y7PctCorrect).toBeCloseTo(50, 10);
    expect(comp.y9PctCorrect).toBeCloseTo(100, 10);
    expect(comp.deltaPp).toBeCloseTo(50, 10);
    expect(m.find((x) => x.subdomain === "Language")!.y9PctCorrect).toBeNull();
    expect(m.find((x) => x.subdomain === "Literature")!.deltaPp).toBeNull();
  });
});
