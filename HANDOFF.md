# HANDOFF — Naplan Throughline (overnight build)

Morning handoff for Dave. What got done, what needs you, how to run it.

_Last updated: 2026-05-21 (overnight session, autonomous)._

## Where things stand

- **Phases 0–3:** complete and oracle-validated before this session (analysis `core/`).
- **Phase 4 (Tauri + React shell):** IN PROGRESS — see "Completed this session".
- The build is kept green: `npm test` (86+ tests) and `npm run typecheck` pass at every commit; every unit is pushed to `origin/main`.

## Completed this session

_(updated as work lands)_

## NEEDS DAVE (prioritised — things a permission gate or you-only step blocks)

_(updated as encountered)_

## Known issues / TODOs

_(updated as encountered)_

## How to run, build, test

### Analysis core (no Rust needed)
```bash
cd /Users/davidarmstrong/Antigravity/naplan-throughline
npm install
npm test          # vitest — analysis core
npm run typecheck # tsc -b (core) + app typecheck
```

### Frontend (browser dev — no Rust needed)
```bash
npm run dev       # Vite dev server; open the printed localhost URL
npm run build     # production web build (verifies the app compiles)
```

### Tauri desktop app (needs Rust — already installed on this machine)
```bash
source "$HOME/.cargo/env"
npm run tauri dev    # native dev window
npm run tauri build  # .app/.dmg (unsigned) into src-tauri/target/release/bundle/
```

## Decisions

See [DECISIONS.md](DECISIONS.md) — one line per decision with the reason.
