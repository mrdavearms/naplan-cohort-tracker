# CLAUDE.md — NAPLAN Cohort Tracker

Project guidance for Claude (or any AI assistant) working in this folder. Adapted from the legacy Python/Streamlit repo's CLAUDE.md — it carries the data-format quirks, keying rule, and attribution framing that are easy to violate by inference. Read this before any non-trivial change.

## What this is

NAPLAN Cohort Tracker is a cross-platform desktop app (**Tauri 2 + React 19 + TypeScript**) for NAPLAN cohort analysis. It is a from-scratch rewrite of an internal Python/Streamlit app at `~/Antigravity/naplan_analysis_app/`.

> **Lineage / rename:** this is the app formerly called **NAPLAN Throughline**. On 2026-05-26 the repo, local folder, product name and bundle id were all renamed to **NAPLAN Cohort Tracker** (git `b628dc6`) and the version reset to **1.0.0** (`962b849`). GitHub redirects the old `naplan-throughline` / `naplan-throughline-releases` URLs to the new names — same project and history, not a fork. Any `naplan-throughline` string you encounter now lives only in a local `src-tauri/target/` build cache; `cargo clean` clears it (otherwise it surfaces as a confusing `cargo check` failure).

> **Release status:** **v1.0.0 shipped publicly on 2026-05-27** (macOS + Windows installers on the public auto-update feed; builds unsigned, updater manifest signed). The app is live — treat further releases as *updates to a shipped app with users*, not a first launch. Next release = bump the three version fields → tag `vX.Y.Z` → `scripts/mirror-release.sh`.

That legacy repo is **read-only** and serves two roles:

- **Specification** — its analytical logic is exact. Port behaviour; don't reinvent it.
- **Validation oracle** — `verification/verify_cohort.py` produces the reference numbers the TypeScript port is tested against.

**Never write to the legacy repo.** Read from it freely.

Unlike the legacy app (single school, hard-coded to one school), NAPLAN Cohort Tracker is **multi-school and on-device**: a user points it at a folder of SSSR Extract files (Year 3/5 for a primary school, Year 7/9 for a secondary, or all four for a combined P–12), and school identity (name, school number, AIP/KIS references) is **data in app settings, never code**.

## Architecture — keystone decisions (expensive to change later)

1. **Three strictly separated layers:**
   - `core/` — pure-TypeScript analysis library. **No React, no Tauri, no DOM.** Independently unit-testable; the crown jewel. A web build, CLI, or different shell could reuse it later.
   - `src/` (UI) — React 19 + Vite + Tailwind + shadcn/ui. Consumes `core/`.
   - `src-tauri/` — native window, native folder/file dialogs, packaging, updater.
2. **School identity is data, never code.** No real school name hard-coded anywhere in code. A Settings screen writes school identity to local app-data. This is the multi-school enabler.
3. **A visible cohort ID match-rate banner** ("matched 71 of 95 students") so the most common "looks broken" case — Local Student IDs that don't reconcile across years — is self-diagnosing, not silent. Labels follow the loaded phase (Year 3→5 or 7→9).

> **Phase is data, inferred from the year level — never a global setting.** A combined P–12 school shows primary framing on its Year 3/5 views and secondary framing on its Year 7/9 views at once, so the framing/wording (incl. the attribution caveats below) lives in `core/src/phase.ts` and travels with the level. Section 10 offers a phase toggle (Primary / Primary→Secondary transition / Secondary) for whichever pairs are trackable, keyed on `CohortPhase.phase` (`CohortKind`, each value unique so it doubles as the selector key); single-phase schools see no toggle.

**Build the `core/` library and prove it against the oracle *before* building the Tauri shell. Do not scaffold the shell first.**

## Data model

- **Store key:** `(yearOfTest, yearLevel, domain)` → one loaded entry. Literal map key: `` `${yearOfTest}|${yearLevel}|${domain}` `` (e.g. `2026|7|Reading`).
- **Proficiency levels (order matters — drives the transition matrix):**
  `["Needs additional support", "Developing", "Strong", "Exceeding"]`
