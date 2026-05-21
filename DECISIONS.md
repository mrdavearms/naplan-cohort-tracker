# DECISIONS.md

Autonomous build decisions (overnight Phase 4+). One line each: decision + why.
These honour PLAN.md / CLAUDE.md / DESIGN.md. Where the user might have chosen
differently, the default taken is the most conventional one for the stack.

## Phase 4 — UI shell

- **React app at repo root (`src/`, `index.html`, `vite.config.ts`); `core/` stays a workspace dep.** — Per PLAN.md senior-review layout note; keeps `core/` independently testable.
- **Vite resolves `@naplan-throughline/core` via an alias to `core/src/index.ts`.** — Guarantees Vite/esbuild transpiles the workspace TypeScript source (no separate build step for core).
- **Typecheck = `tsc -b && tsc -p tsconfig.app.json --noEmit`.** — Keeps the existing composite `core` build untouched; the app is typechecked separately (avoids forcing `composite`/emit on a no-emit React app).
- **State: React Context + `useReducer`; no router; active section via state.** — Mirrors Curriculum Planner exactly (it has no react-router); simplest for a desktop single-window app.
- **Fonts self-hosted via `@fontsource` (Inter, Roboto Slab, Syne), NOT Google Fonts CDN.** — Privacy invariant: no external network calls. CP uses the CDN; we cannot.
- **Icons: `@heroicons/react/24/outline`.** — DESIGN.md explicitly specifies Heroicons outline (CP used lucide + hand-rolled; DESIGN.md overrides).
- **Vite 7 + `@vitejs/plugin-react` 5 (not Vite 8 / plugin-react 6 like CP).** — `@vitejs/plugin-react@6` peer-requires Vite 8, which collides with the existing `vitest@3.2.4` (peers Vite <8). Pinning Vite 7 keeps the 86 core tests on the unchanged vitest runner (no risky vitest 4 upgrade). Vite 7 fully supports React 19 + Tailwind 4 + Tauri.
- **Charts: `react-plotly.js` + `plotly.js-dist-min` via the factory wrapper.** — PLAN/DESIGN mandate Plotly; the dist-min build avoids the heavy source build and works in-webview; factory wrapper sidesteps default-plotly type friction.
- **Data-source boundary: pure `loadStoreFromFiles(rawFiles)` added to `core/`.** — `core/` stays filesystem-free; the browser (dir input) and Tauri (plugin-fs walk) both produce `{name, relativePath, bytes}` and inject them. yearOfTest resolved from the `Naplan YYYY` folder name (mirrors legacy `storage.py` `LocalBackend`), falling back to the filename.
- **Settings: versioned `{schemaVersion, ...}` with a pure `migrate()` in `core/src/settings.ts`.** — Early-foundations #8; persistence adapter lives in the UI/Tauri layer (localStorage in browser dev, Tauri store/fs in the shell).
- **App tsconfig drops `noUnusedLocals`/`noUnusedParameters`.** — The alias pulls `core/` source into the app's TS program; those flags would re-flag two pre-existing harmless unused vars in validated core. `core/`'s own `tsc -b` is the authority for core lint; we don't touch core. App code stays under `strict`.
- **Plotly type shim (`src/types/shims.d.ts`).** — `plotly.js-dist-min` and `react-plotly.js/factory` ship without types; figure specs are validated in core, so loose typing at the render boundary is acceptable.
- **Match-rate banner denominator: paired vs current-year (Y9) cohort = paired + joiners.** — "matched N of M" answers "how many of this year's students could we track back to Y7"; leavers/joiners shown alongside.
