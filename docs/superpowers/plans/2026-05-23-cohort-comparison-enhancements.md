# Year 7 → Year 9 Cohort Comparison Enhancements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Broaden and deepen Section 10 (Year 7 → Year 9 cohort tracking) with a cross-domain overview (dumbbell + net-change strip + movement small-multiples), an all-domain subdomain breakdown, and a declined/stalled student list — all additive, none removing the existing charts.

**Architecture:** Pure analysis + Plotly figure-specs live in `core/` (filesystem-free, unit-tested, tracing to the oracle-validated transition matrix and paired-cohort records); React rendering lives in `src/`. New core functions compose existing validated primitives (`transitionMatrix`, `cohortHeadline`, `pc.paired`). Three new pure chart builders reuse the existing `DIRECTION_FILL` palette so up/stayed/down encoding matches the current Sankey/heatmap. New views slot into `S10CohortTracking.tsx` and the Section 10 PDF.

**Tech Stack:** TypeScript, React 19, Vitest (two projects: `core` node + `ui` jsdom), Plotly figure-spec objects, pdfmake.

**Spec:** `docs/superpowers/specs/2026-05-23-cohort-comparison-enhancements-design.md`

---

## File Structure

**Core logic (pure):**
- Modify `core/src/sections/cohortTracking.ts` — add `bandMovement()`, `declinedOrStalled()`; rename `readingSubdomainMovement()` → `subdomainMovement()`.
- Modify `core/src/cohortBuild.ts` — add `crossDomainSummary()`.

**Core charts (pure Plotly specs):**
- Create `core/src/charts/movement.ts` — `movementStackedFigure()`.
- Create `core/src/charts/dumbbell.ts` — `dumbbellFigure()`, `divergingDeltaFigure()`.
- Modify `core/src/charts/index.ts` — export the two new modules.

**UI:**
- Create `src/components/CrossDomainOverview.tsx` — the new overview block.
- Modify `src/views/sections/S10CohortTracking.tsx` — mount the overview; add per-domain movement bar, all-domain subdomain block, declined/stalled table; update the `subdomainMovement` import.

**PDF:**
- Modify `src/pdf/cohortReport.ts` — add the overview charts + per-domain movement/subdomain/declined-stalled content.

**Tests:**
- Create `core/tests/cohortMovement.test.ts` — `bandMovement`, `declinedOrStalled`, `subdomainMovement`, `crossDomainSummary`.
- Create `core/tests/cohortCharts.test.ts` — the three new chart builders.
- Modify `src/test/views.test.tsx` — render the overview + a domain drill-down with the new pieces.

---

## Task 1: `bandMovement()` — up / stayed / down from the transition matrix

**Files:**
- Modify: `core/src/sections/cohortTracking.ts`
- Test: `core/tests/cohortMovement.test.ts`

- [ ] **Step 1: Write the failing test**

Create `core/tests/cohortMovement.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { bandMovement, type PairedCohort, type PairedStudent } from "../src/index";

const NAS = "Needs additional support";

function ps(y7: string, y9: string): PairedStudent {
  return {
    localStudentId: "x",
    classGroupY7: null,
    proficiencyY7: y7,
    lboteStatus: null,
    atsiGroup: "Not reported",
    participationCode: "Participated",
    classGroupY9: null,
    proficiencyY9: y9,
  };
}

function cohort(paired: PairedStudent[]): PairedCohort {
  return { domain: "Reading", paired, leavers: [], joiners: [], pairedFilteredCount: 0 };
}

describe("bandMovement", () => {
  it("classifies up / stayed / down by proficiency-band order", () => {
    // up=2 (NAS→Developing, Strong→Exceeding), stayed=1 (Strong→Strong), down=1 (Exceeding→Developing)
    const pc = cohort([ps(NAS, "Developing"), ps("Strong", "Exceeding"), ps("Strong", "Strong"), ps("Exceeding", "Developing")]);
    const m = bandMovement(pc);
    expect(m).toMatchObject({ up: 2, stayed: 1, down: 1, total: 4 });
    expect(m.upPct).toBeCloseTo(50, 5);
    expect(m.stayedPct).toBeCloseTo(25, 5);
    expect(m.downPct).toBeCloseTo(25, 5);
  });

  it("returns zeroes (no NaN) for an empty cohort", () => {
    const m = bandMovement(cohort([]));
    expect(m).toEqual({ up: 0, stayed: 0, down: 0, total: 0, upPct: 0, stayedPct: 0, downPct: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run core/tests/cohortMovement.test.ts`
Expected: FAIL — `bandMovement is not exported` / not a function.

- [ ] **Step 3: Implement `bandMovement` in `core/src/sections/cohortTracking.ts`**

At the top of the file, confirm these imports exist (add `transitionMatrix` if missing):

```typescript
import { transitionMatrix } from "../cohort";
```

Then add (place it after the `pairedProficiencyDistribution` function, before `CohortHeadlineRow`):

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run core/tests/cohortMovement.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add core/src/sections/cohortTracking.ts core/tests/cohortMovement.test.ts
git commit -m "feat(core): bandMovement — up/stayed/down from the transition matrix"
```

---

## Task 2: `declinedOrStalled()` — faculty target list (Local IDs only)

**Files:**
- Modify: `core/src/sections/cohortTracking.ts`
- Test: `core/tests/cohortMovement.test.ts`

- [ ] **Step 1: Write the failing test** (append to `core/tests/cohortMovement.test.ts`)

Add `declinedOrStalled` to the import line at the top:

```typescript
import { bandMovement, declinedOrStalled, type PairedCohort, type PairedStudent } from "../src/index";
```

Append this describe block:

```typescript
function psFull(id: string, y7: string, y9: string, cg7: string | null, cg9: string | null): PairedStudent {
  return {
    localStudentId: id,
    classGroupY7: cg7,
    proficiencyY7: y7,
    lboteStatus: null,
    atsiGroup: "Not reported",
    participationCode: "Participated",
    classGroupY9: cg9,
    proficiencyY9: y9,
  };
}

