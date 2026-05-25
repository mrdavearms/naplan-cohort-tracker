# IMPORT-SPEC.md — Multi-source file import (stage → confirm → load → edit)

Status: **reviewed — ready to implement** · Branch: `test` · Author: Claude (with Dave) · Date: 2026-05-25

> Revised 2026-05-25 after a senior-engineer review (verdict: proceed with changes).
> Review-driven changes are marked **[R]** below. Two decisions were locked by the
> review: the import screen is its own **view** (not a boolean overlay), so the
> sidebar/top bar survive when you go back to edit; and raw file **bytes live
> outside the reducer** (a ref), so only harmless metadata sits in shared state.

This spec describes a single feature: letting the user assemble a NAPLAN analysis
from files in **more than one location**, with the ability to **confirm the year
each file was sat** and to **go back and fix mistakes** before and after loading.
It is written against the current code (file references are exact) so a reviewer
can check it for breakage, knock-on effects, and worthwhile additions.

---

## 1. Problem

Principals usually analyse **two years' worth** of SSSR files (e.g. a Year 7 cohort
in 2024 and the same cohort's Year 9 results in 2026 — the headline Section 10
"throughline"). Those files commonly live in **two different folders / locations**
(e.g. separate `Naplan 2024` and `Naplan 2026` folders in OneDrive).

Today the app can only point at **one** folder, and picking a second folder
**replaces** the first. So two locations cannot be combined, and a wrong pick has
no graceful recovery.

## 2. Decisions locked (from Dave, 2026-05-25)

1. **Initial-setup only.** Combining locations happens before the analysis is built.
   No incremental "merge into a live analysis" — but the user can return to the
   import screen, edit the set, and rebuild.
2. **Folders *or* individual files.** Point at a whole folder, or pick loose `.xlsx`
   files.
3. **Year of test is user-assignable** when it cannot be auto-detected. Choices are
   constrained to 2024 / 2025 / 2026 / 2027.
4. **Year level and domain are auto-read from the file content** (they live in the
   spreadsheet columns) and shown back for confirmation — *not* hand-typed in v1.
   Rationale in §6. A manual year-level fallback is explicitly out of scope for v1
   (see §11) unless review or real data shows it is needed.
5. **Mistakes are recoverable** both before Load (remove/clear staged rows, with a
   red "not recognised" status shown on add) and after Load ("Edit imported files"
   reopens the staging screen with the list intact, so the user fixes and reloads).
6. **Throughline-readiness warning [R, v1].** The staging screen warns up front when
   the staged set won't support a Year 7 → Year 9 cohort comparison (e.g. only one
   year of test staged), so the most common "why is Section 10 empty?" case is caught
   before Load rather than after. (Confirmed with Dave, 2026-05-25.)

### Architecture decisions locked by the review [R]
- **Import is its own view, not a boolean flag.** Add `"import"` to `ViewId` rather
  than an `importOpen` boolean. `openImport()` is `setView("import")`. This keeps the
  existing `activeView` switch pattern (App/Sidebar/TopBar) and — critically — does
  **not** re-enter `App.tsx`'s pre-load branch (which hides the sidebar/top bar). The
  loaded shell stays; only the main content area shows the import panel.
- **Raw bytes live outside the reducer.** Keep file `bytes` in a module-level / ref
  `Map` keyed by staged-file id; the reducer's `staged` holds only metadata
  (`name`, `relativePath`, `detectedYear`, `assignedYear`, `inspection`). This avoids
  bloating reducer state and removes the risk of bytes being serialised into a
  diagnostics export.

## 3. Current behaviour (grounded)

- **Empty state:** `src/views/HomeView.tsx` renders `Hero` + `<FolderPicker />`
  (`src/components/FolderPicker.tsx`). `src/App.tsx` shows this centred, with no
  sidebar/topbar, whenever `state.status !== "loaded"`.
- **Pick:** `FolderPicker.handlePick()` → desktop: `loadFolderViaTauri()`
  (`src/lib/tauriFs.ts`) opens a single-folder native dialog and calls the Rust
  command `read_workbook_folder` (`src-tauri/src/lib.rs`), which recursively reads
  every `.xlsx` under the folder and returns `{ name, relativePath, bytes }[]`.
  Browser dev: a `webkitdirectory` `<input>` → `filesFromFileList()`
  (`src/lib/dataSource.ts`).
