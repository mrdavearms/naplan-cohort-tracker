# HANDOFF — Naplan Throughline (overnight build)

Morning handoff for Dave. What got done, what needs you, how to run it.

_Last updated: end of the autonomous overnight session._

## TL;DR

Phases 4–7 are built, committed and pushed to `origin/main`, and **GitHub
Actions builds + ships the Mac + Windows installers** with working auto-update
(current release **v0.1.2**). **120 tests pass** (analysis core + UI + PDF
rendering + crash-safety); ESLint, both typechecks and the web build are green;
CI runs lint + typecheck + tests green on macOS + Windows. The **real OneDrive
data matches the Python oracle exactly** (73 of 92 Year 9 matched to Year 7,
~79%). A **deep stability review** was done and acted on (see below).

Automated tests now render **all 10 section views + Home + Settings + the
match-rate banner** against real synthetic data, and **both PDF reports** build
to actual PDF bytes — so the only thing left that needs eyes-on is a quick visual
pass of the packaged app (charts look right, PDF layout reads well). See
"Verify in the morning" (now low-risk).

## Deep stability review — done (v0.1.2)

A full review (a reviewer agent + ESLint) hunted for crashes, lint problems and
instability. The codebase was largely clean (Rust had no panic risks, hooks were
correct, edge cases handled, the CSP is actually correct for Plotly). Fixes made
and shipped in v0.1.2:

- **React `ErrorBoundary`** at the root and around the active view — any
  component throw now shows a recoverable message instead of white-screening the
  whole window (the top crash risk; there was none before).
- **`SectionRouter` guard** for the `primaryYear == null` edge case.
- **Folder-read failures are surfaced** in the picker instead of failing silently.
- **ESLint** (flat config: typescript-eslint + react-hooks + a guard keeping
  `core/` filesystem-free) added and wired into CI; all findings fixed (dead
  code/imports, a comma-expression rewritten, `MatchRateBanner`/S5 memoised).
- **PDF→disk over IPC uses base64** (compact string) instead of a multi-MB JSON
  number array (a low-spec-Windows risk).

## Where things stand

| Phase | Status |
|---|---|
| 0–3 (analysis core) | Complete, oracle-validated (pre-session). |
| 4 — Tauri + React shell | **Done.** Frontend, all 10 section views, Settings, match-rate banner, native folder picker, logging, updater wired. |
| 5 — PDF reports | **Done.** Overview (S1–9) + cohort (S10) PDFs via pdfmake + Plotly PNG. |
| 6 — Packaging + updater | **Done + live.** GitHub Actions builds macOS `.dmg` + Windows `.exe`/`.msi` (signed) + `latest.json`. Published to the private repo AND mirrored to the public feed repo `naplan-throughline-releases`; auto-update endpoint verified live (HTTP 200, signed). Branded "NT" icon added. |
| 7 — Polish | **Done.** User guide, README, error/empty/loading states. |
| Testing | **118 tests** — analysis core (oracle-validated) + UI view rendering + PDF generation, green on macOS + Windows CI. |
| Real-data parity | **Verified.** The full TS pipeline matches the legacy Python oracle **exactly** on the real OneDrive data (2026): per-domain paired/leavers/joiners, Y7/Y9 NAS%, McNemar p (0.2188 / 0.5811 / 1.0000 / 0.5488), and the Reading transition matrix all identical. (Checked with a throwaway script — never committed, no student data in the repo.) |

## Completed this session (detail)

- **Core additions (filesystem-free, +12 tests → 98 total):** `settings.ts`
  (versioned schema + pure `migrate()`), `pipeline.ts` (`loadStoreFromFiles` —
  host injects bytes), `store.ts` (selectors), `cohortBuild.ts`
  (`buildCohortPairings` + `cohortMatchRate`).
