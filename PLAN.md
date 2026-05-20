# Naplan Throughline — implementation roadmap

## Context

Rewrite the WHS-internal Python/Streamlit NAPLAN app (`/Users/davidarmstrong/Antigravity/naplan_analysis_app/`) as a distributable, multi-school, **on-device** desktop app for Mac + Windows. The existing repo is **left untouched** and serves two roles: the **specification** (its analytical logic is exact) and the **validation oracle** (`verification/verify_cohort.py` produces reference numbers we test the port against).

Why a rewrite rather than packaging Streamlit: a TypeScript/Tauri stack matches Dave's existing React skill set, produces real native installers with auto-update, and — because charts move to Plotly.js (which renders/exports images in the webview) — eliminates the kaleido/Chromium bundling problem that made packaging the Python app fragile.

### Decisions locked
- **Name:** Naplan Throughline
- **Shell:** Tauri (small installers, built-in updater hooks)
- **v1 scope:** all 10 sections + both PDF reports
- **License:** proprietary for now → **private repo**
- **Signing:** ship **unsigned** for v1 (users click past Gatekeeper / SmartScreen; revisit before wide release)
- **Privacy model:** on-device, local-only; user supplies a folder containing Y7 and Y9 cohort SSSR files. Cloud-AI / pseudonymisation workflow is **not** ported.

### Assumed setup (correct me on plan review if wrong)
- Repo: `github.com/mrdavearms/naplan-throughline` (private), account `dave@dandsarmstrong.com`
- Local path: `/Users/davidarmstrong/Antigravity/naplan-throughline`
- Tauri bundle identifier: `com.dandsarmstrong.naplanthroughline`

## Architecture — the keystone decisions (expensive to change later)