- **Valid year levels:** 3, 5, 7 and 9. The within-school growth pairs are **3→5 (primary)**, **7→9 (secondary)**, and **5→7 (transition — P–12 only)** — see `core/src/phase.ts` (`phaseFor`, `COHORT_PHASES`). 5→7 crosses the primary/secondary boundary, so ONLY a combined P–12 (same students stay enrolled Year 5→7) can track it; a standalone primary/secondary never has both files, so it never lights up. `cohortAttributionNote` gives 5→7 its own "continuous teaching, NOT feeder" framing.
- **`primaryYear` = the cohort's EXIT / latest calendar year (the anchor) — NOT the primary phase.** `cohortYears(primaryYear) = [primaryYear−2, primaryYear]`; every section derives backwards from it. The user-facing control is labelled **"Latest year"** (renamed from the misleading "Primary year"). `cohortReadiness(store)` scans all years and flags half-loaded cohorts (the self-diagnosing "add the missing file" card on Home).
- **Adding/altering a cohort pair = one entry in `COHORT_PHASES`.** `trackablePhases`, `cohortReadiness` and the import-readiness check all iterate it, and the interpret/stats functions are year-level-agnostic (they read `earlierLevel`/`laterLevel`), so a new pair propagates automatically. The only level-hardcoded spots are `phaseFor`/`nextStepLabel`/`cohortNextStep`.
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

**exceljs build trap:** the `core` (node) tests load exceljs's **node** build; the WebView and the `ui`/jsdom tests load its **browser** build, whose bundled JSZip rejects some `ArrayBuffer`s (e.g. a slice of a pooled buffer) but reliably accepts a `Uint8Array`. `parseWorkbook` must hand exceljs a `Uint8Array`, never a bare ArrayBuffer. A jsdom test in `src/test/loaderBrowser.test.ts` guards this path.

## Keying rule — critical

Join cross-year cohorts on **`Local student ID`**, with a **`{PSI}*` fallback** (the VCAA Student ID suffixed with `*`) when Local student ID is blank. **NEVER key on the VCAA `Student ID` (PSI) alone** — it is per-test-administration and changes between years (gives 0% overlap). `Local student ID` is the school's stable identifier across years (~80% match across the two years for the same cohort). The visible match-rate banner surfaces how many reconciled.

## NAPLAN attribution framing — non-negotiable

NAPLAN is sat in Term 1, which shapes how every result must be attributed. The
canonical per-level wording lives in `core/src/phase.ts::attributionNote` — change
it there, not inline.

**Secondary (Year 7 → 9):**
- **Year 7 reflects primary-school output, not the secondary school's teaching.** Year-on-year Y7 change is feeder-cohort variation — never describe it as the school "improving"/"worsening" without explicit qualification.
- **Year 9 reflects the secondary school's contribution** (the cohort has had ~2 years there).
- **True secondary value-add = tracking one cohort from Y7 to Y9.**

**Primary (Year 3 → 5):** the framing is DIFFERENT, not a label swap. A P–6 school
teaches the children from Foundation, so:
- **Year 3 is an early baseline** that largely reflects this school's own early-years teaching (NOT "feeder intake, not your teaching" — that secondary framing is wrong for primary, though some children arrive later from elsewhere).
- **Year 5 reflects the primary school's contribution.**
- **True primary value-add = tracking one cohort from Y3 to Y5.**

A third case — **Year 5 → 7 (transition, P–12 only)** — frames Year 5 as the entry
baseline and Year 7 as the school's *continuous* teaching across the move into
secondary (NOT feeder intake, since the cohort never left). Either way, value-add =
same students two years apart (requires the entry-year file
from two years before the exit-year file). This is Section 10 — the headline measure.
Keep entry/exit years separated and clearly labelled. Frame NAPLAN as **diagnostic
evidence** that informs improvement planning, not as a target-measurement instrument.

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
| Excel read | ExcelJS (`exceljs`) | reads SSSR `.xlsx` (the Vite chunk is named `vendor-xlsx`) |
| Stats | hand-ported + Vitest | Wilson CI (closed form), McNemar (binomial on discordant 2×2) |
| PDF | Plotly `toImage` + `pdf-lib`/`pdfmake` | assembled in JS; no native dependency |
| Tests | Vitest | validated against the Python oracle |

Bundle identifier: `com.dandsarmstrong.naplancohorttracker`. Repo: `github.com/mrdavearms/naplan-cohort-tracker` (private), contact `dave.armstrong@education.vic.gov.au`.

## Commands & local checks

Before claiming done, all must be green:
- `npm run lint` · `npm run typecheck` · `npm test` · `npm run build`
- `npm run check:release` — release preflight: asserts the four version fields agree and warns if the `CHANGELOG` entry is missing (see the version-sync note under *Branch workflow*).
- Rust shell: `cd src-tauri && cargo check && cargo clippy`. **Needs `dist/` to exist first** — `generate_context!` embeds the frontend, so run `npm run build` beforehand.

