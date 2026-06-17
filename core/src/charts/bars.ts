/**
 * Stacked proficiency bar — the reusable horizontal stacked bar used across
 * Sections 2, 6, 7, and the Section 10 headline. One trace per proficiency
 * level (in PROFICIENCY_LEVELS order), stacked to 100%.
 */
import { PROFICIENCY_LEVELS, type ProficiencyLevel } from "../constants";
import type { PlotlyFigure } from "./figure";
import { CHART_FONT, PROFICIENCY_COLOURS } from "./palette";

export interface StackedBarRow {
  /** Row label, e.g. "Year 7 (n=95)" or "07A". */
  label: string;
  percentages: Record<ProficiencyLevel, number>;
}

export interface StackedBarOptions {
  title?: string;
  xTitle?: string;
  height?: number;
}

export function stackedProficiencyBarFigure(
  rows: readonly StackedBarRow[],
  options: StackedBarOptions = {},
): PlotlyFigure {
  const labels = rows.map((r) => r.label);
  const data = PROFICIENCY_LEVELS.map((lvl) => ({
    type: "bar",
    orientation: "h",
    name: lvl,
    y: labels,
    x: rows.map((r) => r.percentages[lvl] ?? 0),
    marker: { color: PROFICIENCY_COLOURS[lvl] },
    text: rows.map((r) => `${(r.percentages[lvl] ?? 0).toFixed(1)}%`),
    textposition: "inside",
    insidetextanchor: "middle",
  }));

  return {
    data,
    layout: {
      barmode: "stack",
      title: options.title ? { text: options.title } : undefined,
      xaxis: { range: [0, 100], title: options.xTitle ?? "% of participating students" },
      yaxis: { title: "", automargin: true },
      height: options.height ?? 300,
      margin: { l: 10, r: 10, t: 50, b: 120 },
      legend: { orientation: "h", yanchor: "top", y: -0.4, xanchor: "center", x: 0.5 },
      font: { family: CHART_FONT },
    },
  };
}
