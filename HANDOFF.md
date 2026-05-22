# HANDOFF — Naplan Throughline (overnight build)

Morning handoff for Dave. What got done, what needs you, how to run it.

_Last updated: end of the autonomous overnight session._

## TL;DR

Phases 4–7 are built, committed and pushed to `origin/main`. The app runs in the
browser (`npm run dev`) and as a native macOS app (`npm run tauri build` → a
`.dmg`). 98 core tests pass; both typechecks and the web build are green. The
**real OneDrive data was smoke-tested through the analysis pipeline** (73 of 92
Year 9 students matched back to Year 7 — ~79%, matching the legacy ~80%).

The main thing I **could not** do headlessly is click through the *native* app's
GUI (file dialog → charts → PDF export). That's the one morning task — see
"Verify in the morning". Everything underneath it is individually validated.

## Where things stand

| Phase | Status |
|---|---|
| 0–3 (analysis core) | Complete, oracle-validated (pre-session). |
| 4 — Tauri + React shell | **Done.** Frontend, all 10 section views, Settings, match-rate banner, native folder picker, logging, updater wired. |
| 5 — PDF reports | **Done.** Overview (S1–9) + cohort (S10) PDFs via pdfmake + Plotly PNG. |
| 6 — Packaging + updater | **macOS done locally** (unsigned `.dmg`/`.app` + signed updater artifacts built). CI release workflow ready. Windows + releases-repo = NEEDS DAVE. |
| 7 — Polish | **Done.** User guide, README, error/empty/loading states. |

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

## NEEDS DAVE (prioritised — exact steps)

### 1. Add the updater signing key to GitHub secrets (HIGH — auto-update depends on it)
The keypair was generated locally. **Private key:**
`~/.naplan-throughline-updater.key` (no password). **Public key** is already
baked into `src-tauri/tauri.conf.json`.
- **Back up the private key in your password manager now.** If it's lost, v1
  installs can never auto-update.
- In the GitHub repo → Settings → Secrets and variables → Actions, add:
  - `TAURI_SIGNING_PRIVATE_KEY` = the full contents of `~/.naplan-throughline-updater.key`
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` = (empty)
  ```bash
  cat ~/.naplan-throughline-updater.key   # paste this as the secret value
  ```

### 2. Create the PUBLIC releases repo (HIGH — auto-update reads from it)
The app's baked-in update feed is
`https://github.com/mrdavearms/naplan-throughline-releases/releases/latest/download/latest.json`.
This source repo is private, and GitHub blocks unauthenticated downloads of
private-repo release assets, so updates must come from a **public** repo.
- Create `mrdavearms/naplan-throughline-releases` (public, empty), then in
  `.github/workflows/release.yml` set `owner: mrdavearms` + `repo:
  naplan-throughline-releases` on the tauri-action step and give it a PAT with
  write access to that repo.
- **Or** simply make this repo public (simplest, but exposes the source) and
  change the baked endpoint to this repo. If you change the repo name, update
  the endpoint in `tauri.conf.json`.

### 3. Windows build + WebView2 fixed runtime (MED — needs a Windows device)
- `tauri.conf.json` sets `webviewInstallMode: fixedRuntime`, which needs the
  runtime extracted to `src-tauri/Microsoft.WebView2.FixedVersionRuntime/`. Pin
  the exact version + URL in the commented "Fetch WebView2 fixed runtime" step
  in `release.yml` (Microsoft's Fixed Version runtime download).
- Run the release workflow (push a `v0.1.0` tag) and smoke-test the `.msi`/`.exe`
  on a real Windows machine. (I have no Windows device to test on.)

### 4. Code-signing / notarization (LOW — out of scope for v1)
Ship unsigned for v1 (the README documents the right-click→Open / "Run anyway"
steps). Revisit Windows Authenticode signing **before** any rollout to managed
Dept-of-Education Windows fleets — policy there can hard-block unsigned installers.

## Verify in the morning (5–10 min GUI smoke — not a blocker, just unverifiable headlessly)

The built app is at:
`src-tauri/target/release/bundle/dmg/Naplan Throughline_0.1.0_aarch64.dmg`
(also the `.app` in `…/bundle/macos/`). Or run `npm run tauri dev`.

1. Open the app → **Choose your NAPLAN folder** → pick the OneDrive folder that
   contains `Naplan 2024/2025/2026`. (Don't commit any of that data.)
2. Confirm the match-rate banner shows ~"73 of 92 (79%)" for 2026.
3. Click through all 10 sections — charts should render (this exercises the CSP +
   Plotly under the bundled webview, which I couldn't verify headlessly).
4. **Export overview PDF** (Overview screen) and **Export cohort PDF** (Section
   10) — confirm both save and look right. (PDF chart→PNG only runs in the GUI.)
5. Settings → **Export diagnostics** → confirm it writes a `.txt` with no student data.

If charts or PDFs misbehave under the CSP, the quickest fallback is to loosen
`app.security.csp` in `tauri.conf.json` (or temporarily set it to `null`) and
rebuild — but they're expected to work.

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
npm test           # vitest — 98 tests
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
