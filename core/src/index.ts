/**
 * @naplan-throughline/core — pure-TypeScript NAPLAN cohort analysis library.
 *
 * No React, no Tauri, no DOM. This layer is the validation target against the
 * Python oracle (`verification/verify_cohort.py` in the legacy repo) and must
 * stay independently unit-testable.
 *
 * Phase 1 populates this with the loader (parse / alias / keying),
 * `buildPairedCohort`, `wilsonCi`, `mcnemarPaired`, and `transitionMatrix`.
 * For now this is a scaffold smoke test that proves the workspace wiring.
 */
export const CORE_PACKAGE = "@naplan-throughline/core" as const;