- **Load:** both paths call `loadFiles(files, label)` (`src/state/AppState.tsx`),
  which calls `loadStoreFromFiles(files)` (`core/src/pipeline.ts`). The pipeline
  resolves each file's **year of test** from its path (`resolveYearOfTest` — a
  `Naplan YYYY` segment, else a year in the file name), parses it, and `buildStore`
  (`core/src/loader.ts`) assembles a `Map` keyed by
  `` `${yearOfTest}|${yearLevel}|${domain}` `` (`storeKey`).
- **Reducer:** the `loadSuccess` case sets `store: action.store` — a **full
  replace**. This is the reason a second folder wipes the first.
- **Loaded state:** `HomeView` shows the overview (match-rate banner, "Loaded
  datasets" pills `YYYY · Y{level} · {domain} (participants/total)`, and a "files
  not loaded" card built from `skipped` + `unresolved`). `TopBar`
  (`src/components/TopBar.tsx`) shows a compact `<FolderPicker compact />`
  ("Change folder") that currently replaces the analysis.

### Facts the keying depends on (do not regress)
- **Store key** is `(yearOfTest, yearLevel, domain)`; literal `2026|7|Reading`.
- **Year level** is read from the sheet (`Year level` / `Year Level`, aliased in
  `loader.ts`) and validated to 7 or 9 by `detectDomainAndYear`.
- **Domain** is read from the sheet and validated against `VALID_DOMAINS`.
- **2025 split-file format** pairs a Student-Reports-only workbook with a
  Student-Results-only workbook **by `(yearOfTest, yearLevel, domain)`** inside
  `buildStore`. Both halves must be present for an entry to register.
- **Cross-year cohort join** keys on `Local student ID` (with a `{PSI}*` fallback),
  never the per-administration `Student ID`. (Unchanged by this feature, but the
  reason two *different* years of test must coexist in one store.)

## 4. Proposed design

### 4.1 Staging model — accumulate raw files, build once

The import screen holds a **list of sources**. A source is one "Add" action:

```
StagedSource = {
  id: string;            // local uuid
  kind: "folder" | "files";
  label: string;         // folder name, or "3 files"
  files: StagedFile[];
}
StagedFile = {
  id: string;            // local uuid — also the key into the bytes ref Map
  name: string;
  relativePath: string;  // folder name prefix (folder) or bare name (loose)
  detectedYear: number | null;   // resolveYearOfTest(relativePath, name)
  assignedYear: number | null;   // user override, when detectedYear is null
  inspection: WorkbookInspection;// see §4.3
}
```

**[R] Bytes are NOT on `StagedFile`.** They live in a separate `Map<string,
ArrayBuffer | Uint8Array>` keyed by `StagedFile.id`, held in a ref (not reducer
state) — see §4.5. The `ArrayBuffer | Uint8Array` union matches `RawWorkbookFile`
and what `filesFromFileList` returns today (`ArrayBuffer`); `parseWorkbook` already
normalises either to a `Uint8Array` internally (the exceljs trap), so both the
WebView inspect path and the Load path are safe.

The user adds one or more sources, confirms a year where needed, then presses
**Load**. Load flattens **all valid staged files** into one array and makes a
**single** `loadStoreFromFiles(...)` call.

**Why build once from the union (not merge two built stores):** the 2025 split-file
pairing happens *inside* `buildStore` by `(yearOfTest, yearLevel, domain)`. The two
halves of a pair can legitimately come from different sources. Building once from
the union pairs them correctly; merging two already-built stores would not. This
also keeps a single, already-tested code path (`loadStoreFromFiles`).

### 4.2 Year of test — per file, auto-detected, manual where missing

- Each staged file gets `detectedYear = resolveYearOfTest(relativePath, name)`
  (already exported from `core/`). Folder picks under a `Naplan YYYY` folder resolve
  automatically; loose files usually do not.
- The **effective year** is `assignedYear ?? detectedYear`. A file with neither is
  **blocking**: Load is disabled until every staged, recognised file has a year.
- UI convenience: a loose-file batch with no detectable year exposes **one** year
  dropdown that applies to the whole batch (so the user does not set a year per
  file). A folder whose files resolve to different years (e.g. it contains
  `Naplan 2024/` and `Naplan 2026/` subfolders) keeps each file's own detected year —
  the dropdown is only shown for files that need one. **Year assignment is therefore
  per file, with a per-batch shortcut**, never a single forced year for a whole
  mixed folder.

### 4.3 Inspect-on-add — instant "recognised / not recognised"

When files are added, each is inspected immediately so wrong files are visible
before Load. A new pure-core helper:

```
inspectWorkbook(file): Promise<WorkbookInspection>
WorkbookInspection =
  | { status: "ok"; yearLevel: 7 | 9; domain: string; sheets: "full" | "reports" | "results" }
  | { status: "rejected"; reason: string }   // plain English
```

It reuses the existing `parseWorkbook` + sheet detection + `detectDomainAndYear`
from `loader.ts` — **no second analysis code path**. Rejection reasons map to the
existing failure modes (no Student Reports/Results sheet; missing required columns;
not a single domain/year; unexpected domain/year level; unreadable file).

**[R] `inspectWorkbook` must live in `core/src/loader.ts`.** It needs the
module-private sheet-name constants `SHEET_REPORTS` / `SHEET_RESULTS` (loader.ts) to
classify `full` / `reports` / `results`. Putting it in `loader.ts` (exported via the
existing `export * from "./loader"` barrel) avoids exporting those constants just for
a new file. A 2026 four-sheet workbook classifies as `"full"` (both used sheets
present); the two unused sheets are ignored, as today.

Row status shown to the user:
- **Recognised (green):** `2024 · Year 7 · Reading` (+ "reports only" / "results
  only" hint for 2025 split halves, so a lone half is understandable).
- **Not recognised (red):** the plain reason, with a **×** to remove.
- **Needs a year (amber):** recognised but no detected year → show the dropdown.
- **Duplicate (grey):** same `relativePath` already staged → not added again.

Inspection parses small files a handful at a time; Load re-runs the full pipeline.
The double parse is acceptable and keeps one code path. (See §11 for the optional
optimisation of threading parsed workbooks through to avoid the second parse.)

### 4.4 Go back / edit

- **Before Load:** every row has **×**; a **Clear all** resets the list.
- **After Load:** an **"Edit imported files"** button on the overview (and on the
  "files not loaded" card) reopens the staging screen with the list intact. The
  user removes the offending file, adds the right one, and presses Load again,
  which rebuilds from the current staged set. Sources that were already correct are
  preserved.
- Clearing the staged list does **not** wipe an already-loaded analysis; the loaded
  analysis is only replaced when a new Load **succeeds**.

### 4.5 State location

The staged list must survive navigating away from Home and back, so it moves from
component-local state into the shared reducer in `src/state/AppState.tsx`. **[R]** Per
the review, model "import is showing" as a **view**, not a boolean, and keep bytes out
of the reducer:

- **New `ViewId` value:** `"import"`. `openImport()` ≡ `setView("import")`. No
  `importOpen` boolean.
- **New state:** `staged: StagedSource[]` (metadata only — **no bytes**).
- **Bytes:** a `Map<string, ArrayBuffer | Uint8Array>` keyed by `StagedFile.id`, held
  in a **ref** inside the provider (not in `state`, never dispatched). Cleared when a
  staged file is removed / the list is cleared.
- **New actions:** `stageAdd(source, bytesById)`, `stageRemove(id)`,
  `stageSetBatchYear(sourceId, year)`, `stageClear()`. `setView("import")` /
  `setView("home")` cover open/close.
- **Load:** keep `loadFiles(files, label)` as the single build entry point. The
  import panel computes the flattened, deduped, year-stamped, valid `RawWorkbookFile[]`
  (pulling bytes from the ref Map) and calls it. On success the reducer **keeps
  `staged`** (for go-back) and the existing flow sets `activeView` to the overview.
  `loadStart`/`loadSuccess`/`loadError` are otherwise unchanged.
- **`sourceLabel` [R]:** with several sources there is no single folder. The import
  panel passes a **composite label** to `loadFiles` — `"N folders"` /
  `"N files"` / the single label when there's one source — which `TopBar` shows as
  before.
- **Show rule [R]:** add `case "import"` to `App.tsx`'s `ActiveView` switch rendering
  `<ImportStaging />`. **Do not** add `importOpen` to the outer
  `status !== "loaded"` branch — that branch hides the sidebar/top bar, so reusing it
  post-load would wrongly strip the chrome. Pre-load, `activeView` starts at
  `"import"` (was `"home"`) so the on-ramp shows the panel.

### 4.6 Year of test injected into the pipeline (core change)

`RawWorkbookFile` (`core/src/pipeline.ts`) gains an optional field; the pipeline
honours it:

```
interface RawWorkbookFile { name; relativePath; bytes; yearOfTest?: number }
// in loadStoreFromFiles:
const yearOfTest = f.yearOfTest ?? resolveYearOfTest(f.relativePath, f.name);
```

~3 lines + a unit test. No other core change. `buildStore`, `detectDomainAndYear`,
keying, and stats are untouched.

### 4.7 Host glue (desktop + browser)

- **Rust:** add `read_workbook_files(paths: Vec<String>) -> Result<Vec<RawFile>>`
  mirroring `read_workbook_folder`'s read logic, with `relative_path = file name`
  (no folder → year is assigned by the user). Register it in the `invoke_handler`.
  Folder command stays. Permissions: `dialog:default` is already granted; file
  reads stay inside app-defined Rust commands (no broad `fs` scope), consistent with
  the capability file's stated model.
- **`src/lib/tauriFs.ts`:** add `loadFilesViaTauri()` → `open({ multiple: true,
  filters: [{ name: "Excel", extensions: ["xlsx"] }] })` → `invoke("read_workbook_files",
  { paths })` → `RawWorkbookFile[]`.
- **`src/lib/dataSource.ts`:** add a browser loose-file path (a non-directory
  `<input multiple>` reuses the existing `filesFromFileList`, which already maps a
  `File[]`; loose files get `relativePath = name`).

### 4.8 UI

- **New `src/components/ImportStaging.tsx`** — the panel: **Add folder** and **Add
  files** buttons; the staged-source list with per-row status, year dropdown where
  needed, **×**, and **Clear all**; a primary **Load N spreadsheets** button
  (disabled until ≥1 recognised file and every recognised file has a year); the
  privacy note and error display (moved from `Hero`).
- **`src/views/HomeView.tsx`** — render `<ImportStaging />` instead of
  `<FolderPicker />` in the empty/`importOpen` state; add the **"Edit imported
  files"** button to the loaded overview and the "not loaded" card.
- **`src/components/TopBar.tsx`** — the compact "Change folder" becomes **"Edit /
  re-import"** that calls `setView("import")` (reuses staged list) rather than the old
  replace-on-pick. `FolderPicker` may then be removed if it has no other users
  (orphan cleanup — see §7).

### 4.9 Throughline-readiness warning [R, v1]

A pure derivation over the recognised staged files (each carries `yearLevel` and an
effective year from `inspectWorkbook` + §4.2), shown on the staging panel — no parse,
no analysis-logic change:

- **No cohort link possible** (amber, non-blocking): there is no (Year 7 in year N,
  Year 9 in year N+2) pair across the staged set. Message names what's present and
  what's missing, e.g. *"You've added Year 9 2026 only. To track a cohort from Year 7
  to Year 9, also add the Year 7 2024 files."*
- **One year only** (amber): all staged files share one year of test — the weaker
  case of the above, same message shape.
- **Ready** (quiet/green): a valid Y7→Y9 pair is present (e.g. Y7 2024 + Y9 2026).

The warning is **advisory** — it never blocks Load (single-year analyses are still
valid for Sections 1–9). It complements the post-load `MatchRateBanner`, which stays
as the authoritative ID-reconciliation check once data is loaded.

## 5. Data-model & keying implications

- The store remains keyed by `(yearOfTest, yearLevel, domain)`. A combined Load
  naturally holds multiple years — exactly what Section 10 needs.
- **Dedupe by `relativePath`** across all staged sources before Load, so re-adding a
  folder or the same file does not double-count.
- **2025 split halves across sources** pair correctly *iff* both halves end up with
  the **same effective year**. If the user assigns different years to the two halves,
  pairing fails and the lone half lands in `skipped` with the existing
  `missing {sheet} for {key}` reason — surfaced in the "not loaded" card.
- `primaryYear` defaulting (most-recent year, `availableYears` desc) is unchanged.

## 6. Why year level/domain are not hand-typed (v1)

They are intrinsic to the SSSR file (columns read by `detectDomainAndYear`). Letting
the user override them risks mislabelling a file so its store key disagrees with its
own rows — which would silently corrupt the Year 7 ↔ Year 9 cohort match (Section 10)
and the transition matrix. Year **of test** is the only fact not in the file, so it
is the only thing assigned by hand. The overview's dataset pills + match-rate banner
let the user verify the detected Y7/Y9 split. If a real file ever fails to yield a
year level, it surfaces in "not loaded" with the reason rather than being guessed.

## 7. File-by-file change list

| File | Change | Size |
|---|---|---|
| `core/src/pipeline.ts` | optional `yearOfTest` on `RawWorkbookFile`; honour it | ~3 lines |
| `core/src/loader.ts` | `inspectWorkbook()` helper (needs private `SHEET_*` consts) | small |
| `core/src/index.ts` | (no change — `inspectWorkbook` ships via the loader barrel) | — |
| `src-tauri/src/lib.rs` | `read_workbook_files` command (reuse `RawFile`) + register | small |
| `src/lib/tauriFs.ts` | `loadFilesViaTauri()` | small |
| `src/lib/dataSource.ts` | browser loose-file path (reuse `filesFromFileList`) | small |
| `src/state/AppState.tsx` | `ViewId "import"`; `staged` (metadata only) + bytes ref; stage actions; new fns on `AppContextValue`; keep `loadFiles` | medium |
| `src/components/ImportStaging.tsx` | **new** staging panel + readiness warning (§4.9) | medium |
| `src/views/HomeView.tsx` | "Edit imported files" buttons (overview + not-loaded card) | small |
| `src/App.tsx` | `case "import"` in `ActiveView`; default `activeView` → `"import"` | small |
| `src/components/TopBar.tsx` | "Change folder" → `setView("import")` | small |
| `src/components/FolderPicker.tsx` | remove if orphaned after the above | delete |
| `src/test/renderWithApp.tsx` / `makeState` | defaults for `staged: []`; no-op stage fns | small |
| `src/test/behaviour.test.tsx` | update the on-ramp assertion (was "Choose your NAPLAN folder") to the new panel's entry text; keep the `filesFromFileList` → `ArrayBuffer` assertion | small |
| Tests | core unit tests (`yearOfTest`, `inspectWorkbook`); jsdom UI test for staging/edit/load/readiness | medium |

## 8. Edge cases to handle

1. Same file added twice → deduped by `relativePath` (grey "already added").
2. Folder containing both Y7 and Y9 for one year → multiple datasets, one year.
3. Folder containing two year subfolders → per-file detected years preserved.
4. Loose 2025 split halves assigned mismatched years → lone half skipped, reason shown.
5. Non-`.xlsx` or `~$` lock files → filtered (`isXlsx`); never staged.
6. Corrupt/unreadable `.xlsx` → inspection "rejected: couldn't read this file".
7. Load with zero recognised files → button disabled.
8. Edit after Load, remove everything, Load → disabled; previous analysis retained
   until a new Load succeeds.
9. Cancelled native dialog → no-op.
10. Large/odd folder trees → Rust recursion depth already bounded (depth > 6).
11. **[R]** Same physical file staged twice via *different* methods (once loose →
    `relativePath = name`; once inside a folder → `relativePath = Folder/name`) →
    different `relativePath`, so dedupe misses it. Harmless: `buildStore`'s Map
    overwrites the duplicate key, so the store is correct — just a redundant parse.
    Note in code; no guard needed for the file counts in play.
12. **[R]** Known weak point: a 2025 split half whose partner got a *different* year
    shows the technical reason `missing Student Results Table for 2025|7|Reading` in
    the not-loaded card — opaque to a non-technical user. Acceptable for v1; the
    readiness/year confirmation (§4.2, §4.9) reduces how often it happens. Flag for a
    friendlier message later.

## 9. Privacy invariants (must hold)

- Inspection parses **locally**; no network calls anywhere in this feature.
- Rows show only filename, year, year level, domain, and counts — **no student
  names** (consistent with the existing "not loaded" list, which already shows
  filenames).
- Suppression / de-identification logic is untouched.

## 10. Build sequence & verification

1. **Core:** `yearOfTest` injection + `inspectWorkbook` + unit tests → `npm test`
   (core project) green; numbers still match the oracle (no analysis logic changed).
2. **Rust:** `read_workbook_files` + register → `npm run build` then
   `cd src-tauri && cargo check && cargo clippy`.
3. **Host glue:** loose-file pickers (desktop + browser).
4. **State + UI:** reducer additions, `ImportStaging`, HomeView/TopBar wiring →
   browser preview: stage two folders (2024 + 2026), confirm years, Load, see both
   years in the overview; add a wrong file → red status → remove; Load, then "Edit
   imported files" → fix → reload.
5. **Full gate (definition of done):** `npm run lint` · `npm run typecheck` ·
   `npm test` · `npm run build` all green; `cargo check` + `cargo clippy` clean.

## 11. Resolved by review · tradeoffs · out of scope

Resolved by the senior review (2026-05-25):
- **Manual year-level fallback** — *excluded for v1, confirmed sound.* Year level is a
  required `Student Reports` column; there is no known SSSR variant without it. A file
  that can't yield 7/9 lands in "not loaded" with the reason — never guessed.
- **Double parse** (inspect-on-add + parse-on-Load) — *keep as-is, confirmed.* Files
  are 200–800 KB, tens at a time; threading a parsed-workbook cache adds ~50–100 lines
  and an abstraction for no perceptible gain.
- **Import view vs boolean** — *resolved: `ViewId "import"`* (§4.5).
- **Bytes location** — *resolved: ref Map, not reducer* (§4.5).
- **Throughline-readiness warning** — *resolved: in v1* (§4.9).

Tradeoffs / out of scope:
- **One year per loose-file batch** — keeps the dropdown unambiguous; per-file year
  override for loose files is possible but heavier UI. Known limitation: loose files
  from two different years need two separate "Add files" actions.
- **TopBar "Change folder"** — repurposed to reopen the import view (the "go back"
  entry point), in addition to the buttons on the overview / not-loaded card.
- **Remember last-used folders** — *[later]* persist folder *paths* (never bytes) and
  offer to re-pick on restart. Non-trivial (re-read on launch); deferred.
- **Friendlier split-pair message** — *[later]* see §8 item 12.
- **Persisting staged bytes across restarts** — out of scope (would bloat storage and
  risk a privacy footgun; the user re-picks after a restart).

## 12. Test plan

- **core/tests:** `yearOfTest` override beats path resolution; falls back when absent.
  `inspectWorkbook` returns `ok` with correct year level/domain for 2025 + 2026
  fixtures, and each rejection reason for malformed inputs (reuse existing fixtures).
- **src (jsdom):** `ImportStaging` — add source (mock pickers), red status on a bad
  file, dedupe, year dropdown enables Load, remove/clear, Load calls `loadFiles` with
  the flattened year-stamped union, "Edit imported files" reopens with list intact,
  and the readiness warning (§4.9) shows for a one-year set and clears for a Y7+Y9
  set. (Plotly is already stubbed in `src/test/stubs/`.)
- **Existing tests to update:** `src/test/behaviour.test.tsx` on-ramp assertion (new
  panel entry text); confirm `renderWithApp`/`makeState` compile with the new
  `staged`/`ViewId` fields. Core analysis tests must stay green unchanged (no
  analysis logic is touched — the oracle parity must not move).
```
