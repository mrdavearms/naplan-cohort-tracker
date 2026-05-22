# Naplan Throughline

Cross-platform desktop app (**Tauri 2 + React 19 + TypeScript**) for NAPLAN
cohort analysis. **On-device, local-only, multi-school.** A from-scratch rewrite
of an internal Python/Streamlit tool.

It reads a folder of NAPLAN SSSR Extract files and surfaces participation,
proficiency, equity, skill gaps and — the headline — the **same students tracked
from Year 7 to Year 9** (the school's value-add), with both an on-screen view
and two PDF reports. No student data leaves the machine; no student names appear
anywhere.

→ **For school leaders: see [docs/USER-GUIDE.md](docs/USER-GUIDE.md).**

## Layout

| Path | What |
|---|---|
| `core/` | Pure-TypeScript analysis library — **no UI, no Tauri, no filesystem, no DOM.** Loader, stats (Wilson CI, McNemar, transition matrix), all 10 sections, narratives, chart specs. Validated against the legacy Python oracle. |
| `src/` | React 19 + Vite + Tailwind v4 UI. Consumes `core/`. Plotly charts, PDF generation. |
| `src-tauri/` | Tauri 2 native shell — window, native folder dialog + file reads, logging, auto-updater, packaging. |

`core/` stays filesystem-free: the native layer discovers files and reads bytes,
then injects them into `core/`.

## Develop

```bash
npm install
npm run dev        # Vite dev server in the browser (no Rust needed)
npm test           # vitest — analysis core (98 tests)
npm run typecheck  # tsc -b (core) + app typecheck
npm run build      # production web build
```

Requires **Node 22+**. The desktop shell additionally needs **Rust**:

```bash
npm run tauri dev    # native dev window (hot-reloads the frontend)
npm run tauri build  # .dmg/.app (macOS) — unsigned for v1
```

## Install (unsigned builds)

v1 ships **unsigned** (the audience is personal/unmanaged machines), so the OS
will warn the first time:

- **macOS:** right-click the app → **Open** → **Open** (don't double-click the
  first time). On Apple Silicon the build is ad-hoc signed to avoid the
  "app is damaged" dialog.
- **Windows:** SmartScreen → **More info** → **Run anyway**.

## Privacy

- On-device, **no external network calls**; the only outbound request is the
  auto-updater asking GitHub "is there a newer version?" (no student data).
- No student names in any chart, table, export or PDF — Local Student IDs only.
- Small subgroups (n < 5) are suppressed with the privacy note kept visible.

## Docs

- [docs/USER-GUIDE.md](docs/USER-GUIDE.md) — one-page guide for school leaders.
- [PLAN.md](PLAN.md) — the roadmap and locked architecture decisions.
- [DECISIONS.md](DECISIONS.md) — build decisions (one line each).
- [HANDOFF.md](HANDOFF.md) — current status, how to build/run, and outstanding items.
- [CLAUDE.md](CLAUDE.md) — data-format quirks, keying rule, analysis conventions.