Tests are two Vitest projects: **core** (`core/tests/**`, node env, parses real `.xlsx`) and **ui** (`src/**/*.test.{ts,tsx}`, jsdom, Plotly stubbed via `src/test/stubs/`). CI runs lint + typecheck + test + build on a **Linux** runner only (cheap); the Rust shell and the macOS/Windows installers are compiled by the **release** workflow on a version tag. Run `cargo check`/`clippy` locally when touching Rust — that's the gate.

**Test stores:** `src/test/fixtures.ts` builds a `Store` from the committed `.xlsx` in `core/tests/fixtures/` — `buildSyntheticStore` (Y7/9), `buildPrimaryStore` (Y3/5), `buildCombinedStore` (all four). The `.xlsx` are committed binaries (no generator for the originals); regenerate the Y3/5 pair with `node scripts/make-primary-fixtures.mjs` (clones the Y7/9 fixtures, swaps the year-level cells).

**Two test styles, don't mix them up:** *core* section tests build small `PairedCohort` literals inline with hand-computed expectations (template: `core/tests/cohortMovement.test.ts`) — they do NOT parse the `.xlsx`. The committed `.xlsx` are for the *UI/jsdom* tests via `renderWithApp` + `fixtures.ts`. The synthetic Reading cohort is **5 paired / 2 leavers / 2 joiners / 1 declined / 1 stalled / 3 improved** — the numbers S10 jsdom assertions key on.

**Adding a Tauri plugin = 4 coordinated edits:** npm dep · `src-tauri/Cargo.toml` dep · `.plugin(...)` in `src-tauri/src/lib.rs` · a permission in `src-tauri/capabilities/default.json`. A missing capability fails at **runtime**, not build (e.g. `tauri-plugin-process` + `process:default` for app relaunch after an update).

## UI shell gotchas

- **One visualisation wide — NEVER side by side (screen AND PDF).** Charts must each
  get the full content width; a two-column chart grid crushes them. The Sankey is the
  canary: its fixed 200px side margins (for the node labels) mean a narrow render
  collapses the plot area and the blue `Y7 2024`/`Y9 2026` headers overlap into
  "Y7 20242026". On screen this is enforced by stacking (no `lg:grid-cols-2` around
  `<Chart>`); the 960px window min-width then guarantees a wide-enough plot area. In the
  **PDF**, render the Sankey on a wide internal canvas (`figureToPng(..., 820, 440)`) and
  let pdfmake scale it to the page — never render it narrow. Don't reintroduce side-by-side
  charts in `CrossDomainOverview`, `S10CohortTracking`, or `cohortReport.ts`.
- **Pre-load renders no chrome.** When `status !== "loaded"`, `App.tsx` shows a centred
  view with **no sidebar/top bar**; screens reachable before data loads (Import, About,
  Settings) need their own nav. A new screen = add to `ViewId`, the `ActiveView` switch,
  the pre-load branch, and `TopBar` `viewTitle`.
- **Import keeps raw file bytes in a provider ref, never in reducer state** (privacy +
  avoids serialising/bloating state); the reducer holds only metadata. The analysis is
  built once from the union of staged files.
- **Updater/diagnostics are Tauri-only** — gate on `isTauri()`; they render nothing in
  the browser. UI tests fabricate state via `src/test/renderWithApp.tsx`.
- **Verify cohort/analysis views with jsdom tests, not the browser.** Plotly is stubbed in
  tests, and the dev preview (`preview_start` → `naplan-cohort-tracker-dev`, Vite :5173)
  can't reach the analysis screens without manually picking files (the import file-picker
  isn't drivable headlessly). Render a component with a `fixtures.ts` store via `renderWithApp`.

## Build-minute budget (important)

GitHub Actions minutes are scarce — conserve them:
- **Local checks are free; use them as the gate** (`lint`/`typecheck`/`test`/`build` +
  `cargo check`/`clippy`) before anything is pushed.
- **Routine CI runs on Linux** (cheap). Still, batch commits and push once, not per tweak.
- **Tagging `vX.Y.Z` triggers the release build (macOS = 10× minute multiplier, Windows
  2×) — the biggest cost.** Tag only when a batch is ready and Dave has confirmed.
