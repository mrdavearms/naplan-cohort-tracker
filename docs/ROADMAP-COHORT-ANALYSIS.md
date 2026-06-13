# Cohort analysis (Section 10) — improvement roadmap

Agreed 2026-06-13. Dave approved the full brainstorm list; this document batches it
into release-sized phases, in dependency order. Tick items off as they ship and
note the shipped version. This roadmap covers Section 10 (cohort tracking) and
the cross-domain overview only — it does not touch Sections 1–9 except where a
shared mechanism (the metric toggle) naturally extends.

**Senior-engineer review, 2026-06-13:** the plan was reviewed against the
codebase before any implementation; five blocking spec errors and seven
adjustments were folded in below. Three owner decisions were put to Dave and are
recorded inline, marked **[owner decision 2026-06-13]**.

## Data-format fact (checked 2026-06-13, real 2026 SSSR export)

**The SSSR export contains NO NAPLAN scaled scores** — not in Student Reports
(bands, participation, attempted/correct counts, ID columns only), not in the
Student Results Table. All features below are proficiency-band-based. Any future
idea needing scaled-score growth or effect sizes is infeasible with this export.
Two columns we don't currently parse that may matter later: per-student
`Attempted`/`Correct` counts (a directional %-correct signal only — test
difficulty differs across years) and `Previous * Student ID` columns (possible
joiner-matching aid).

## How each feature is built (standard recipe)

Every item follows the same path — no exceptions, so quality stays uniform:

1. **Core first** — pure function(s) in `core/src/sections/`, no React/Tauri/DOM.
2. **Tests with hand-computed expectations** — these features have no legacy
   oracle (the Python app never had them), so correctness = Vitest assertions
   against hand-worked numbers on the committed fixtures, plus a spreadsheet
   cross-check on real school data before release.
3. **UI in `S10CohortTracking.tsx` / `CrossDomainOverview.tsx`** — jsdom test via
   `renderWithApp` + `fixtures.ts` (not the browser preview; Plotly is stubbed).
4. **Interpretation bullets** where the feature changes what a reader should
   conclude (`cohortInterpret.ts` / `narrative.ts`).
5. **PDF** (`cohortReport.ts`) only where the feature belongs in the printed
   report — one visualisation wide, wide internal canvas.
6. **Local gates before push:** `npm run lint` · `typecheck` · `test` · `build`
   (no Rust changes anywhere in this roadmap — annotations persist via the
   existing localStorage adapter, see 4-3).
7. Ship on `test`, Dave verifies in the running app against real data, then
   merge → `main` with explicit confirmation, bump the three version fields,
   tag, `scripts/mirror-release.sh`.

## Invariants every phase must respect

- `n < 5` suppression is **not adjustable** — it is a privacy invariant, never a
  setting. New filtered/sliced views must apply it to the **whole slice**, not
  just sub-rows (see 2-2 for the full rules).
- **Local Student IDs only, never names.** The export carries a `Student name`
  column; no new table, chart, CSV or PDF may surface it.
- **Significance language is reserved for the unfiltered whole-cohort headline.**
  Sliced/filtered views and per-cohort trend points show counts and CIs only,
  labelled "exploratory — not a statistical test". A UI that invites many slices
  is running many implicit tests; the narrative must not bless any of them as
  "significant". (Review adjustment, 2026-06-13.)
- **Click-through student lists** [owner decision 2026-06-13]: on *unfiltered*
  charts, clicking a flow may list its students at any n — consistent with the
  existing declined/stalled tables. When an LBOTE/ATSI filter is active, any
  student list under n=5 is suppressed.
- One visualisation wide — never side by side (screen and PDF). Reduced *heights*
  are allowed; narrow renders are not.
- On-device only. The benchmark feature (3-3) is *manually typed* figures —
  no fetching, ever.
- Attribution framing from `core/src/phase.ts` travels with every new view.

---

## Release 1 — v1.2 "Counts and follow-up clarity"

Small, low-risk work on existing data paths. Highest yield per line of code. No
new chart machinery. (1-3 is small in code but needs careful statistical
wording — see its spec.)

- [x] **1-1 Counts beside percentages.** *(v1.2 — on `test`)* Everywhere S10 shows a percentage or pp
  delta, show the student count too ("−8.5pp · 6 students out of NAS").
  *Build note:* implement via a small `levelSetCount(paired, year, predicate)`
  helper shaped so the v1.3 metric descriptor (2-1a) can consume it — avoids
  rewriting the same cells twice. `cohortHeadline` gains count fields.