1. **Three layers, strictly separated:**
   - `core/` — pure TypeScript analysis library. No React, no Tauri, no DOM. This is the crown jewel and must be independently unit-testable. Decoupling it means a web build, CLI, or different shell could reuse it later.
   - `ui/` — React 19 + Vite + Tailwind + shadcn/ui (same stack as Dave's other apps). Consumes `core/`.
   - Tauri shell — native window, native folder/file dialogs, packaging, updater.
2. **School identity is data, never code.** Name, school number, AIP/KIS references live in app settings (an in-app Settings screen writing to local app-data), so there is zero "Wangaratta High School" hard-coding. This is the multi-school enabler.
3. **A visible Y7↔Y9 ID match-rate check** surfaced in the UI ("matched 71 of 95 students") so the most common "looks broken" case (Local Student IDs that don't reconcile across years) is self-diagnosing, not silent.

## Stack / library choices

| Concern | Choice | Notes |
|---|---|---|
| Shell | Tauri 2 | native installers, updater hooks |
| UI | React 19 + Vite + TS | matches existing apps |
| Styling | Tailwind + shadcn/ui | matches existing apps |
| Charts | **Plotly.js** | preserves exact Sankey / heatmap / stacked-bar designs; exports PNG/SVG in-webview (no kaleido) |
| Excel read | SheetJS (`xlsx`) | reads SSSR `.xlsx` |
| Data wrangling | plain TS or `arquero` | data is small (hundreds of rows) — no pandas needed |
| Stats | hand-ported + unit-tested | Wilson CI (closed form), McNemar (binomial on 2×2 discordant) |
| PDF | Plotly.js `toImage` + `pdf-lib`/`pdfmake` | assemble in JS; no native dependency |
| Tests | Vitest | validated against Python oracle |

## Data model to port (already documented in the old repo's README)

- **Store key:** `(yearOfTest, yearLevel, domain)` → one loaded entry.
- **Types:** `LoadedFile`, `PairedCohort` (paired / leavers / joiners), `McNemarResult`, `YearFolder`.
- **Constants:** `PROFICIENCY_LEVELS = ["Needs additional support","Developing","Strong","Exceeding"]` (order matters — drives the transition matrix), `VALID_DOMAINS`, `VALID_YEAR_LEVELS = {7,9}`.
- **Column aliases:** the 2025↔2026 casing normalisation (`Local Student ID`→`Local student ID`, etc.).
- **Keying rule (critical):** join cross-year on **Local student ID**, with `{PSI}*` fallback. Never on VCAA PSI alone.

## Phased build

**Phase 0 — Repo + scaffold**
- Create private repo + Tauri/React/Vite/TS scaffold + Tailwind/shadcn. Folder layout `core/`, `src/` (ui), `src-tauri/`.
- Bring `CLAUDE.md` across (adapted for the TS stack — keep the data-format quirks, attribution framing, keying rule). Optionally drop the Python `naplan/` into `reference/` to delete once the port is validated.

**Phase 1 — Analysis core + oracle validation** (highest risk, do first)
- Port loader (discovery/parse/alias/keying), `buildPairedCohort`, `wilsonCi`, `mcnemarPaired`, `transitionMatrix`.
- Generate reference numbers from the Python `verify_cohort.py`; snapshot; assert the TS port matches within tolerance. Port the cases from `tests/test_cohort.py` and `tests/test_loader.py`.

**Phase 2 — Section logic (all 10)**
- Port the per-section computations (Sections 1–9) and the Section 10 drill-downs (attrition, equity sub-cohorts, transition, Wilson, reading subdomains, class groups) and the rules-based Section 9 narrative.

**Phase 3 — Charts (Plotly.js)**
- Reproduce Sankey, direction-coloured heatmap, stacked bars, Wilson CI dot plots. Carry over the layout fixes from this session (plain-black Sankey labels via annotations; title/margin spacing).

**Phase 4 — UI shell**
- React sidebar nav (Sections 1–10 + Settings), primary-year selector, native folder picker (Tauri dialog) + drag-drop, the ID match-rate banner, Settings screen for school identity.

**Phase 5 — PDF reports**
- Port both reports (cohort deep-dive + Sections 1–9 overview) using Plotly `toImage` + `pdf-lib`/`pdfmake`. Carry over the footer (Generated-on + Page N of M) and the table-wrapping/heading-spacing fixes from this session. AU-English check optional.

**Phase 6 — Tauri packaging (unsigned)**
- Build `.dmg`/`.app` (Mac) and `.msi`/`.exe` (Windows). Requires a Windows machine / VM / CI runner for the Windows build + smoke test. Document the unsigned-app open steps for users.

**Phase 7 — Polish**
- One-page user guide ("put Y7 + Y9 SSSR files in a folder, open app, point at folder"), error states, GitHub Releases for distribution.

## Critical files in the OLD repo to port from

- `naplan/loader.py` — discovery, parsing, column aliases, keying rule, `buildPairedCohort` inputs
- `naplan/cohort.py` — `build_paired_cohort`, `wilson_ci`, `mcnemar_paired`, `transition_matrix`, `PROFICIENCY_LEVELS`
- `naplan/cohort_charts.py` — Sankey + heatmap specs (incl. this session's label/spacing fixes)
- `naplan/cohort_interpret.py` — interpretation-bullet generators
- `naplan/sections/s1_*.py … s10_*.py` — per-section logic
- `naplan/narrative.py` — Section 9 rules-based templates
- `scripts/generate_cohort_report.py`, `naplan/overview_builder.py` — PDF layout + the footer/table fixes
- `verification/verify_cohort.py` — **the validation oracle**
- `tests/` + `tests/fixtures/` — synthetic data + known-good numbers to port

## Verification (definition of done)

1. **Numbers match the oracle.** Vitest suite green; ported stats (Wilson CI, McNemar p, NAS%, paired counts, transition matrix) match `verify_cohort.py` output for the same input within tolerance.
2. **Side-by-side parity.** Run the same Y7+Y9 dataset through the old Python app and Naplan Throughline → identical headline numbers across all 10 sections.
3. **Cross-platform launch.** App launches on Mac and Windows, user points it at a folder of SSSR files, all 10 sections render, both PDFs generate, ID match-rate banner shows.
4. **No WHS hard-coding.** Fresh install with blank settings shows neutral branding; entering a different school name/number propagates everywhere.

## Out of scope for v1
- Code-signing / notarization (ship unsigned)
- Auto-update server (Tauri updater wired later)
- Cloud-AI / pseudonymisation workflow (stays WHS-internal in the old repo)
- Mac App Store / Microsoft Store submission
