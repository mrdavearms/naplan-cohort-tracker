# CLAUDE.md — Naplan Throughline

Project guidance for Claude (or any AI assistant) working in this folder. Adapted from the legacy Python/Streamlit repo's CLAUDE.md — it carries the data-format quirks, keying rule, and attribution framing that are easy to violate by inference. Read this before any non-trivial change.

## What this is

Naplan Throughline is a cross-platform desktop app (**Tauri 2 + React 19 + TypeScript**) for NAPLAN cohort analysis. It is a from-scratch rewrite of the WHS-internal Python/Streamlit app at `/Users/davidarmstrong/Antigravity/naplan_analysis_app/`.

That legacy repo is **read-only** and serves two roles:

- **Specification** — its analytical logic is exact. Port behaviour; don't reinvent it.
- **Validation oracle** — `verification/verify_cohort.py` produces the reference numbers the TypeScript port is tested against.

**Never write to the legacy repo.** Read from it freely.

Unlike the legacy app (single school, hard-coded WHS), Naplan Throughline is **multi-school and on-device**: a user points it at a folder of Year 7 and Year 9 SSSR Extract files, and school identity (name, school number, AIP/KIS references) is **data in app settings, never code**.

## Architecture — keystone decisions (expensive to change later)

1. **Three strictly separated layers:**
   - `core/` — pure-TypeScript analysis library. **No React, no Tauri, no DOM.** Independently unit-testable; the crown jewel. A web build, CLI, or different shell could reuse it later.
   - `src/` (UI) — React 19 + Vite + Tailwind + shadcn/ui. Consumes `core/`.
   - `src-tauri/` — native window, native folder/file dialogs, packaging, updater.
2. **School identity is data, never code.** No "Wangaratta High School" string anywhere in code. A Settings screen writes school identity to local app-data. This is the multi-school enabler.
3. **A visible Y7↔Y9 ID match-rate banner** ("matched 71 of 95 students") so the most common "looks broken" case — Local Student IDs that don't reconcile across years — is self-diagnosing, not silent.

**Build the `core/` library and prove it against the oracle *before* building the Tauri shell. Do not scaffold the shell first.**

## Data model

- **Store key:** `(yearOfTest, yearLevel, domain)` → one loaded entry.
- **Proficiency levels (order matters — drives the transition matrix):**
  `["Needs additional support", "Developing", "Strong", "Exceeding"]`
- **Valid year levels:** 7 and 9.
- **Domains:** Reading, Numeracy, Spelling, Grammar and Punctuation. (Writing is NOT in the SSSR export — out of scope. Gender is also not in the export — no gender analysis.)
- **Core types to port:** `LoadedFile`, `PairedCohort` (paired / leavers / joiners), `McNemarResult`, `YearFolder`.

> Verify exact domain spellings and column names against the legacy `naplan/loader.py` / `naplan/cohort.py` when porting — string equality drives keying and must match the data exactly.

## Data file format — read carefully

Two SSSR export formats exist in production data:

- **2026 format** — one workbook per (year × domain), each containing all four sheets: `School Item Report` (unused), `Student Reports`, `Student Results Table`, `Student Writing Results Table` (unused). Only Student Reports + Student Results Table are used.
- **2025 format** — one workbook per sheet × domain × year; must be paired by `(yearLevel, domain)`. `... Student Reports {domain} {year}.xlsx` holds only the Student Reports sheet; `... Student Results Table {domain} {year}.xlsx` holds only the results sheet. Both must be present to register an entry.

**Column-name casing differs between 2025 and 2026** — the most likely source of bugs. Normalise via alias maps when porting the loader:

| 2026 (target spelling) | 2025 spelling |
|---|---|
| `Local student ID` | `Local Student ID` |
| `Student name` | `Student Name` |
| `Year level` | `Year Level` |
| `Class groups` | `Class Groups` |
| `Student marked response` | `Student Marked Response` |

Within a single 2026 export the two sheets *also* differ (Student Reports uses `Year level`; Student Results Table uses `Year Level`). This is VCAA's inconsistency, not ours — the aliases account for it.

Known data gaps to preserve:
- Some students have a blank `Local student ID` — fall back to `Student ID` with a `*` suffix.
- `Indigenous Status` / `LBOTE Status` blank for non-participants — treat as "Not reported".

## Keying rule — critical

Join cross-year cohorts on **`Local student ID`**, with a **`{PSI}*` fallback** (the VCAA Student ID suffixed with `*`) when Local student ID is blank. **NEVER key on the VCAA `Student ID` (PSI) alone** — it is per-test-administration and changes between years (gives 0% overlap). `Local student ID` is the school's stable identifier across years (~80% Y7→Y9 match for the same cohort). The visible match-rate banner surfaces how many reconciled.

## NAPLAN attribution framing — non-negotiable

NAPLAN is sat in Term 1, which shapes how every result must be attributed:

- **Year 7 reflects primary-school output, not the secondary school's teaching.** Year-on-year Y7 change is feeder-cohort variation — never describe it as the school "improving"/"worsening" without explicit qualification.
- **Year 9 reflects the secondary school's contribution** (the cohort has had ~2 years there).
- **True school value-add = tracking one cohort from Y7 to Y9** (same students, two years apart; requires a Y7 file from two years before the Y9 file). This is Section 10 — the headline measure.

Keep Y7 and Y9 separated and clearly labelled. Frame NAPLAN as **diagnostic evidence** that informs improvement planning, not as a target-measurement instrument.

## Analysis rules learned the hard way (preserve in the port)