- [x] **1-2 Quantified attrition sentence.** *(v1.2 — on `test`)* One computed line under the
  stayers/leavers table quantifying the **baseline-composition difference**
  (stayers vs full-cohort entry NAS rates, in pp). The wording must claim only
  composition — never a "corrected headline", since leavers' exit outcomes are
  unknowable.
- [x] **1-3 Detectability note.** *(v1.2 — on `test`)* The exact-McNemar floor, not a power estimate:
  with all discordant movement one-directional, p = 2·0.5^D, so significance
  needs **at least 6 one-way movers** (D=6 → p≈0.031; D=5 → 0.0625). Wording:
  "with n=43 matched students, a NAS change smaller than ±14 pp (6 students)
  cannot reach significance even in the best case" — the "at least / even in
  the best case" framing is mandatory (offsetting movement raises the bar
  further). Hand-verify the D=6 threshold in Vitest. Reused by 4-1.
- [x] **1-4 "Improved" list.** *(v1.2 — on `test`)* Alongside declined/stalled: students who moved out
  of NAS or up a band, with classes — for recognition and for spotting which
  groups/interventions the improvers shared. (Mirror of `declinedOrStalled`.)
- [x] **1-5 Cross-domain follow-up intersection.** *(v1.2 — on `test`)* One table across all domains
  in the active phase: each flagged student, which domains they declined/stalled
  in, sorted by domain count. 2+ domains = genuine intervention priority.
  (A `localStudentId` join over the existing `pairings` map.)
- [x] **1-6 Joiners analysis.** *(v1.2 — on `test`)* Mirror of the attrition card: joiners' exit-year
  band distribution vs stayers'. `JoinerRow` already carries class, band and
  LBOTE/ATSI — data is in place.

**Done when:** all six visible with real data; counts hand-verified against the
source spreadsheets for one domain; the D=6 detectability threshold unit-tested;
PDF updated for 1-2/1-3/1-5.

## Release 2 — v1.3 "Adjusters" (interactivity)

**The largest release in this roadmap** — Dave chose the full metric retrofit
(2-1b). Build order within the phase: 2-1a seam → 2-2 → 2-3 → 2-4/2-5 → 2-1b
prose retrofit last. If the phase overruns, 2-1b ships as its own follow-up
release rather than holding the rest hostage.

- [ ] **2-1a Metric descriptor seam (NAS + Meeting+ only).** A core descriptor
  `{label, predicate(level), lowerIsBetter}` consumed by `cohortHeadline`,
  `mcnemarPaired`, `wilsonCiDotPlotFigure`, `divergingDeltaFigure` (whose
  "negative = better" colouring and axis title are currently NAS-hard-coded),
  the S10 headline table's inline direction logic, and the PDF headline block.
  **"Developing → Strong conversion" is NOT a metric here** — it's a conditional
  rate (one number per cohort, no entry-side value), so it can't drive the
  dumbbell/Wilson/McNemar machinery. It lives in 3-2.
- [ ] **2-1b Full prose retrofit** [owner decision 2026-06-13: full retrofit,
  not charts-only]. `cohortInterpret.ts` (~55 NAS references) and `narrative.ts`
  (~24) become metric-aware, including direction flips (NAS lower-is-better vs
  Meeting+ higher-is-better) in every generated sentence. Effectively a rewrite
  of the narrative generators; budget accordingly and regression-test the
  NAS-selected output against the pre-change wording.
- [ ] **2-2 Cohort slice filters.** Filter the matched cohort by entry band,
  entry class group, LBOTE/ATSI; Sankey, heatmap, movement bar and headline
  recompute for the slice. *Seam:* a pure `filterPairedCohort(pc, slice):
  PairedCohort` in core — every figure builder already takes a `PairedCohort`,
  so no builder signatures change. Attrition and joiner cards are **excluded**
  from sliced views (joiners lack entry-state to filter on).
  **Privacy rules (specified before code, non-negotiable):**
  (i) slice n<5 ⇒ the **entire drill-down** is suppressed — charts, tables,
  pills, click-through — with the standard privacy note;
  (ii) with an LBOTE/ATSI filter active, student lists under n=5 are suppressed
  even though unfiltered lists are not;
  (iii) sliced views show **no McNemar p / significance claims** — counts and
  CIs only, labelled exploratory (see invariants);
  (iv) components that ignore the filter (match-rate banner, leadership
  narrative) must be visibly labelled whole-cohort so filtered charts are never
  silently presented beside unfiltered prose;
  (v) mind complementary disclosure: a slice plus its visible complement must
  not let a reader subtract their way to a suppressed group's numbers.
