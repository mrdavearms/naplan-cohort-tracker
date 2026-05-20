/**
 * @naplan-throughline/core — pure-TypeScript NAPLAN cohort analysis library.
 *
 * No React, no Tauri, no DOM. This layer is the validation target against the
 * Python oracle (`verification/verify_cohort.py` in the legacy repo) and must
 * stay independently unit-testable.
 *
 * Phase 1: constants, types, stats (Wilson CI + McNemar), and cohort pairing.
 * The loader (parse / alias / keying) and the file-source injection boundary
 * land next; folder discovery + file reads stay in the Tauri layer.
 */
export * from "./constants";
export * from "./types";
export * from "./stats";
export * from "./cohort";

export const CORE_PACKAGE = "@naplan-throughline/core" as const;