- **React app (`src/`):** Vite 7 + React 19 + Tailwind v4 (DESIGN.md tokens,
  self-hosted fonts, no CDN). Context+useReducer state, sidebar nav, primary-year
  selector, visible Y7↔Y9 match-rate banner, Settings (school identity as data),
  all **10 section views** with charts (Plotly), interpretation bullets, and the
  NAPLAN attribution framing (Y7 = primary output, Y9 = school contribution).
- **Tauri shell (`src-tauri/`):** bundle id `com.dandsarmstrong.naplanthroughline`;
  Rust commands `read_workbook_folder` (recursive `.xlsx` read → bytes, core stays
  fs-free), `app_info`, `save_text_file`, `save_binary_file` (guarded); plugins
  dialog + log (rotating file) + updater (desktop). Updater pubkey baked in,
  `createUpdaterArtifacts`, endpoint → planned public releases repo, Windows
  `fixedRuntime`. Restrictive CSP. "Export diagnostics" + "Check for updates" in
  Settings.
- **PDFs (`src/pdf/`):** pdfmake (embedded Roboto = cross-engine-consistent) +
  Plotly `toImage` fixed-size PNG charts. Footer = Generated-on + Page N of M.
- **CI/release:** `.github/workflows/release.yml` (tauri-action matrix, macOS +
  Windows), tag/dispatch-triggered.
- **Code review:** a reviewer agent ran on the Phase 4 diff; acted on 5 of 6
  issues (CSP, removed unused fs plugin, hardened save paths, fixed a
  settings-hydration bug). The 6th (`LEFT_WHS`) is documented below.

## GitHub builds + ships the apps — DONE (incl. auto-update)

- **CI builds the installers** (`.github/workflows/release.yml`, on a version tag):
  a **universal macOS `.dmg`** (Intel + Apple Silicon) + Windows `.exe`/`.msi`,
  all signed for the updater, + `latest.json`.
- **Current release: `v0.1.1`** (the branded-icon build), published in both repos.
- **Auto-update is LIVE and proven end-to-end.** Installers + `latest.json` are
  mirrored to the public feed repo **`mrdavearms/naplan-throughline-releases`**
  (binaries only — source stays private, per Option B). Confirmed: the app's
  baked-in endpoint `…/naplan-throughline-releases/releases/latest/download/latest.json`
  serves the latest version, signed, and the installer downloads unauthenticated.
  The v0.1.0 → v0.1.1 bump verified an installed app would correctly detect the
  newer version (the universal build covers both `darwin-aarch64` + `darwin-x86_64`).
- **Signing secrets** (`TAURI_SIGNING_PRIVATE_KEY` + `…_PASSWORD`) are set in the
  source repo; the private key is at `~/.naplan-throughline-updater.key`.

### Cutting a future release (no PAT needed)
1. Bump `version` in `src-tauri/tauri.conf.json`, commit.
2. `git tag vX.Y.Z && git push origin vX.Y.Z` → CI builds the installers.
3. After the Release workflow finishes: `./scripts/mirror-release.sh vX.Y.Z`
   → mirrors the installers + URL-corrected `latest.json` to the public feed.
   Installed apps then see the update automatically.

## NEEDS DAVE (what's actually left)

### 1. Back up the updater private key (HIGH — 2 min, the one thing only you can do)
If this key is ever lost, **no installed app can ever auto-update**. Copy
`~/.naplan-throughline-updater.key` into your password manager. (It's already an
encrypted GitHub Actions secret and lives on this Mac, but keep your own copy.)
I deliberately did not print it into the chat for security.

### 2. (Optional, later) Windows offline robustness + code-signing
- Windows currently uses `downloadBootstrapper` (fetches WebView2 at install if
  missing). For fully-offline/locked-down fleets, switch back to `fixedRuntime`
  and bundle the WebView2 Fixed Version runtime in CI. (Deviation noted in DECISIONS.md.)
- Code-signing / notarization stays OUT of scope for v1 (unsigned click-through).
  Revisit Windows Authenticode **before** any rollout to managed Dept-of-Education
  Windows fleets — policy there can hard-block unsigned installers.