describe("declinedOrStalled", () => {
  it("lists students who dropped a band and those who stalled at NAS", () => {
    const pc: PairedCohort = {
      domain: "Reading",
      paired: [
        psFull("A", "Strong", "Developing", "07A", "09A"), // declined
        psFull("B", NAS, NAS, "07B", "09C"), // stalled at NAS
        psFull("C", "Developing", "Strong", "07A", "09A"), // improved (excluded)
        psFull("D", "Exceeding", NAS, "07A", "09B"), // declined (and ends at NAS, but NOT stalled — Y7 wasn't NAS)
      ],
      leavers: [],
      joiners: [],
      pairedFilteredCount: 0,
    };
    const r = declinedOrStalled(pc);
    expect(r.declined.map((s) => s.localStudentId)).toEqual(["A", "D"]);
    expect(r.stalled.map((s) => s.localStudentId)).toEqual(["B"]);
    expect(r.declined[0]).toMatchObject({
      localStudentId: "A",
      classGroupY7: "07A",
      classGroupY9: "09A",
      proficiencyY7: "Strong",
      proficiencyY9: "Developing",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run core/tests/cohortMovement.test.ts -t declinedOrStalled`
Expected: FAIL — `declinedOrStalled is not a function`.

- [ ] **Step 3: Implement in `core/src/sections/cohortTracking.ts`**

Confirm `PROFICIENCY_LEVELS` and `NAS` are imported at the top (they are used elsewhere in the file already). Add after `bandMovement`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run core/tests/cohortMovement.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add core/src/sections/cohortTracking.ts core/tests/cohortMovement.test.ts
git commit -m "feat(core): declinedOrStalled — faculty target lists by Local ID"
```

---

## Task 3: Generalise `readingSubdomainMovement` → `subdomainMovement`

The function logic is already domain-agnostic; only the name is Reading-specific. The sole caller is `src/views/sections/S10CohortTracking.tsx`.

**Files:**
- Modify: `core/src/sections/cohortTracking.ts`
- Modify: `src/views/sections/S10CohortTracking.tsx`
- Test: `core/tests/cohortMovement.test.ts`

- [ ] **Step 1: Verify the only caller**

Run: `grep -rn "readingSubdomainMovement" core/src src`
Expected: definition + export in `core/src/sections/cohortTracking.ts`, and an import + call in `src/views/sections/S10CohortTracking.tsx`. (The interpretation function `interpretReadingSubdomains` uses its own internal `accuracyBySubdomain`, NOT this — leave it untouched.)

- [ ] **Step 2: Write the failing test** (append to `core/tests/cohortMovement.test.ts`)

Add `subdomainMovement` and `type StudentResultRow` to the imports, then:

```typescript
import { bandMovement, declinedOrStalled, subdomainMovement, type PairedCohort, type PairedStudent, type StudentResultRow } from "../src/index";
```

```typescript
describe("subdomainMovement", () => {
  const r = (subdomain: string, marked: string): StudentResultRow => ({
    studentPsi: "p",
    yearLevel: 9,
    classGroups: null,
    itemId: "i",
    itemDifficulty: 500,
    domain: "Numeracy",
    subdomain,
    descriptor: "d",
    studentMarkedResponse: marked,
    difficultyBand: "480-580",
  });

  it("computes Y7 vs Y9 % correct per subdomain for any domain", () => {
    const y7 = [r("Number", "Correct"), r("Number", "Incorrect")]; // 50%
    const y9 = [r("Number", "Correct"), r("Number", "Correct")]; // 100%
    const out = subdomainMovement(y7, y9);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ subdomain: "Number", y7PctCorrect: 50, y9PctCorrect: 100, deltaPp: 50 });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run core/tests/cohortMovement.test.ts -t subdomainMovement`
Expected: FAIL — `subdomainMovement is not a function`.

- [ ] **Step 4: Rename in `core/src/sections/cohortTracking.ts`**

Change the function declaration and its doc comment:

```typescript
/** Y7 vs Y9 % correct per subdomain (capability against the year-level
 *  standard). Domain-agnostic — pass either year's Student Results rows. */
export function subdomainMovement(
  y7Results: readonly StudentResultRow[],
  y9Results: readonly StudentResultRow[],
): SubdomainMovement[] {
```

(The body is unchanged.)

- [ ] **Step 5: Update the caller `src/views/sections/S10CohortTracking.tsx`**

In the import block from `@naplan-cohort-tracker/core`, change `readingSubdomainMovement` to `subdomainMovement`. In `DomainDrilldown`, change the call:

```typescript
const subdomainMoves = isReading ? subdomainMovement(y7Reading, y9Reading) : [];
```

(Task 9 rewrites this block for all domains; this step only keeps the build green after the rename.)

- [ ] **Step 6: Run tests + typecheck to verify green**

Run: `npx vitest run core/tests/cohortMovement.test.ts && npx tsc -p tsconfig.app.json --noEmit`
Expected: tests PASS; typecheck exits 0.

- [ ] **Step 7: Commit**

```bash
git add core/src/sections/cohortTracking.ts src/views/sections/S10CohortTracking.tsx core/tests/cohortMovement.test.ts
git commit -m "refactor(core): rename readingSubdomainMovement -> subdomainMovement (domain-agnostic)"
```

---

## Task 4: `crossDomainSummary()` — one row per domain for the overview

**Files:**
- Modify: `core/src/cohortBuild.ts`
- Test: `core/tests/cohortMovement.test.ts`

- [ ] **Step 1: Write the failing test** (append to `core/tests/cohortMovement.test.ts`)

Add `crossDomainSummary` to the imports, then:

```typescript
import {
  bandMovement,
  crossDomainSummary,
  declinedOrStalled,
  subdomainMovement,
  type PairedCohort,
  type PairedStudent,
  type StudentResultRow,
} from "../src/index";
```

```typescript
describe("crossDomainSummary", () => {
  it("returns one row per paired domain with NAS%, Meeting+% and movement", () => {
    const reading = cohort([ps(NAS, "Strong"), ps("Strong", "Strong"), ps("Exceeding", "Developing")]);
    const pairings = new Map<string, PairedCohort>([["Reading", reading]]);
    const rows = crossDomainSummary(pairings);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.domain).toBe("Reading");
    expect(rows[0]!.pairedN).toBe(3);
    // movement: up=1 (NAS→Strong), stayed=1 (Strong→Strong), down=1 (Exceeding→Developing)
    expect(rows[0]!.movement).toMatchObject({ up: 1, stayed: 1, down: 1 });
    expect(typeof rows[0]!.y7NasPct).toBe("number");
    expect(typeof rows[0]!.y9MeetingPct).toBe("number");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run core/tests/cohortMovement.test.ts -t crossDomainSummary`
Expected: FAIL — `crossDomainSummary is not a function`.

- [ ] **Step 3: Implement in `core/src/cohortBuild.ts`**

Add imports at the top:

```typescript
import { bandMovement, cohortHeadline, type BandMovement } from "./sections/cohortTracking";
```

Add at the end of the file:

```typescript
export interface CrossDomainRow {
  domain: string;
  pairedN: number;
  y7NasPct: number;
  y9NasPct: number;
  deltaNasPp: number;
  y7MeetingPct: number;
  y9MeetingPct: number;
  deltaMeetingPp: number;
  movement: BandMovement;
}

/** Per-domain headline + movement for the cross-domain overview. Domains appear
 *  in the pairings' insertion order (canonical VALID_DOMAINS order). */
export function crossDomainSummary(pairings: Map<string, PairedCohort>): CrossDomainRow[] {
  const out: CrossDomainRow[] = [];
  for (const pc of pairings.values()) {
    const h = cohortHeadline(pc);
    out.push({
      domain: h.domain,
      pairedN: h.pairedN,
      y7NasPct: h.y7NasPct,
      y9NasPct: h.y9NasPct,
      deltaNasPp: h.deltaNasPp,
      y7MeetingPct: h.y7MeetingPct,
      y9MeetingPct: h.y9MeetingPct,
      deltaMeetingPp: h.deltaMeetingPp,
      movement: bandMovement(pc),
    });
  }
  return out;
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run core/tests/cohortMovement.test.ts && npx tsc -b`
Expected: tests PASS; `tsc -b` exits 0 (confirms no circular-import / composite break).

- [ ] **Step 5: Commit**

```bash
git add core/src/cohortBuild.ts core/tests/cohortMovement.test.ts
git commit -m "feat(core): crossDomainSummary — per-domain headline + movement for the overview"
```

---

## Task 5: `movementStackedFigure()` — 100% stacked up/stayed/down bar

**Files:**
- Create: `core/src/charts/movement.ts`
- Modify: `core/src/charts/index.ts`
- Test: `core/tests/cohortCharts.test.ts`

- [ ] **Step 1: Write the failing test**

Create `core/tests/cohortCharts.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { movementStackedFigure, type BandMovement } from "../src/index";

function mv(up: number, stayed: number, down: number): BandMovement {
  const total = up + stayed + down;
  const pct = (x: number) => (total ? (x / total) * 100 : 0);
  return { up, stayed, down, total, upPct: pct(up), stayedPct: pct(stayed), downPct: pct(down) };
}

describe("movementStackedFigure", () => {
  it("builds three stacked traces (down, stayed, up) per row, summing to 100%", () => {
    const fig = movementStackedFigure([{ label: "Reading (n=4)", movement: mv(2, 1, 1) }]);
    expect(fig.data).toHaveLength(3);
    const names = fig.data.map((t) => (t as { name: string }).name);
    expect(names).toEqual(["Moved down", "Stayed", "Moved up"]);
    expect((fig.layout as { barmode?: string }).barmode).toBe("stack");
    // up share for the single row = 25%
    const upTrace = fig.data[2] as { x: number[] };
    expect(upTrace.x[0]).toBeCloseTo(25, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run core/tests/cohortCharts.test.ts`
Expected: FAIL — `movementStackedFigure is not exported`.

- [ ] **Step 3: Create `core/src/charts/movement.ts`**

```typescript
/**
 * Movement summary — a horizontal 100% stacked bar (Moved down / Stayed /
 * Moved up) per row, reusing the DIRECTION_FILL palette so it matches the
 * Sankey/heatmap direction encoding. Percentages are shown statically inside
 * each segment (no hover needed — works in the app, PDF and projected).
 */
import type { BandMovement } from "../sections/cohortTracking";
import type { PlotlyFigure } from "./figure";
import { CHART_FONT, DIRECTION_FILL } from "./palette";

export interface MovementBarRow {
  /** Row label, e.g. "Reading (n=73)". */
  label: string;
  movement: BandMovement;
}

export interface MovementBarOptions {
  title?: string;
  height?: number;
}

/** Drop a label if its segment is too thin to hold the text (< 6%). */
function label(pct: number): string {
  return pct >= 6 ? `${pct.toFixed(0)}%` : "";
}

export function movementStackedFigure(
  rows: readonly MovementBarRow[],
  options: MovementBarOptions = {},
): PlotlyFigure {
  const labels = rows.map((r) => r.label);
  const segments: { name: string; key: "downPct" | "stayedPct" | "upPct"; color: string }[] = [
    { name: "Moved down", key: "downPct", color: DIRECTION_FILL.decliner },
    { name: "Stayed", key: "stayedPct", color: DIRECTION_FILL.stayer },
    { name: "Moved up", key: "upPct", color: DIRECTION_FILL.improver },
  ];
  const data = segments.map((seg) => ({
    type: "bar",
    orientation: "h",
    name: seg.name,
    y: labels,
    x: rows.map((r) => r.movement[seg.key]),
    marker: { color: seg.color },
    text: rows.map((r) => label(r.movement[seg.key])),
    textposition: "inside",
    insidetextanchor: "middle",
    hovertemplate: `${seg.name}: %{x:.0f}%<extra></extra>`,
  }));

  return {
    data,
    layout: {
      barmode: "stack",
      title: options.title ? { text: options.title } : undefined,
      xaxis: { range: [0, 100], title: "% of paired cohort" },
      yaxis: { title: "", automargin: true },
      height: options.height ?? Math.max(160, 70 + rows.length * 42),
      margin: { l: 10, r: 10, t: options.title ? 50 : 20, b: 60 },
      legend: { orientation: "h", yanchor: "top", y: -0.25, xanchor: "center", x: 0.5 },
      font: { family: CHART_FONT },
    },
  };
}
```

- [ ] **Step 4: Export from `core/src/charts/index.ts`**

Add this line after `export * from "./bars";`:

```typescript
export * from "./movement";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run core/tests/cohortCharts.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add core/src/charts/movement.ts core/src/charts/index.ts core/tests/cohortCharts.test.ts
git commit -m "feat(core): movementStackedFigure — 100% stacked up/stayed/down bar"
```

---

## Task 6: `dumbbellFigure()` — Y7 → Y9 per-domain dumbbell

**Files:**
- Create: `core/src/charts/dumbbell.ts`
- Modify: `core/src/charts/index.ts`
- Test: `core/tests/cohortCharts.test.ts`

- [ ] **Step 1: Write the failing test** (append to `core/tests/cohortCharts.test.ts`)

Add `dumbbellFigure` and `type DumbbellRow` to the import line, then:

```typescript
describe("dumbbellFigure", () => {
  const rows = [
    { domain: "Reading", y7Value: 11, y9Value: 5.5, direction: "improved" as const },
    { domain: "Grammar", y7Value: 11.6, y9Value: 15.9, direction: "worsened" as const },
  ];

  it("emits a Y7 marker trace, a Y9 marker trace, and a connecting line per row", () => {
    const fig = dumbbellFigure(rows, { axisTitle: "NAS %" });
    const markerTraces = fig.data.filter((t) => (t as { mode?: string }).mode === "markers");
    expect(markerTraces).toHaveLength(2); // Y7 + Y9
    const lineShapes = (fig.layout as { shapes?: unknown[] }).shapes ?? [];
    expect(lineShapes).toHaveLength(2); // one per domain
    const y9 = fig.data.find((t) => (t as { name?: string }).name === "Year 9") as { x: number[] };
    expect(y9.x).toEqual([5.5, 15.9]); // Y9 values in row order
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run core/tests/cohortCharts.test.ts -t dumbbellFigure`
Expected: FAIL — `dumbbellFigure is not exported`.

- [ ] **Step 3: Create `core/src/charts/dumbbell.ts`**

```typescript
/**
 * Cross-domain Y7 -> Y9 charts: a dumbbell (grey Y7 dot -> coloured Y9 dot per
 * domain) and a diverging net-change bar. Colour by direction reuses the
 * DIRECTION_FILL palette. Direction is supplied by the caller so the same
 * builder works for NAS% (lower is better) or Meeting+% (higher is better).
 */
import type { PlotlyFigure } from "./figure";
import { CHART_FONT, DIRECTION_FILL } from "./palette";

export type MoveDirection = "improved" | "worsened" | "flat";

export interface DumbbellRow {
  domain: string;
  y7Value: number;
  y9Value: number;
  direction: MoveDirection;
}

export interface DumbbellOptions {
  axisTitle?: string;
  height?: number;
}

const Y7_GREY = "#9e9e9e";
const dirColor = (d: MoveDirection): string =>
  d === "improved" ? DIRECTION_FILL.improver : d === "worsened" ? DIRECTION_FILL.decliner : DIRECTION_FILL.stayer;

export function dumbbellFigure(rows: readonly DumbbellRow[], options: DumbbellOptions = {}): PlotlyFigure {
  const domains = rows.map((r) => r.domain);
  const shapes = rows.map((r) => ({
    type: "line",
    xref: "x",
    yref: "y",
    x0: r.y7Value,
    x1: r.y9Value,
    y0: r.domain,
    y1: r.domain,
    line: { color: dirColor(r.direction), width: 3 },
  }));
  return {
    data: [
      {
        type: "scatter",
        mode: "markers",
        name: "Year 7",
        x: rows.map((r) => r.y7Value),
        y: domains,
        marker: { color: Y7_GREY, size: 11 },
        hovertemplate: "Year 7: %{x:.1f}<extra></extra>",
      },
      {
        type: "scatter",
        mode: "markers",
        name: "Year 9",
        x: rows.map((r) => r.y9Value),
        y: domains,
        marker: { color: rows.map((r) => dirColor(r.direction)), size: 13 },
        hovertemplate: "Year 9: %{x:.1f}<extra></extra>",
      },
    ],
    layout: {
      shapes,
      title: undefined,
      xaxis: { title: options.axisTitle ?? "", rangemode: "tozero" },
      yaxis: { title: "", automargin: true, autorange: "reversed" },
      height: options.height ?? Math.max(180, 80 + rows.length * 40),
      margin: { l: 10, r: 20, t: 20, b: 50 },
      legend: { orientation: "h", yanchor: "top", y: -0.2, xanchor: "center", x: 0.5 },
      font: { family: CHART_FONT },
    },
  };
}
```

- [ ] **Step 4: Export from `core/src/charts/index.ts`**

Add after `export * from "./movement";`:

```typescript
export * from "./dumbbell";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run core/tests/cohortCharts.test.ts -t dumbbellFigure`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add core/src/charts/dumbbell.ts core/src/charts/index.ts core/tests/cohortCharts.test.ts
git commit -m "feat(core): dumbbellFigure — cross-domain Y7->Y9 dumbbell"
```

---

## Task 7: `divergingDeltaFigure()` — net-change strip

**Files:**
- Modify: `core/src/charts/dumbbell.ts`
- Test: `core/tests/cohortCharts.test.ts`

- [ ] **Step 1: Write the failing test** (append to `core/tests/cohortCharts.test.ts`)

Add `divergingDeltaFigure` to the import line, then:

```typescript
describe("divergingDeltaFigure", () => {
  it("colours improvement (negative NAS delta) and worsening (positive) differently", () => {
    const fig = divergingDeltaFigure([
      { domain: "Reading", deltaNasPp: -5.5 },
      { domain: "Grammar", deltaNasPp: 4.3 },
    ]);
    expect(fig.data).toHaveLength(1);
    const trace = fig.data[0] as { x: number[]; marker: { color: string[] } };
    expect(trace.x).toEqual([-5.5, 4.3]);
    expect(trace.marker.color[0]).not.toBe(trace.marker.color[1]); // improved vs worsened
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run core/tests/cohortCharts.test.ts -t divergingDeltaFigure`
Expected: FAIL — `divergingDeltaFigure is not exported`.

- [ ] **Step 3: Add to `core/src/charts/dumbbell.ts`** (after `dumbbellFigure`)

```typescript
export interface DeltaRow {
  domain: string;
  /** Change in NAS percentage points, Y7 -> Y9. Negative = improvement. */
  deltaNasPp: number;
}

/** Net change in NAS (pp) per domain as a diverging bar. NAS is a concern band,
 *  so a negative delta is an improvement (green) and positive is worsening (red). */
export function divergingDeltaFigure(rows: readonly DeltaRow[], options: DumbbellOptions = {}): PlotlyFigure {
  return {
    data: [
      {
        type: "bar",
        orientation: "h",
        x: rows.map((r) => r.deltaNasPp),
        y: rows.map((r) => r.domain),
        marker: { color: rows.map((r) => (r.deltaNasPp <= 0 ? DIRECTION_FILL.improver : DIRECTION_FILL.decliner)) },
        text: rows.map((r) => `${r.deltaNasPp > 0 ? "+" : ""}${r.deltaNasPp.toFixed(1)}`),
        textposition: "outside",
        hovertemplate: "Δ NAS: %{x:.1f} pp<extra></extra>",
      },
    ],
    layout: {
      title: undefined,
      xaxis: { title: options.axisTitle ?? "Δ NAS (pp) — left is better", zeroline: true },
      yaxis: { title: "", automargin: true, autorange: "reversed" },
      height: options.height ?? Math.max(180, 80 + rows.length * 40),
      margin: { l: 10, r: 30, t: 20, b: 50 },
      font: { family: CHART_FONT },
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run core/tests/cohortCharts.test.ts`
Expected: PASS (all chart tests).

- [ ] **Step 5: Commit**

```bash
git add core/src/charts/dumbbell.ts core/tests/cohortCharts.test.ts
git commit -m "feat(core): divergingDeltaFigure — per-domain net NAS change strip"
```

---

## Task 8: `CrossDomainOverview` component + mount in Section 10

**Files:**
- Create: `src/components/CrossDomainOverview.tsx`
- Modify: `src/views/sections/S10CohortTracking.tsx`
- Test: `src/test/views.test.tsx`

- [ ] **Step 1: Create `src/components/CrossDomainOverview.tsx`**

```tsx
/**
 * Cross-domain Year 7 -> Year 9 overview: dumbbell (with a NAS%/Meeting+%
 * toggle) + net-change strip + movement small-multiples. Answers "where did we
 * add value across all four domains?" for leadership data conversations.
 */
import { useMemo, useState } from "react";
import {
  crossDomainSummary,
  divergingDeltaFigure,
  dumbbellFigure,
  movementStackedFigure,
  type CrossDomainRow,
  type DumbbellRow,
  type MovementBarRow,
  type PairedCohort,
} from "@naplan-cohort-tracker/core";
import { Card } from "./ui";
import { Chart } from "./Chart";

type Metric = "nas" | "meeting";

function direction(metric: Metric, y7: number, y9: number): DumbbellRow["direction"] {
  const delta = y9 - y7;
  if (Math.abs(delta) < 0.05) return "flat";
  // NAS lower is better; Meeting+ higher is better.
  if (metric === "nas") return delta < 0 ? "improved" : "worsened";
  return delta > 0 ? "improved" : "worsened";
}

export function CrossDomainOverview({ pairings }: { pairings: Map<string, PairedCohort> }) {
  const [metric, setMetric] = useState<Metric>("nas");
  const rows: CrossDomainRow[] = useMemo(() => crossDomainSummary(pairings), [pairings]);
  if (rows.length === 0) return null;

  const dumbbellRows: DumbbellRow[] = rows.map((r) => {
    const y7 = metric === "nas" ? r.y7NasPct : r.y7MeetingPct;
    const y9 = metric === "nas" ? r.y9NasPct : r.y9MeetingPct;
    return { domain: r.domain, y7Value: y7, y9Value: y9, direction: direction(metric, y7, y9) };
  });
  const movementRows: MovementBarRow[] = rows.map((r) => ({
    label: `${r.domain} (n=${r.pairedN})`,
    movement: r.movement,
  }));

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-graphite">Across all domains</h2>
        <div className="inline-flex rounded-xl border border-alabaster bg-white/60 p-1 text-sm">
          {(["nas", "meeting"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={
                "rounded-lg px-3 py-1 transition " +
                (metric === m ? "bg-coral text-white" : "text-graphite/70 hover:text-graphite")
              }
            >
              {m === "nas" ? "NAS %" : "Meeting+ %"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-1 text-sm font-medium text-graphite/70">
            {metric === "nas" ? "NAS %" : "Strong + Exceeding %"}: Year 7 → Year 9
          </h3>
          <Chart figure={dumbbellFigure(dumbbellRows, { axisTitle: metric === "nas" ? "NAS %" : "Meeting+ %" })} height={200} />
        </div>
        <div>
          <h3 className="mb-1 text-sm font-medium text-graphite/70">Net change in NAS (pp)</h3>
          <Chart figure={divergingDeltaFigure(rows.map((r) => ({ domain: r.domain, deltaNasPp: r.deltaNasPp })))} height={200} />
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-medium text-graphite/70">Band movement (moved down · stayed · moved up)</h3>
        <Chart figure={movementStackedFigure(movementRows)} height={Math.max(160, 70 + movementRows.length * 42)} />
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Mount it in `src/views/sections/S10CohortTracking.tsx`**

Add the import near the other component imports:

```tsx
import { CrossDomainOverview } from "../../components/CrossDomainOverview";
```

In the main `return (...)` of `S10CohortTracking`, immediately AFTER `<MatchRateBanner ... />` and BEFORE the "Per-domain headline" `<Card>`, insert:

```tsx
<CrossDomainOverview pairings={pairings} />
```

(`pairings` is already in scope in `S10CohortTracking`.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: exits 0.

- [ ] **Step 4: Add a render test** (append to `src/test/views.test.tsx`, inside the existing `describe("shell views", ...)` or a new describe)

```tsx
import { CrossDomainOverview } from "../components/CrossDomainOverview";
import { buildCohortPairings } from "@naplan-cohort-tracker/core";

describe("cross-domain overview", () => {
  it("renders the overview against the synthetic cohort without throwing", () => {
    const pairings = buildCohortPairings(store, 2026);
    renderWithApp(<CrossDomainOverview pairings={pairings} />, { store });
    expect(screen.getByText(/Across all domains/i)).toBeInTheDocument();
    expect(screen.getByText(/Band movement/i)).toBeInTheDocument();
  });
});
```

(`store` is the module-level synthetic store already built in `beforeAll` in this file. If the import lines for `screen`/`renderWithApp`/`store` differ, reuse the existing ones at the top of the file rather than re-importing.)

- [ ] **Step 5: Run UI test**

Run: `npx vitest run --project ui src/test/views.test.tsx -t "cross-domain"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/CrossDomainOverview.tsx src/views/sections/S10CohortTracking.tsx src/test/views.test.tsx
git commit -m "feat(ui): cross-domain Y7->Y9 overview block in Section 10"
```

---

## Task 9: Per-domain additions — movement bar, all-domain subdomains, declined/stalled

**Files:**
- Modify: `src/views/sections/S10CohortTracking.tsx`
- Test: `src/test/views.test.tsx`

- [ ] **Step 1: Update imports in `S10CohortTracking.tsx`**

Add to the `@naplan-cohort-tracker/core` import block: `bandMovement`, `declinedOrStalled`, `movementStackedFigure`. (`subdomainMovement` is already imported from Task 3.)

- [ ] **Step 2: Add the per-domain movement bar in `DomainDrilldown`**

Inside `DomainDrilldown`, after the transition Sankey/heatmap `<Card>` (the one rendering `transitionSankeyFigure`), add a new card:

```tsx
<Card>
  <h2 className="mb-1 text-lg font-semibold text-graphite">{pc.domain} — band movement</h2>
  <p className="mb-3 text-xs text-graphite/60">
    Share of the matched cohort that moved up a proficiency band, held, or slipped down.
  </p>
  <Chart
    figure={movementStackedFigure([{ label: `${pc.domain} (n=${pc.paired.length})`, movement: bandMovement(pc) }])}
    height={150}
  />
</Card>
```

- [ ] **Step 3: Replace the Reading-only subdomain block with an all-domain block**

Find the block guarded by `{isReading && subdomainMoves.length > 0 && ( ... )}`. Replace the gating logic so it runs for ANY domain. Change the data lines near the top of `DomainDrilldown` from:

```tsx
const isReading = pc.domain === "Reading";
const y7Reading = isReading ? getEntry(store, y7Year, 7, "Reading")?.studentResults ?? [] : [];
const y9Reading = isReading ? getEntry(store, y9Year, 9, "Reading")?.studentResults ?? [] : [];
const subdomainMoves = isReading ? subdomainMovement(y7Reading, y9Reading) : [];
```

to:

```tsx
const y7Results = getEntry(store, y7Year, 7, pc.domain)?.studentResults ?? [];
const y9Results = getEntry(store, y9Year, 9, pc.domain)?.studentResults ?? [];
const subdomainMoves = subdomainMovement(y7Results, y9Results);
const isReading = pc.domain === "Reading";
```

Then replace the subdomain `<Card>` block with:

```tsx
{subdomainMoves.length > 0 ? (
  <Card>
    <h2 className="mb-1 text-lg font-semibold text-graphite">{pc.domain} subdomains — Y7 vs Y9 % correct</h2>
    <p className="mb-3 text-xs text-graphite/60">
      Capability against the year-level standard, weakest first. This is a <strong>directional</strong>{" "}
      signal, not true growth — the Y7 and Y9 tests differ in difficulty.
    </p>
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-alabaster text-left text-xs uppercase tracking-wide text-graphite/50">
          <th className="py-2">Subdomain</th>
          <th className="py-2 text-right">Y7 % correct</th>
          <th className="py-2 text-right">Y9 % correct</th>
          <th className="py-2 text-right">Δ</th>
        </tr>
      </thead>
      <tbody>
        {[...subdomainMoves]
          .sort((a, b) => (a.y9PctCorrect ?? 0) - (b.y9PctCorrect ?? 0))
          .map((s) => (
            <tr key={s.subdomain} className="border-b border-alabaster/60 last:border-0">
              <td className="py-2 font-medium text-graphite">{s.subdomain}</td>
              <td className="py-2 text-right tabular-nums">{pct(s.y7PctCorrect)}</td>
              <td className="py-2 text-right tabular-nums">{pct(s.y9PctCorrect)}</td>
              <td
                className={
                  "py-2 text-right tabular-nums " +
                  (s.deltaPp != null && s.deltaPp > 0
                    ? "text-sage-text"
                    : s.deltaPp != null && s.deltaPp < 0
                      ? "text-coral-text"
                      : "")
                }
              >
                {pp(s.deltaPp)}
              </td>
            </tr>
          ))}
      </tbody>
    </table>
    {isReading && (
      <div className="mt-3">
        <Bullets items={interpretReadingSubdomains(y7Results, y9Results, y7Year, y9Year, ctx)} />
      </div>
    )}
  </Card>
) : (
  <Card>
    <h2 className="mb-1 text-lg font-semibold text-graphite">{pc.domain} subdomains</h2>
    <p className="text-sm text-graphite/60">
      No subdomain-level item data is available for {pc.domain} in both years.
    </p>
  </Card>
)}
```

(`pct` and `pp` are the existing formatting helpers already defined at the top of `S10CohortTracking.tsx`; `Bullets` is the existing local component.)

- [ ] **Step 4: Add the declined/stalled list** (after the subdomain block in `DomainDrilldown`)

```tsx
{(() => {
  const ds = declinedOrStalled(pc);
  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold text-graphite">{pc.domain} — students to follow up</h2>
      <p className="mb-3 text-xs text-graphite/60">
        Matched students who slipped a band, or who stayed at “Needs additional support” both years.
        Local Student IDs only — no names.
      </p>
      {ds.declined.length === 0 && ds.stalled.length === 0 ? (
        <p className="text-sm text-graphite/60">No students declined or stalled in {pc.domain}.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-alabaster text-left text-xs uppercase tracking-wide text-graphite/50">
              <th className="py-2">Local ID</th>
              <th className="py-2">Flag</th>
              <th className="py-2">Y7 class</th>
              <th className="py-2">Y9 class</th>
              <th className="py-2">Y7 → Y9 band</th>
            </tr>
          </thead>
          <tbody>
            {[
              ...ds.declined.map((s) => ({ s, flag: "Declined" as const })),
              ...ds.stalled.map((s) => ({ s, flag: "Stalled at NAS" as const })),
            ].map(({ s, flag }, i) => (
              <tr key={`${s.localStudentId}-${i}`} className="border-b border-alabaster/60 last:border-0">
                <td className="py-2 font-medium text-graphite">{s.localStudentId}</td>
                <td className="py-2">
                  <Pill tone="coral">{flag}</Pill>
                </td>
                <td className="py-2 text-graphite/70">{s.classGroupY7 ?? "—"}</td>
                <td className="py-2 text-graphite/70">{s.classGroupY9 ?? "—"}</td>
                <td className="py-2 tabular-nums">
                  {s.proficiencyY7} → {s.proficiencyY9}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
})()}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: exits 0. (If `pct`/`pp`/`Bullets`/`Pill`/`ctx` are reported missing, confirm they're the existing helpers in this file / imported from `ui` — they are used elsewhere in the same file already.)

- [ ] **Step 6: Add a per-domain render test** (append to `src/test/views.test.tsx`)

```tsx
import { S10CohortTracking } from "../views/sections/S10CohortTracking";

describe("Section 10 per-domain additions", () => {
  it("renders movement, subdomains and the follow-up list for the synthetic cohort", () => {
    renderWithApp(<S10CohortTracking />, { store });
    expect(screen.getAllByText(/band movement/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/students to follow up/i).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 7: Run UI tests**

Run: `npx vitest run --project ui src/test/views.test.tsx`
Expected: PASS (all, including the existing S10 test).

- [ ] **Step 8: Commit**

```bash
git add src/views/sections/S10CohortTracking.tsx src/test/views.test.tsx
git commit -m "feat(ui): per-domain movement bar, all-domain subdomains, declined/stalled list"
```

---

## Task 10: Add the new charts + lists to the Section 10 PDF

**Files:**
- Modify: `src/pdf/cohortReport.ts`
- Test: `src/test/pdf.test.ts`

- [ ] **Step 1: Update imports in `cohortReport.ts`**

Add to the `@naplan-cohort-tracker/core` import block: `bandMovement`, `crossDomainSummary`, `declinedOrStalled`, `divergingDeltaFigure`, `dumbbellFigure`, `movementStackedFigure`, `subdomainMovement`, and type `MovementBarRow`, `DumbbellRow`.

- [ ] **Step 2: Add an overview section to `buildCohortDoc`**

In `buildCohortDoc`, inside the `else` branch (where `pairings.size > 0`), AFTER the "Paired-cohort headline" table and BEFORE the leadership narrative, insert:

```tsx
const summary = crossDomainSummary(pairings);
const dumbbellRows: DumbbellRow[] = summary.map((r) => ({
  domain: r.domain,
  y7Value: r.y7NasPct,
  y9Value: r.y9NasPct,
  direction: r.deltaNasPp < 0 ? "improved" : r.deltaNasPp > 0 ? "worsened" : "flat",
}));
const dumbbellPng = await figureToPng(dumbbellFigure(dumbbellRows, { axisTitle: "NAS %" }), 360, 220);
const deltaPng = await figureToPng(
  divergingDeltaFigure(summary.map((r) => ({ domain: r.domain, deltaNasPp: r.deltaNasPp }))),
  360,
  220,
);
const movementRows: MovementBarRow[] = summary.map((r) => ({ label: `${r.domain} (n=${r.pairedN})`, movement: r.movement }));
const movementPng = await figureToPng(movementStackedFigure(movementRows), 520, 220);

body.push({ text: "Across all domains (Year 7 → Year 9)", style: "h2" });
body.push({ columns: [{ image: dumbbellPng, width: 250 }, { image: deltaPng, width: 250 }], columnGap: 10, margin: [0, 2, 0, 6] });
body.push({ text: "Band movement — moved down · stayed · moved up", style: "h3" });
body.push({ image: movementPng, width: 500, margin: [0, 2, 0, 8] });
```

- [ ] **Step 3: Add per-domain movement + subdomains + follow-up to `domainBlock`**

`domainBlock(pc, y7Year, y9Year)` currently has only `pc` + years. It needs the store to read subdomain results. Change its signature to `domainBlock(pc, y7Year, y9Year, store)` and update the call site in `buildCohortDoc` (the `for (const pc of pairings.values())` loop) to pass `store`.

Inside `domainBlock`, after the Wilson/McNemar block, add:

```tsx
const movePng = await figureToPng(
  movementStackedFigure([{ label: `${pc.domain} (n=${pc.paired.length})`, movement: bandMovement(pc) }]),
  520,
  140,
);
out.push({ text: "Band movement", style: "h3" });
out.push({ image: movePng, width: 500, margin: [0, 2, 0, 6] });

const y7Results = store.get(`${y7Year}|7|${pc.domain}`)?.studentResults ?? [];
const y9Results = store.get(`${y9Year}|9|${pc.domain}`)?.studentResults ?? [];
const subs = subdomainMovement(y7Results, y9Results);
if (subs.length > 0) {
  out.push({ text: "Subdomains — Y7 vs Y9 % correct (directional, not true growth)", style: "h3" });
  out.push(
    table(
      ["Subdomain", "Y7 %", "Y9 %", "Δ"],
      [...subs]
        .sort((a, b) => (a.y9PctCorrect ?? 0) - (b.y9PctCorrect ?? 0))
        .map((s) => [
          s.subdomain,
          pct1(s.y7PctCorrect ?? 0),
          pct1(s.y9PctCorrect ?? 0),
          s.deltaPp == null ? "—" : `${s.deltaPp >= 0 ? "+" : ""}${s.deltaPp.toFixed(1)}`,
        ]),
      ["*", "auto", "auto", "auto"],
    ),
  );
}

const ds = declinedOrStalled(pc);
if (ds.declined.length > 0 || ds.stalled.length > 0) {
  out.push({ text: "Students to follow up (Local IDs only)", style: "h3" });
  out.push(
    table(
      ["Local ID", "Flag", "Y7 class", "Y9 class", "Y7 → Y9 band"],
      [
        ...ds.declined.map((s) => [s.localStudentId, "Declined", s.classGroupY7 ?? "—", s.classGroupY9 ?? "—", `${s.proficiencyY7} → ${s.proficiencyY9}`]),
        ...ds.stalled.map((s) => [s.localStudentId, "Stalled at NAS", s.classGroupY7 ?? "—", s.classGroupY9 ?? "—", `${s.proficiencyY7} → ${s.proficiencyY9}`]),
      ],
      ["auto", "auto", "auto", "auto", "*"],
    ),
  );
}
```

Note: the store key format `${year}|${level}|${domain}` matches `core`'s `storeKey`. (`store` is `Map<string, LoadedFile>`; `pct1` and `table` are already imported in `cohortReport.ts`.)

- [ ] **Step 4: Run the PDF test**

Run: `npx vitest run --project ui src/test/pdf.test.ts`
Expected: PASS — `buildCohortDoc` still assembles a valid document and renders to `%PDF-` bytes (the test mocks chart→PNG, so the new `figureToPng` calls return the stub PNG).

- [ ] **Step 5: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/pdf/cohortReport.ts
git commit -m "feat(pdf): cross-domain overview + per-domain movement/subdomains/follow-up in cohort report"
```

---

## Task 11: Full green-gate + lint + final commit

**Files:** none (verification).

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: exits 0. (Fix any unused imports the new code left behind — e.g. if `isReading` is now only used in one place, keep it; if a helper became unused, remove it.)

- [ ] **Step 2: Typecheck (both projects)**

Run: `npm run typecheck`
Expected: `tsc -b && tsc -p tsconfig.app.json --noEmit` both exit 0.

- [ ] **Step 3: Full test suite**

Run: `npm test`
Expected: all tests pass — the original suite plus the new `cohortMovement` (4 describes), `cohortCharts` (3 describes), and the new UI render tests.

- [ ] **Step 4: Production web build**

Run: `npm run build`
Expected: builds with no errors.

- [ ] **Step 5: Commit any lint fixups + push**

```bash
git add -A
git commit -m "chore: lint + green-gate for cohort comparison enhancements" || echo "nothing to commit"
git push origin main
```

- [ ] **Step 6 (optional, manual): visual smoke**

Run `npm run dev`, load a NAPLAN folder, open Section 10. Confirm: the "Across all domains" overview (dumbbell + net-change + movement bars with the NAS%/Meeting+% toggle), and within a domain drill-down the band-movement bar, the subdomain table (for Numeracy/Spelling/Grammar too), and the "students to follow up" list. Export the cohort PDF and confirm the new sections render.

---

## Notes for the implementer

- **Keep `core/` filesystem-free.** All new core functions take data, never read files. The ESLint guard enforces this.
- **No student names — ever.** The declined/stalled list uses `localStudentId` only. Do not add a name column.
- **Australian English** in all user-facing strings.
- **The numbers are oracle-validated upstream.** `bandMovement` derives from `transitionMatrix`; `crossDomainSummary` from `cohortHeadline`; both already match the Python oracle exactly. Don't reimplement that maths.
- **Subdomain caveat is non-negotiable UI text** — Y7-vs-Y9 % correct is directional, not true growth.
- If a domain has no Student Results data in one year, `subdomainMovement` returns rows with `null` deltas / the empty branch shows the "no data" note — both are handled.
