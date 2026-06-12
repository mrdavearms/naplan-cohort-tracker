# Cohort analysis (Section 10) — improvement roadmap

Agreed 2026-06-13. Dave approved the full brainstorm list; this document batches it
into release-sized phases, in dependency order. Tick items off as they ship and
note the shipped version. This roadmap covers Section 10 (cohort tracking) and
the cross-domain overview only — it does not touch Sections 1–9 except where a
shared mechanism (the metric toggle) naturally extends.

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
   (Rust untouched by this roadmap unless annotation storage needs a plugin —
   then the 4-edit plugin checklist applies).
7. Ship on `test`, Dave verifies in the running app against real data, then
   merge → `main` with explicit confirmation, bump the three version fields,
   tag, `scripts/mirror-release.sh`.

## Invariants every phase must respect

- `n < 5` suppression is **not adjustable** — it is a privacy invariant, never a
  setting. New filtered/sliced views must apply it after filtering.
- **Local Student IDs only, never names.** The export carries a `Student name`
  column; no new table, chart, CSV or PDF may surface it.
- One visualisation wide — never side by side (screen and PDF).
- On-device only. The benchmark feature (R3-3) is *manually typed* figures —
  no fetching, ever.
- Attribution framing from `core/src/phase.ts` travels with every new view.

---

## Release 1 — v1.2 "Counts and follow-up clarity"

Small, low-risk, table/text work on existing data paths. Highest yield per line
of code. No new chart machinery.

- [ ] **1-1 Counts beside percentages.** Everywhere S10 shows a percentage or pp
  delta, show the student count too ("−8.5pp · 6 students out of NAS"). Leaders
  communicate in students; counts stop over-reading of small-cohort wobbles.
- [ ] **1-2 Quantified attrition sentence.** One computed line under the
  stayers/leavers table: how many pp the selection effect flatters (or dampens)
  the headline, from the stayers-vs-full-cohort entry NAS rates.
- [ ] **1-3 Detectability note.** "With n=43 matched students, only a NAS change
  of roughly ±X pp is statistically detectable." Derived from the Wilson/McNemar
  machinery; shown with the headline and reused later by the what-if slider (4-1).
- [ ] **1-4 "Improved" list.** Alongside declined/stalled: students who moved out
  of NAS or up a band, with classes — for recognition and for spotting which
  groups/interventions the improvers shared.
- [ ] **1-5 Cross-domain follow-up intersection.** One table across all domains
  in the active phase: each flagged student, which domains they declined/stalled
  in, sorted by domain count. 2+ domains = genuine intervention priority.
- [ ] **1-6 Joiners analysis.** Mirror of the attrition card: joiners' exit-year
  band distribution vs stayers'. `JoinerRow` already carries everything needed.

**Done when:** all six visible with real data; counts hand-verified against the
source spreadsheets for one domain; PDF updated for 1-2/1-3/1-5.

## Release 2 — v1.3 "Adjusters" (interactivity)

Built on two small core seams added at the start of this phase: a **metric
abstraction** (NAS / Meeting+ / Developing→Strong) and a **cohort-slice filter**
that all figure builders accept.

- [ ] **2-1 Metric toggle, section-wide.** Extend the existing NAS/Meeting+
  toggle with "Developing → Strong conversion" and apply it across S10, not just
  the cross-domain overview.
- [ ] **2-2 Cohort slice filters.** Filter the matched cohort by entry band,
  entry class group, LBOTE/ATSI; Sankey, heatmap, movement bar and headline
  recompute live for the slice, with suppression applied post-filter.
- [ ] **2-3 Click-through to students.** Click a Sankey link (or a McNemar
  discordant cell) → the matching student list (Local IDs, classes, bands).
  Plotly click events; turns the charts from descriptive into operational.
- [ ] **2-4 Waffle / icon-array movement chart.** "Out of 71 matched students…"
  as coloured unit squares — the staff-meeting-friendly version of the stacked
  bar. Goes to PDF too.
