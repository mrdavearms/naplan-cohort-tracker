# HANDOFF — Naplan Throughline (overnight build)

Morning handoff for Dave. What got done, what needs you, how to run it.

_Last updated: end of the autonomous overnight session._

## TL;DR

Phases 4–7 are built, committed and pushed to `origin/main`, and **GitHub
Actions now builds the Mac + Windows installers** (release `v0.1.0`, a draft, has
them attached). **118 tests pass** (analysis core + UI + PDF rendering); both
typechecks and the web build are green; CI is green on macOS + Windows. The
**real OneDrive data was smoke-tested through the analysis pipeline** (73 of 92
Year 9 students matched back to Year 7 — ~79%, matching the legacy ~80%).

Automated tests now render **all 10 section views + Home + Settings + the
match-rate banner** against real synthetic data, and **both PDF reports** build
to actual PDF bytes — so the only thing left that needs eyes-on is a quick visual
pass of the packaged app (charts look right, PDF layout reads well). See
"Verify in the morning" (now low-risk).

## Where things stand

| Phase | Status |
|---|---|
| 0–3 (analysis core) | Complete, oracle-validated (pre-session). |
| 4 — Tauri + React shell | **Done.** Frontend, all 10 section views, Settings, match-rate banner, native folder picker, logging, updater wired. |
| 5 — PDF reports | **Done.** Overview (S1–9) + cohort (S10) PDFs via pdfmake + Plotly PNG. |
| 6 — Packaging + updater | **Done on CI.** `v0.1.0` draft release built by GitHub Actions has the macOS `.dmg` + Windows `.exe`/`.msi` (signed) + `latest.json`. Auto-update's public feed = your A/B choice (NEEDS DAVE #3). |
| 7 — Polish | **Done.** User guide, README, error/empty/loading states. |
| Testing | **118 tests** — analysis core (oracle-validated) + UI view rendering + PDF generation, green on macOS + Windows CI. |

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

## GitHub builds the apps — DONE

GitHub Actions now builds the installers for you (no local toolchain needed):

- **Workflow:** `.github/workflows/release.yml` — runs on a version tag or manual dispatch.
- **Triggered build `v0.1.0` succeeded:** macOS Apple Silicon `.dmg`, Windows
  `.exe` + `.msi` (both signed for the updater), the macOS Intel `.dmg`, and the
  `latest.json` updater manifest — all attached to a **draft Release** in this repo.
- **Updater signing secrets are set** in the repo (`TAURI_SIGNING_PRIVATE_KEY`,
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`). The private key lives at
  `~/.naplan-throughline-updater.key` on this Mac.

To cut a new build later: `git tag vX.Y.Z && git push origin vX.Y.Z` (bump
`version` in `src-tauri/tauri.conf.json` first), or run the **Release** workflow
from the Actions tab.

## NEEDS DAVE (prioritised — exact steps)

### 1. Back up the updater private key (HIGH — 2 min, do once)
If this key is ever lost, **no installed app can ever auto-update**. Copy it into
your password manager now:
```bash
cat ~/.naplan-throughline-updater.key
```
(It's already in GitHub as an encrypted Actions secret, but keep your own copy.)

### 2. Get the installers + publish the release (5 min)
The build produced a **draft** release so it doesn't go public until you're happy.
```bash
gh release view v0.1.0 --web        # open it in the browser to download/test
```
Download the macOS `.dmg` and (on a Windows PC) the `.exe`, install, and click
through the app. When happy:
```bash
gh release edit v0.1.0 --draft=false   # publish it
```
Opening the unsigned apps the first time: macOS → right-click → **Open**;
Windows → **More info → Run anyway**.

### 3. Enable auto-update — ONE choice (HIGH for updates; not needed just to use the app)
The app checks a **public** feed for updates. Right now the release is in this
**private** repo, so the updater can't read it. Pick one:

- **Option A (simplest): make this repo public.** Then change the endpoint in
  `src-tauri/tauri.conf.json` `plugins.updater.endpoints` to this repo
  (`…/mrdavearms/naplan-throughline/releases/latest/download/latest.json`),
  commit, and re-tag. No second repo, no PAT.
- **Option B (keep source private): a separate public releases repo.** Create
  `mrdavearms/naplan-throughline-releases` (public), create a fine-grained PAT
  with **Contents: read+write** on that repo, add it as the `RELEASES_TOKEN`
  secret, and tell me — I'll wire the workflow to upload the installers +
  `latest.json` there. The endpoint baked into the app already points at this
  repo name.

Until one of these is done, auto-update will report "could not check for updates"
(harmless); manual download/install works regardless.

### 4. (Optional, later) Windows offline robustness + code-signing
- Windows currently uses `downloadBootstrapper` (fetches WebView2 at install if
  missing). For fully-offline/locked-down fleets, switch back to `fixedRuntime`
  and bundle the WebView2 Fixed Version runtime in CI. (Deviation noted in DECISIONS.md.)
- Code-signing / notarization stays OUT of scope for v1 (unsigned click-through).
  Revisit Windows Authenticode **before** any rollout to managed Dept-of-Education
  Windows fleets — policy there can hard-block unsigned installers.

## Verify in the morning (5 min visual pass — low-risk now)

Automated tests already cover that every view renders and both PDFs generate;
this is just an eyes-on confirmation in the packaged app. Download from the
`v0.1.0` draft release (`gh release view v0.1.0 --web`), or run `npm run tauri dev`,
or use the local build at
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
