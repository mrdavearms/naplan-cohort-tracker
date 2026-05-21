/**
 * Section 10 Drill-down E — Wilson CI dot plot for the paired NAS proportion,
 * Y7 vs Y9. Two points with asymmetric Wilson 95% error bars. Ported from the
 * inline figure in `s10_cohort_tracking._render_drill_e_robustness`.
 */
import { NAS } from "../constants";
import { wilsonCi } from "../stats";
import type { PairedCohort } from "../types";
import type { PlotlyFigure } from "./figure";
import { CHART_FONT, PROFICIENCY_COLOURS } from "./palette";

export function wilsonCiDotPlotFigure(
  pc: PairedCohort,
  y7Year: number,
  y9Year: number,
): PlotlyFigure {
  const n = pc.paired.length;
  const y7Count = pc.paired.filter((s) => s.proficiencyY7 === NAS).length;
  const y9Count = pc.paired.filter((s) => s.proficiencyY9 === NAS).length;
  const [y7Lo, y7Hi] = wilsonCi(y7Count, n);
  const [y9Lo, y9Hi] = wilsonCi(y9Count, n);
  const y7Pct = n > 0 ? (y7Count / n) * 100 : 0;
  const y9Pct = n > 0 ? (y9Count / n) * 100 : 0;

  const point = (label: string, pct: number, lo: number, hi: number): Record<string, unknown> => ({
    type: "scatter",
    x: [pct],
    y: [label],
    error_x: {
      type: "data",
      symmetric: false,
      array: [hi * 100 - pct],
      arrayminus: [pct - lo * 100],
    },
    mode: "markers",
    marker: { size: 12, color: PROFICIENCY_COLOURS[NAS] },
    name: `${label} NAS%`,
    hovertext: `${pct.toFixed(1)}% [${(lo * 100).toFixed(1)}, ${(hi * 100).toFixed(1)}]`,
  });

  return {
    data: [point("Y7", y7Pct, y7Lo, y7Hi), point("Y9", y9Pct, y9Lo, y9Hi)],
    layout: {
      title: { text: `${pc.domain}: NAS proportion with Wilson 95% CI (Y7 ${y7Year} → Y9 ${y9Year})` },
      xaxis: { title: "% NAS", range: [0, Math.max(50, y7Hi * 100 + 5, y9Hi * 100 + 5)] },
      yaxis: { title: "" },
      height: 240,
      margin: { l: 10, r: 10, t: 50, b: 60 },
      showlegend: false,
      font: { family: CHART_FONT },
    },
  };
}
