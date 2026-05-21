/** Shared chart colours + font, ported from `naplan/colours.py` and the
 *  direction palette in `naplan/cohort_charts.py`. */
import type { ProficiencyLevel } from "../constants";

export const PROFICIENCY_COLOURS: Record<ProficiencyLevel, string> = {
  "Needs additional support": "#D62728",
  Developing: "#FF9F1C",
  Strong: "#7FB069",
  Exceeding: "#2E7D32",
};

export const PARTICIPATION_COLOURS: Record<string, string> = {
  Participated: "#2E7D32",
  Absent: "#FF9F1C",
  Withdrawn: "#D62728",
};

/** Direction-encoding fills for transition charts (improver / stayer / decliner). */
export const DIRECTION_FILL = {
  improver: "rgba(102, 187, 106, 0.7)", // green
  stayer: "rgba(158, 158, 158, 0.6)", // grey
  decliner: "rgba(239, 83, 80, 0.75)", // red
} as const;

/** Diverging colourscale for the transition heatmap: red (decline) → grey (stay) → green (improve). */
export const HEATMAP_COLORSCALE: [number, string][] = [
  [0.0, "#EF5350"],
  [0.5, "#ECEFF1"],
  [1.0, "#66BB6A"],
];

/** Softer palette for Sankey nodes (saturated palette is unreadable behind labels). */
export const SANKEY_NODE_COLOURS: Record<ProficiencyLevel, string> = {
  "Needs additional support": "#EF9A9A",
  Developing: "#FFCC80",
  Strong: "#C5E1A5",
  Exceeding: "#9CCC65",
};

/**
 * Chart font family. Phase 5 replaces this with a bundled TTF set as Plotly
 * `font.family`, so PDF chart rendering is consistent across WebView2 (Windows)
 * and WebKit (macOS) — the cross-engine concern from the architecture review.
 */
export const CHART_FONT = "Arial, Helvetica, sans-serif";
