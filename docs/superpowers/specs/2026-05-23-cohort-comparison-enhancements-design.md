# Design — Year 7 → Year 9 cohort comparison enhancements

_Date: 2026-05-23 · Status: approved design, pending spec review · Author: brainstorming session_

## Context

Naplan Throughline already ships a rich Section 10 ("Cohort tracking") that
compares the **same students** from Year 7 to Year 9, matched on Local Student
ID — the school's value-add measure. Today it shows, **one domain at a time**: a
transition Sankey, a direction-coloured heatmap, a Wilson-CI dot plot, the
McNemar significance test, attrition, equity sub-cohorts, class-group tracking,
Reading subdomains, and a leadership narrative.

The Y7→Y9 comparison is the most valued feature. This design broadens and
deepens its **output** for two audiences confirmed in brainstorming: the
**leadership team** (data conversations) and **classroom faculties** (acting on
the data). It is explicitly **not** aimed at parents or school council, so we
optimise for analytical depth and actionability, not lay simplification.

### Data constraint (drives everything)

The SSSR export contains **no NAPLAN scale score** — only the four proficiency
**bands** (Needs additional support / Developing / Strong / Exceeding), raw
attempt counts, and demographics (verified against a real file). Therefore:

- True continuous "growth in points" is **impossible** with this data.
- Raw % correct is **not** comparable across years (the Y9 test is harder).
- The **proficiency-band transition is the only valid Y7→Y9 measure** — which is
  what Section 10 already uses. All enhancements work within that.

## Goal

Make the band-transition story **broader** (compare all four domains at once,
for leadership) and **more actionable** (down to subdomains and named-by-ID
students, for faculties), without removing the existing visualisations.

## Scope

Three confirmed additions (A, B, C) plus an additive movement summary (D), all
within Section 10. The user chose to **go broad now and trim later** if anything
proves redundant.

### A. Cross-domain overview (new — leads Section 10)

A block answering "where did we add value across all four domains?":

1. **Dumbbell chart** — one row per domain; grey dot = Y7 NAS%, coloured dot =
   Y9 NAS%, joined by a line; sage = improved, coral = worsened, grey = flat.
   Toggle to view as **Meeting+%** (Strong + Exceeding) as well as NAS%.
2. **Net-change strip** — diverging bar of Δ NAS (percentage points) per domain,
   beside the dumbbell (left = improved, right = worsened).
3. **Movement small-multiples** — the 100% stacked **moved-up / stayed /
   moved-down** bar per domain (see D).
4. The existing per-domain **headline table** (paired n, Y7/Y9 NAS%, ΔNAS,
   McNemar p) and **leadership narrative** move beneath this overview.

### B. Subdomain breakdown for all domains (per-domain drill-down — faculties)

Extend today's Reading-only subdomain view to **Numeracy, Spelling and Grammar**:
Y7 vs Y9 **% correct per subdomain**, weakest first, with the Y7→Y9 delta.

- **Caveat shown in the UI:** this is "capability against the year-level
  standard" — a **directional** diagnostic signal, **not** true growth, because
  the Y7 and Y9 tests differ. (Mirrors the legacy framing.)
- Domains with sparse or absent subdomains (e.g. Spelling) **degrade gracefully**
  to a short note rather than an empty chart.

### C. Declined / stalled student list (per-domain drill-down — faculties)

A faculty target list, **Local Student ID only — never names**, per domain:

- Students who **dropped ≥1 proficiency band** Y7→Y9.
- Students who **stalled at Needs additional support** in both years.
- Columns: Local Student ID, Y7 class group, Y9 class group, Y7 band → Y9 band.
- Same privacy model as the existing Section 8 (Targeted support) list.

### D. Movement summary (additive — both places)

The **100% stacked bar** (moved down · stayed · moved up), with the percentage
shown **statically inside each segment** and the paired **n on each row label**
(no mouseover — works in the app, the PDF, and when projected). If a segment is
too thin for its label, that one label is dropped rather than overlapping.

- Appears as **small-multiples** (one bar per domain) in the cross-domain
  overview, and as a **single bar** in each per-domain drill-down.
- Surfaces nuance the NAS-only numbers hide — e.g. Numeracy's NAS rate improved,
  yet 22% of those students still slipped down a band.

## Architecture

Keep the layered separation: pure logic + chart specs in `core/`, rendering in
`src/`. All new logic traces to primitives already validated exactly against the
Python oracle (transition matrix, paired-cohort records).

### New pure functions (`core/src/sections/` + `core/src/cohortBuild.ts`)

- `bandMovement(pc): { up, stayed, down, total }` (+ percentages) — derived from
  the transition matrix (above diagonal = up, diagonal = stayed, below = down).
- `crossDomainSummary(pairings): CrossDomainRow[]` — per domain: paired n, Y7/Y9
  NAS%, Meeting+%, ΔNAS, and `bandMovement`. Composes existing `cohortHeadline`.
- `declinedOrStalled(pc): { declined: PairedStudentMove[]; stalled: PairedStudentMove[] }`
  — from `pc.paired` (Local ID, class groups, Y7/Y9 bands).
- Generalise the existing `readingSubdomainMovement(y7Results, y9Results)` to
  `subdomainMovement(...)` usable for any domain (the logic is already
  domain-agnostic; only its naming/wiring is Reading-specific).

### New pure chart-spec builders (`core/src/charts/`)

- `dumbbellFigure(rows, metric)` — Y7→Y9 dumbbell per domain.
- `divergingDeltaFigure(rows)` — net-change diverging bar.
- `movementStackedFigure(rows)` — 100% stacked up/stayed/down with static labels.

### UI (`src/views/sections/`)

- New `CrossDomainOverview` block at the top of `S10CohortTracking`.
- Per-domain drill-down gains: the movement bar, subdomain movement (all
  domains), and the declined/stalled table.
- All three new charts also flow into the **Section 10 PDF** report.

## Verification

- Unit-test each new pure function (Vitest), asserting against the
  oracle-validated transition matrix / paired records on the synthetic fixtures.
- Chart builders: structural assertions (existing pattern).
- UI: render the new overview + per-domain additions against the synthetic store
  (existing jsdom harness), asserting they render with data and don't throw.
- The Section 10 PDF still generates with the new charts (existing PDF test
  pattern, charts mocked).

## Out of scope (YAGNI / data limits)

- **Scale-score growth** — the data has none.
- **National / similar-school benchmark overlay** — out of scope, no data.
- **Removing existing charts** (Sankey, heatmap, Wilson) — kept for now; trim
  later if they prove redundant.
- New top-level navigation / tabs within Section 10 — kept as a single vertical
  flow (overview first, then per-domain) unless it feels long in practice.

## Open questions

None blocking. One to revisit during build: confirm subdomain granularity per
domain in real data (especially Spelling) so the "degrade gracefully" path is
triggered correctly.