- `scripts/mirror-release.sh` runs locally (gh API) — no Actions minutes.

## Privacy invariants

- On-device, local-only. **No external network calls. No student data leaves the machine.**
- No student names in any chart, table, exported CSV, or generated PDF. Local student IDs only (`{PSI}*` fallback).
- ATSI / small subgroups suppressed at `n < 5`; the privacy note stays visible.
- The legacy **cloud-AI / pseudonymisation / de-identification** workflow is **NOT ported** — it stays internal in the legacy repo.

## Verification (definition of done)

1. **Numbers match the oracle.** Vitest suite green; Wilson CI, McNemar p, NAS%, paired counts, transition matrix match `verify_cohort.py` output for the same input within tolerance.
2. **Side-by-side parity.** Same Y7+Y9 dataset through the legacy Python app and NAPLAN Cohort Tracker → identical headline numbers across all 10 sections.
3. **Cross-platform launch.** Launches on Mac and Windows; point at a folder of SSSR files, all 10 sections render, both PDFs generate, the match-rate banner shows.
4. **No school-name hard-coding.** A fresh blank-settings install shows neutral branding; entering a different school name/number propagates everywhere.

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
- `release.yml` makes a **draft** release in this code repo (public since 2026-05-31,
  which is what makes Actions free — macOS/Windows builds no longer burn minutes). The
  in-app updater reads the **public** `naplan-cohort-tracker-releases` feed, so it sees nothing new
  until `scripts/mirror-release.sh vX.Y.Z` runs (mirrors assets + regenerates the
  Pages download page; runs locally via `gh`, no Actions minutes). After mirroring,
  `/releases/latest/download/latest.json` is CDN-cached and can lag a few minutes —
  verify with a cache-busted curl before assuming it failed. The teacher-facing
  **"What's new in {version}"** copy is hardcoded in THREE spots in
  `mirror-release.sh` (the HTML page, the README, and the release NOTES) — update all
  three per release. Before mirroring, dry-run the embedded Python page-generator with
  fake args (it's an f-string; a stray `{}` only fails at run time). Pages itself lags:
  verify the regenerated page via `raw.githubusercontent.com/<pub-repo>/main/index.html`
  (immediate), not the Pages URL.
- **Three version fields must match when releasing:** `src-tauri/tauri.conf.json`
  (authoritative — drives the bundle + auto-updater), `src-tauri/Cargo.toml`, and
  `package.json`. The `app_info` command reports `tauri.conf.json`'s version via
  `package_info()`. After editing the three, run `cd src-tauri && cargo check` to
  sync `Cargo.lock`'s `app` version too (the 4th place the version lives). Update
  `CHANGELOG.md` (repo root, canonical feature log) each release alongside the bump.
  **`scripts/check-release.mjs` guards all of this:** `npm run check:release` (or
  `node scripts/check-release.mjs vX.Y.Z` to also assert the tag matches and require
  the CHANGELOG entry) verifies the four fields agree before anything ships. It runs
  in CI on every push to `test`/`main`, and `mirror-release.sh` runs it as a preflight
  with the tag, so a drifted or un-changelogged release aborts before it reaches the
  public auto-update feed.

## Download-page first-run instructions — NON-NEGOTIABLE

The builds are **unsigned**, so on first launch macOS (Gatekeeper) and Windows
(SmartScreen) show a scary-looking security warning. Teachers read that as "the app
is broken" and give up — it is the #1 support issue. The teacher-facing download page
MUST therefore always carry **prominent, always-visible, version-independent** first-run
instructions that (a) state the warning is normal and does NOT mean the app is broken,
and (b) give exact click-through steps for current macOS and Windows.

- **Source of truth:** the HTML + README generated in `scripts/mirror-release.sh` — the
  "Staff — please read this first" primer (directly under the download buttons) and the
  "Opening it the first time" card. The wording lives in the script so it regenerates on
  every release and survives version bumps; never move it into a one-off release note.
- **macOS Sequoia (15+) removed the old right-click→Open shortcut for unsigned apps:**
  lead with **System Settings → Privacy & Security → Open Anyway**; keep right-click→Open
  only as the "older Macs" fallback. Also tell users to choose **Keep** if the browser
  flags the download as "not commonly downloaded".
- **Never remove, collapse, or bury these.** If the page is restyled, the first-run block
  stays prominent and above the fold. The real fix (signing/notarization) is out of scope,
  so until then clear instructions are the only lever.

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