- [ ] **2-3 Click-through to students.** Three testable pieces, not one feature:
  (a) core `studentsForTransition(pc, fromBand, toBand)` — unit-tested against
  hand counts (this is where the "exactly the hand-counted students" done-when
  lives); (b) `Chart.tsx` gains an `onPlotClick` prop (it currently exposes no
  Plotly events); (c) the ui-test Plotly stub is extended to surface clicks so
  jsdom can test the band-pair → list wiring. **The heatmap is the primary
  click target** — its events carry clean x/y band labels; the Sankey's link
  events need index arithmetic and its `customdata` is a prose string, so
  Sankey click support is an optional follow-up, not the deliverable.
  Suppression per the click-through invariant above.
- [ ] **2-4 Waffle / icon-array movement chart.** "Out of 71 matched students…"
  as coloured unit squares — the staff-meeting-friendly version of the stacked
  bar. Goes to PDF too.
- [ ] **2-5 Class value-add scatter.** x = entry NAS%, y = exit NAS%, bubble per
  class group (n ≥ 5 filter, suppressed classes listed beneath), no-change
  diagonal drawn. (`classGroupTracking` already yields the inputs.)

**Done when:** metric toggle round-trips in jsdom tests for charts, tables AND
prose (NAS output matches pre-change wording); `filterPairedCohort` +
`studentsForTransition` hand-verified on fixtures; the five privacy rules in 2-2
each have a test; both new figures render wide on screen and in the PDF.

## Release 3 — v1.4 "Cohort to cohort" (the headline feature)

Answers "are we getting better at growing cohorts?" — value-add compared across
successive exit-year cohorts. Needs schools to load 4+ years of files; the
import/Home guidance must say so.

- [ ] **3-0 Multi-year fixtures + load test.** Extend fixture generation to
  three exit years **with per-cohort proficiency mutations** (re-registering the
  same workbook under different years makes every cohort identical and verifies
  nothing — extend the `make-primary-fixtures.mjs` approach; more committed
  binaries; note only Reading currently has paired fixtures). **Also: load a
  real 4-year folder and watch IPC payload size and memory** — the folder read
  returns every workbook's bytes in one IPC payload and `bytesRef` retains all
  raw bytes for the session; 4 years × 4 domains in the 2025 two-file format is
  up to 32 workbooks.
- [ ] **3-1 Cohort trend.** Core `cohortTrend(store, phase)`: the Section 10
  headline (ΔNAS, ΔMeeting+, paired n, entry NAS%) per exit year. *No store or
  AppState change needed* — `cohortReadiness` already scans all exit years
  independent of `primaryYear`; the trend function does the same scan. UI: trend
  chart per domain with n labels and entry-baseline context alongside — never a
  bare trend line that hides intake differences. Per-cohort points show counts
  and CIs, **no significance claims** (invariants).
- [ ] **3-2 Entry-band-conditional comparison.** "Of students who entered at
  Developing, what % reached Strong+?" per cohort — the fairest like-for-like
  cohort comparison because it controls for intake. **This is also where the
  "Developing → Strong conversion" measure lives** (moved from 2-1). Small
  per-band ns across cohorts: suppression and exploratory labelling apply.
