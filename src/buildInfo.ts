/**
 * Build-time stamp shown on the About screen — app version, the exact commit it
 * was built from, and when it was built (Melbourne time). The values are injected
 * by Vite `define` (see vite.config.ts) so they are present synchronously on
 * every screen. Vitest uses a separate config with no `define`, so each field
 * falls back to a dev placeholder there (guarded with `typeof` so an undeclared
 * identifier never throws).
 */
export const BUILD_INFO = {
  version: typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev",
  commit: typeof __GIT_COMMIT__ !== "undefined" ? __GIT_COMMIT__ : "local",
  builtAt: typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : "local build",
} as const;

/** One-line stamp, e.g. "v1.0.1 · 5e12573 · 30/05/2026, 21:18 AEST". */
export const BUILD_STAMP = `v${BUILD_INFO.version} · ${BUILD_INFO.commit} · ${BUILD_INFO.builtAt}`;