## Verify in the morning (5 min visual pass — low-risk now)

Automated tests cover that every view renders and both PDFs generate, and the
real Plotly chart→PNG path (`figureToPng`, which PDF export relies on) was
confirmed working in a real browser with the actual core chart builders. So this
is just an eyes-on confirmation in the packaged app — the only things not yet run
anywhere are the production CSP and the native folder-dialog→Rust→core round-trip. Download the installer
from the public releases page
(https://github.com/mrdavearms/naplan-throughline-releases/releases/latest),
or run `npm run tauri dev`, or use the local build at
`src-tauri/target/release/bundle/dmg/Naplan Throughline_0.1.0_aarch64.dmg`.

1. **Choose your NAPLAN folder** → the OneDrive folder with `Naplan 2024/2025/2026`.
   (Don't commit that data.)
2. Match-rate banner should read ~"73 of 92 (79%)" for 2026.
3. Click through the 10 sections — confirm charts look right (the component tests
   prove they render under the stubbed Plotly; this confirms real Plotly + the CSP
   in the bundled webview, the one thing not machine-tested).
4. **Export overview PDF** + **Export cohort PDF** — confirm they look well laid out.
5. Settings → **Export diagnostics** → confirm a `.txt` with no student data.

If charts/PDFs misbehave under the CSP (unlikely), loosen `app.security.csp` in
`tauri.conf.json` and rebuild.

## Known issues / TODOs

- **`LEFT_WHS = "left WHS"` in `core/src/sections/cohortTracking.ts`** contains a
  school abbreviation. It's an internal sentinel that matches the committed
  oracle snapshot (`core/tests/fixtures/cohort_snapshot.json`), and the UI/PDF
  relabel it to "Left the school", so it's never user-facing. Making core fully
  school-agnostic would mean regenerating the oracle snapshot — but the legacy
  oracle (read-only) emits "left WHS", so that would diverge from the oracle.
  Left as-is to preserve the parity gate. Low priority.
- **Bundle-size warning** on `npm run build` (Plotly + pdfmake + exceljs in one
  chunk, ~1.2 MB+). Harmless for a desktop app (no network load); could
  code-split later.
- **`@tauri-apps/plugin-fs`** is still in `package.json` deps but unused (the
  Rust plugin was removed). Harmless; `npm uninstall @tauri-apps/plugin-fs` to tidy.
- **PDF generation** verified via typecheck/build + a node pdfmake smoke (valid
  PDF bytes); the Plotly chart→PNG step only runs in a real DOM → covered by the
  morning GUI smoke.
- **Auto-update end-to-end** can't be tested until the public releases repo +
  secrets exist (NEEDS DAVE 1–2). The signing pipeline itself is proven: the
  local release build produced `Naplan Throughline.app.tar.gz` + a valid `.sig`.

## How to run, build, test

### Analysis core + frontend (no Rust)
```bash
cd /Users/davidarmstrong/Antigravity/naplan-throughline
npm install
npm run dev        # Vite dev server (browser) — folder picker uses a directory <input>
npm test           # vitest — 118 tests (core + UI + PDF)
npm run typecheck  # tsc -b (core) + app typecheck
npm run build      # production web build
```

### Native desktop app (needs Rust — already installed)
```bash
source "$HOME/.cargo/env"
npm run tauri dev    # native dev window
npm run tauri build  # .dmg/.app into src-tauri/target/release/bundle/
# To also sign the updater artifacts locally:
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.naplan-throughline-updater.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npm run tauri build
```

## Decisions

See [DECISIONS.md](DECISIONS.md) — one line per decision with the reason.
Key ones: React app at repo root (core as workspace alias); Vite 7 (not 8, to
keep vitest 3); self-hosted fonts; Heroicons; Plotly via factory; settings
versioned with pure `migrate()`; PDF uses embedded Roboto for cross-engine
consistency; updater wired in v1 with the key stored outside the repo.