- [ ] **3-3 Manual benchmark figures.** Settings fields where the user types
  published national/state figures (from ACARA's public reports); drawn as
  labelled reference lines. **Level charts only** (exit-year NAS%/Meeting+%) —
  never on delta/value-add charts: ACARA publishes cross-sectional all-students
  proportions, which are not comparable to a matched-cohort delta, and implying
  otherwise violates the attribution framing. Caveat string lives in
  `phase.ts` style. Design the settings shape first: benchmarks are a grid of
  (year level × domain × metric × calendar year), added via the `migrate()`
  settings-schema path. Typed data only — no network.
- [ ] **3-4 Import/Home readiness for multi-cohort.** Extend `cohortReadiness`
  framing so Home explains which extra years would light up the trend view.
  (Mostly copy — `CohortSetupCard` already renders time-aware guidance.)
- [ ] **3-5 PDF trend section.**

**Done when:** three-cohort fixture produces hand-verified trend numbers; a
two-year load degrades gracefully (no trend, no errors); a real 4-year folder
loads with acceptable memory/IPC time; benchmark lines appear only on level
charts.

## Release 4 — v1.5 "From findings to planning"

- [ ] **4-1 What-if target slider.** "If 4 of the current 11 NAS students move
  out by Year 9, NAS% becomes X%" — AIP targets grounded in real counts, with
  the 1-3 detectability floor saying whether the target is even measurable.
- [ ] **4-2 Item-level diagnosis for the slipped group.** *(Medium-large — the
  join is the hard part.)* For declined/stalled students, which
  subdomains/descriptors they missed relative to the rest of the matched cohort.
  Sub-items: (a) a core **Local ID ↔ PSI mapping helper** — flagged students are
  keyed by `localStudentId` but `StudentResultRow` only carries `studentPsi`;
  the join goes through `StudentReportRow` and must handle the blank-Local-ID
  `{PSI}*` fallback; (b) a **results-bearing paired fixture** (current paired
  fixtures load Student Reports only); (c) the analysis itself, reusing S5's
  bottom-descriptor rules (attempt-rate ≥ 0.5, nAttempted > 0).
- [ ] **4-3 Pinned narrative + annotations.** Pin narrative bullets; add local
  notes ("intervention group started Term 2 2025"); pinned items + notes flow
  into the PDF. *Storage:* the existing localStorage persistence adapter under
  a **separate key** from the settings blob (no Tauri plugin needed). Pins store
  a **snapshot of the bullet text plus its context** (phase, domain, exit year)
  — never an index into the generated list, or pins silently rot when 2-1b or
  later releases reword the generators.
- [ ] **4-4 "Data conversation" sheet** [owner decision 2026-06-13: two-sided
  single sheet]. One piece of A4, double-sided: Sankey full-width on the front;
  dumbbell + waffle + five bullets on the back. A variant of the existing
  pdfmake pipeline reusing `figureToPng` — not new machinery. Done-when: both
  sides fit with real data at legible sizes.
- [ ] **4-5 Staff-meeting presentation mode** (one chart per screen, big fonts).
  Optional — first to cut if v1.5 grows.

**Done when:** what-if numbers hand-verified; 4-2 cross-checked against S5 logic
on real data; annotations survive an app restart and a version upgrade; the
two-sided sheet prints correctly.

---

## Sequencing rationale

- v1.2 first because every later phase displays its outputs (counts,
  detectability) and it ships value in days, not weeks. 1-1 is deliberately
  built on the shape 2-1a will consume.
- v1.3 carries the only refactors in the plan (metric seam, slice filter) plus
  the owner-chosen full prose retrofit — it is the biggest release, which is
  why 2-1b is sequenced last inside it with an explicit escape hatch.
- v1.4 is the biggest *design* job and changes user behaviour (loading 4+
  years), so it benefits from the v1.2/v1.3 groundwork being in users' hands
  first — and from the metric seam existing before trend charts multiply views.
- v1.5 depends on artefacts from all earlier phases (detectability, waffle,
  narrative pins surviving the 2-1b rewording).

Within a phase, items are independent enough to land as separate commits on
`test`; release when the phase's "done when" holds, not per-item.

## Review log

- **2026-06-13 — senior-engineer pre-implementation review.** Five blocking
  amendments folded in: 2-1 split and resized (NAS hard-coded across ~10 core
  functions, 2 chart builders, ~80 prose references, PDF); 2-3 restated as
  three testable pieces with the heatmap as primary click target (Chart.tsx had
  no event props; the test stub ignores props; Sankey link events need index
  arithmetic); 2-2 privacy rules written into the spec (whole-slice
  suppression, equity-filtered list suppression, complementary disclosure, no
  p-values on slices); 4-2 resized with the Local ID ↔ PSI join and fixture gap
  made explicit; 1-3 pinned to the exact-McNemar best-case floor (D ≥ 6) with
  mandatory "at least" wording. Plus: significance-language invariant;
  benchmark lines restricted to level charts; 3-1 confirmed needing no
  AppState change (risk redirected to IPC/memory); 4-3 confirmed plugin-free
  with snapshot-not-index pinning; 4-4 made two-sided; 3-0 fixtures must vary
  per cohort. Owner decisions: click-through suppression only under equity
  filters; full prose retrofit in v1.3; two-sided one-pager.
