/**
 * A Plotly figure spec as a plain object. core/ stays runtime-pure (no Plotly
 * dependency) — these specs are handed to Plotly by the UI (react-plotly.js)
 * and by the PDF generator (Plotly.toImage). Typed loosely on purpose: Plotly's
 * own trace union types are heavy and fight construction; the values here come
 * from oracle-validated functions and the structure is unit-tested.
 */
export type PlotlyTrace = Record<string, unknown>;
export type PlotlyLayout = Record<string, unknown>;

export interface PlotlyFigure {
  data: PlotlyTrace[];
  layout: PlotlyLayout;
}