- **Suppression threshold `n < 5`** (n=5 is shown, n=4 is suppressed). The privacy note must stay visible when this triggers.
- **Bottom-descriptor filter:** `attemptRate >= 0.5` AND `nAttempted > 0`.
- Students with `Proficiency level = NaN` (Absent/Withdrawn) are **excluded from proficiency analytics but kept in participation analytics**.
- **For "highest/biggest" rankings across class groups or sub-cohorts, filter to `n >= 5` first**, then surface excluded small groups separately with the suppression note. (Otherwise a placeholder group like INC, n=2, dominates the summary.)
- **Overlapping 95% confidence intervals is NOT the same as p>0.05 for the difference.** For paired binary outcomes (NAS / not-NAS in the matched cohort) use **McNemar's test on the discordant 2×2 cells**, not CI overlap, to assess significance.
- **Wilson CI** is the closed-form score interval. **McNemar p** is the binomial on discordant pairs. Both are hand-ported and unit-tested against the oracle.

## Stack

| Concern | Choice | Notes |
|---|---|---|
| Shell | Tauri 2 | native installers, updater hooks; **ship unsigned for v1** |
| UI | React 19 + Vite + TypeScript | matches Dave's other apps |
| Styling | Tailwind + shadcn/ui | |
| Charts | Plotly.js | Sankey, direction-coloured heatmap, stacked bars, Wilson CI dot plots; exports PNG/SVG in-webview (no kaleido) |
| Excel read | SheetJS (`xlsx`) | reads SSSR `.xlsx` |
| Stats | hand-ported + Vitest | Wilson CI (closed form), McNemar (binomial on discordant 2×2) |
| PDF | Plotly `toImage` + `pdf-lib`/`pdfmake` | assembled in JS; no native dependency |
| Tests | Vitest | validated against the Python oracle |

Bundle identifier: `com.dandsarmstrong.naplanthroughline`. Repo: `github.com/mrdavearms/naplan-throughline` (private), account `dave@dandsarmstrong.com`.

## Privacy invariants

- On-device, local-only. **No external network calls. No student data leaves the machine.**
- No student names in any chart, table, exported CSV, or generated PDF. Local student IDs only (`{PSI}*` fallback).
- ATSI / small subgroups suppressed at `n < 5`; the privacy note stays visible.
- The legacy **cloud-AI / pseudonymisation / de-identification** workflow is **NOT ported** — it stays WHS-internal in the legacy repo.

## Verification (definition of done)

1. **Numbers match the oracle.** Vitest suite green; Wilson CI, McNemar p, NAS%, paired counts, transition matrix match `verify_cohort.py` output for the same input within tolerance.
2. **Side-by-side parity.** Same Y7+Y9 dataset through the legacy Python app and Naplan Throughline → identical headline numbers across all 10 sections.
3. **Cross-platform launch.** Launches on Mac and Windows; point at a folder of SSSR files, all 10 sections render, both PDFs generate, the match-rate banner shows.
4. **No WHS hard-coding.** A fresh blank-settings install shows neutral branding; entering a different school name/number propagates everywhere.

**Never claim numbers are right without checking against the oracle or source spreadsheets.**

## Working preferences

- **Australian English** in all user-facing text. Plain language; no jargon without a plain-English gloss in brackets. No emojis unless asked.
- **Minimum-footprint** changes — touch only what the task needs; don't refactor adjacent code. If something nearby is broken, mention it, don't fix it.
- Dave is the Principal (not a developer); he can use a terminal but doesn't write code. Surface concerns and tradeoffs early rather than only validating.
- Copy/paste content (commands, prompts, payloads) goes in fenced code blocks.

## Branch workflow (test-first)

This repo uses the **test-first branching policy** (adopted 2026-05-23), matching
the other Antigravity apps:

- **`test`** is the working/integration branch. Do feature work here; commit and
  push to `test`. CI (`.github/workflows/ci.yml`) runs lint + typecheck + tests on
  every push to `test` and `main`.
- **`main`** is the release branch. **Only merge `test` → `main` after CI is green
  on `test` AND with Dave's explicit confirmation** (never merge to `main`
  unprompted, even when it seems obvious).
- Releases are still cut from `main` via a version tag (`vX.Y.Z`) which triggers
  `release.yml`, then `scripts/mirror-release.sh vX.Y.Z` publishes to the public
  auto-update feed.

## Out of scope for v1

Code-signing / notarization (ship unsigned), auto-update server, cloud-AI / pseudonymisation, Mac App Store / Microsoft Store submission, Writing-domain analysis, gender analysis, national-average overlay.

## Legacy repo map (read-only — port from these)

- `naplan/loader.py` — discovery, parsing, column aliases, keying, `buildPairedCohort` inputs
- `naplan/cohort.py` — `build_paired_cohort`, `wilson_ci`, `mcnemar_paired`, `transition_matrix`, `PROFICIENCY_LEVELS`
- `naplan/cohort_charts.py` — Sankey + heatmap specs (incl. plain-black Sankey labels via annotations; title/margin spacing)
- `naplan/cohort_interpret.py`, `naplan/narrative.py` — interpretation-bullet generators + Section 9 rules-based templates
- `naplan/sections/s1_*.py … s10_*.py` — per-section logic
- `scripts/generate_cohort_report.py`, `naplan/overview_builder.py` — PDF layout, footer (Generated-on + Page N of M), table-wrapping / heading-spacing fixes
- `verification/verify_cohort.py` — **the validation oracle**
- `tests/`, `tests/fixtures/` — synthetic data + known-good numbers to port
