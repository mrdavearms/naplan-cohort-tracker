/**
 * Cross-domain Y7 -> Y9 charts: a dumbbell (grey Y7 dot -> coloured Y9 dot per
 * domain) and a diverging net-change bar. Colour by direction reuses the
 * DIRECTION_FILL palette. Direction is supplied by the caller so the same
 * builder works for NAS% (lower is better) or Meeting+% (higher is better).
 */
import type { PlotlyFigure } from "./figure";
import { CHART_FONT, DIRECTION_FILL } from "./palette";

export type MoveDirection = "improved" | "worsened" | "flat";

export interface DumbbellRow {
  domain: string;
  y7Value: number;
  y9Value: number;
  direction: MoveDirection;
}

export interface DumbbellOptions {
  axisTitle?: string;
  height?: number;
}

const Y7_GREY = "#9e9e9e";
const dirColor = (d: MoveDirection): string =>
  d === "improved" ? DIRECTION_FILL.improver : d === "worsened" ? DIRECTION_FILL.decliner : DIRECTION_FILL.stayer;

export function dumbbellFigure(rows: readonly DumbbellRow[], options: DumbbellOptions = {}): PlotlyFigure {
  const domains = rows.map((r) => r.domain);
  const shapes = rows.map((r) => ({
    type: "line",
    xref: "x",
    yref: "y",
    x0: r.y7Value,
    x1: r.y9Value,
    y0: r.domain,
    y1: r.domain,
    line: { color: dirColor(r.direction), width: 3 },
  }));
  return {
    data: [
      {
        type: "scatter",
        mode: "markers",
        name: "Year 7",
        x: rows.map((r) => r.y7Value),
        y: domains,
        marker: { color: Y7_GREY, size: 11 },
        hovertemplate: "Year 7: %{x:.1f}<extra></extra>",
      },
      {
        type: "scatter",
        mode: "markers",
        name: "Year 9",
        x: rows.map((r) => r.y9Value),
        y: domains,
        marker: { color: rows.map((r) => dirColor(r.direction)), size: 13 },
        hovertemplate: "Year 9: %{x:.1f}<extra></extra>",
      },
    ],
    layout: {
      shapes,
      title: undefined,
      xaxis: { title: options.axisTitle ?? "", rangemode: "tozero" },
      yaxis: { title: "", automargin: true, autorange: "reversed" },
      height: options.height ?? Math.max(180, 80 + rows.length * 40),
      margin: { l: 10, r: 20, t: 20, b: 50 },
      legend: { orientation: "h", yanchor: "top", y: -0.2, xanchor: "center", x: 0.5 },
      font: { family: CHART_FONT },
    },
  };
}
