/**
 * Plotly chart wrapper. core/ produces `PlotlyFigure` specs (plain objects);
 * this renders them via react-plotly.js bound to the prebuilt plotly.js-dist-min
 * (avoids the heavy source build and works offline in the webview).
 */
import { useMemo } from "react";
import Plotly from "plotly.js-dist-min";
import createPlotlyComponent from "react-plotly.js/factory";
import type { PlotlyFigure } from "@naplan-cohort-tracker/core";

const Plot = createPlotlyComponent(Plotly);

interface ChartProps {
  figure: PlotlyFigure;
  /** Height override in px; falls back to the figure's layout height or 360. */
  height?: number;
  className?: string;
}

const STATIC_CONFIG = {
  displayModeBar: false,
  responsive: true,
  // Local-only app: no external image-export service.
  staticPlot: false,
} as const;

export function Chart({ figure, height, className }: ChartProps) {
  const layout = useMemo(
    () => ({
      autosize: true,
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      ...figure.layout,
      ...(height ? { height } : {}),
    }),
    [figure.layout, height],
  );

  return (
    <Plot
      // figure.data/layout are validated upstream in core (plain-object specs).
      data={figure.data}
      layout={layout}
      config={STATIC_CONFIG}
      useResizeHandler
      className={className}
      style={{ width: "100%", height: height ?? "360px" }}
    />
  );
}
