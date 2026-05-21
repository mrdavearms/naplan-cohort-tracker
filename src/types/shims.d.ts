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
