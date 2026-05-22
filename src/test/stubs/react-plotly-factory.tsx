/** Test stub for react-plotly.js/factory — renders a placeholder instead of a
 *  real Plotly chart (jsdom has no canvas/WebGL). */
import { createElement } from "react";

export default function createPlotlyComponent() {
  return function PlotStub() {
    return createElement("div", { "data-testid": "chart-stub" });
  };
}
