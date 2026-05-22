/**
 * Movement summary — a horizontal 100% stacked bar (Moved down / Stayed /
 * Moved up) per row, reusing the DIRECTION_FILL palette so it matches the
 * Sankey/heatmap direction encoding. Percentages are shown statically inside
 * each segment (no hover needed — works in the app, PDF and projected).
 */
import type { BandMovement } from "../sections/cohortTracking";
import type { PlotlyFigure } from "./figure";
import { CHART_FONT, DIRECTION_FILL } from "./palette";

export interface MovementBarRow {
  /** Row label, e.g. "Reading (n=73)". */
  label: string;
  movement: BandMovement;
}

export interface MovementBarOptions {
  title?: string;
  height?: number;
}

/** Drop a label if its segment is too thin to hold the text (< 6%). */
function label(pct: number): string {
  return pct >= 6 ? `${pct.toFixed(0)}%` : "";
}

export function movementStackedFigure(
  rows: readonly MovementBarRow[],
  options: MovementBarOptions = {},
): PlotlyFigure {
  const labels = rows.map((r) => r.label);
  const segments: { name: string; key: "downPct" | "stayedPct" | "upPct"; color: string }[] = [
    { name: "Moved down", key: "downPct", color: DIRECTION_FILL.decliner },
    { name: "Stayed", key: "stayedPct", color: DIRECTION_FILL.stayer },
    { name: "Moved up", key: "upPct", color: DIRECTION_FILL.improver },
  ];
  const data = segments.map((seg) => ({
    type: "bar",
    orientation: "h",
    name: seg.name,
    y: labels,
    x: rows.map((r) => r.movement[seg.key]),
    marker: { color: seg.color },
    text: rows.map((r) => label(r.movement[seg.key])),
    textposition: "inside",
    insidetextanchor: "middle",
    hovertemplate: `${seg.name}: %{x:.0f}%<extra></extra>`,
  }));

  return {
    data,
    layout: {
      barmode: "stack",
      title: options.title ? { text: options.title } : undefined,
      xaxis: { range: [0, 100], title: "% of paired cohort" },
      yaxis: { title: "", automargin: true },
      height: options.height ?? Math.max(160, 70 + rows.length * 42),
      margin: { l: 10, r: 10, t: options.title ? 50 : 20, b: 60 },
      legend: { orientation: "h", yanchor: "top", y: -0.25, xanchor: "center", x: 0.5 },
      font: { family: CHART_FONT },
    },
  };
}
