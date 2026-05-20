# Naplan Throughline

Cross-platform desktop app (Tauri + React + TypeScript) for NAPLAN cohort analysis. On-device, local-only, multi-school. A from-scratch rewrite of an internal Python/Streamlit tool.

**Status:** early development. The pure-TypeScript analysis core (`core/`) is being built and validated against the legacy Python oracle *before* the Tauri shell is scaffolded.

## Layout

| Path | What |
|---|---|
| `core/` | Pure-TypeScript analysis library — no UI, no Tauri, no DOM. The validation target. |
| `src/` | React UI (added in a later phase). |
| `src-tauri/` | Tauri shell — native window, dialogs, packaging (added in a later phase). |

## Develop

```bash
npm install
npm test          # vitest
npm run typecheck # tsc -b
```

Requires Node 22+. The Tauri shell additionally needs Rust (installed when the shell phase begins).

See [PLAN.md](PLAN.md) for the roadmap and [CLAUDE.md](CLAUDE.md) for the data-format quirks, keying rule, and analysis conventions that must be honoured.
