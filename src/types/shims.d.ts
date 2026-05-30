// Build-time constants injected by Vite `define` (see vite.config.ts). They are
// absent under Vitest (separate config, no define), so read them via
// src/buildInfo.ts, which falls back gracefully.
declare const __APP_VERSION__: string;
declare const __GIT_COMMIT__: string;
declare const __BUILD_TIME__: string;

/** Ambient module shims for Plotly packages that ship without TypeScript types.
 *  core/ produces validated plain-object figure specs, so loose typing here is
 *  acceptable — the figure structure is unit-tested upstream. */
declare module "plotly.js-dist-min" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Plotly: any;
  export default Plotly;
}

declare module "react-plotly.js/factory" {
  import type { ComponentType } from "react";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createPlotlyComponent: (plotly: unknown) => ComponentType<any>;
  export default createPlotlyComponent;
}