- [ ] **2-5 Class value-add scatter.** x = entry NAS%, y = exit NAS%, bubble per
  class group (n ≥ 5 filter, suppressed classes listed beneath), no-change
  diagonal drawn.

**Done when:** filters + toggle round-trip in jsdom tests; clicking a Sankey flow
shows exactly the students hand-counted from the fixture; both new figures render
wide on screen and in the PDF.

## Release 3 — v1.4 "Cohort to cohort" (the headline feature)

Answers "are we getting better at growing cohorts?" — value-add compared across
successive exit-year cohorts. Needs schools to load 4+ years of files; the
import/Home guidance must say so.

- [ ] **3-0 Multi-year fixtures.** Extend `fixtures.ts`/`make-*-fixtures` to
  three exit years so trend maths is testable.
- [ ] **3-1 Cohort trend.** Core `cohortTrend(store, phase)`: the Section 10
  headline (ΔNAS, ΔMeeting+, paired n, entry NAS%) per exit year. UI: trend
  chart per domain with n labels and the entry-baseline context alongside —
  never a bare trend line that hides intake differences.
- [ ] **3-2 Entry-band-conditional comparison.** "Of students who entered at
  Developing, what % reached Strong+?" per cohort — the fairest like-for-like
  cohort comparison because it controls for intake.
- [ ] **3-3 Manual benchmark figures.** Settings fields where the user types
  published national/state figures (from ACARA's public reports); drawn as
  labelled reference lines on the trend and dumbbell charts. Typed data only —
  no network.
- [ ] **3-4 Import/Home readiness for multi-cohort.** Extend `cohortReadiness`
  framing so Home explains which extra years would light up the trend view.
- [ ] **3-5 PDF trend section.**

**Done when:** three-cohort fixture produces hand-verified trend numbers; a
two-year load degrades gracefully (no trend, no errors); real 2024+2026 data
renders sensibly.

## Release 4 — v1.5 "From findings to planning"

- [ ] **4-1 What-if target slider.** "If 4 of the current 11 NAS students move
  out by Year 9, NAS% becomes X%" — AIP targets grounded in real counts, with
  the 1-3 detectability note saying whether the target is even measurable.
- [ ] **4-2 Item-level diagnosis for the slipped group.** For declined/stalled
  students, which subdomains/descriptors they missed relative to the rest of the
  matched cohort (Student Results Table; bottom-descriptor rules from S5 apply:
  attempt-rate ≥ 0.5, nAttempted > 0). Bridges "who needs help" → "what to teach".
- [ ] **4-3 Pinned narrative + annotations.** Pin narrative bullets; add local
  notes ("intervention group started Term 2 2025") persisted in app-data;
  pinned items + notes flow into the PDF. Institutional memory between annual
  analyses.
- [ ] **4-4 One-page "data conversation" export.** A4: dumbbell + Sankey +
  waffle + five bullets. The staff-meeting artefact, distinct from the full
  leadership report.
- [ ] **4-5 Staff-meeting presentation mode** (one chart per screen, big fonts).
  Optional — first to cut if v1.5 grows.

**Done when:** what-if numbers hand-verified; 4-2 cross-checked against S5 logic
on real data; annotations survive an app restart; the A4 export fits one page
with real data.

---

## Sequencing rationale

- v1.2 first because every later phase displays its outputs (counts,
  detectability) and it ships value in days, not weeks.
- The v1.3 seams (metric abstraction, slice filter) are the only refactors in
  the plan; doing them before v1.4/v1.5 avoids retrofitting three new views.
- v1.4 is the biggest design job and changes user behaviour (loading 4+ years),
  so it benefits from the v1.2/v1.3 groundwork being in users' hands first.
- v1.5 depends on artefacts from all earlier phases (detectability, waffle,
  narrative pins).

Within a phase, items are independent enough to land as separate commits on
`test`; release when the phase's "done when" holds, not per-item.
