/**
 * Section 10 transition charts — Sankey + direction-coloured heatmap.
 * Ported from `naplan/cohort_charts.py`, preserving the layout fixes:
 * blank Sankey node labels rendered as margin annotations (avoids Plotly's
 * node-label halo), proportional node heights, signed heatmap z so zero maps
 * to the grey midpoint, and the top-side heatmap x-axis with extra top margin.
 */
import { PROFICIENCY_LEVELS } from "../constants";
import { transitionMatrix } from "../cohort";
import type { PairedCohort } from "../types";
import type { PlotlyFigure } from "./figure";
import { CHART_FONT, DIRECTION_FILL, HEATMAP_COLORSCALE, SANKEY_NODE_COLOURS } from "./palette";

function rowTotalsOf(m: number[][]): number[] {
  return m.map((row) => row.reduce((a, b) => a + b, 0));
}
function colTotalsOf(m: number[][]): number[] {
  return PROFICIENCY_LEVELS.map((_, j) => m.reduce((s, row) => s + row[j]!, 0));
}

/** y-positions proportional to cumulative flow, so node heights match counts. */
function proportionalY(totals: number[]): number[] {
  const total = totals.reduce((a, b) => a + b, 0) || 1;
  const positions: number[] = [];
  let cumulative = 0;
  for (const size of totals) {
    positions.push((cumulative + size / 2) / total);
    cumulative += size;
  }
  return positions;
}

export function transitionSankeyFigure(
  pc: PairedCohort,
  y7Year: number,
  y9Year: number,
): PlotlyFigure {
  const L = PROFICIENCY_LEVELS;
  const n = L.length;
  const eL = `Y${pc.earlierLevel}`;
  const lL = `Y${pc.laterLevel}`;
  const m = transitionMatrix(pc.paired);
  const rowTotals = rowTotalsOf(m);
  const colTotals = colTotalsOf(m);
  const nTotal = rowTotals.reduce((a, b) => a + b, 0);

  const nodeColors = [...L.map((l) => SANKEY_NODE_COLOURS[l]), ...L.map((l) => SANKEY_NODE_COLOURS[l])];

  const sources: number[] = [];
  const targets: number[] = [];
  const values: number[] = [];
  const linkColors: string[] = [];
  const linkLabels: string[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const count = m[i]![j]!;
      if (count === 0) continue;
      sources.push(i);
      targets.push(n + j);
      values.push(count);
      linkColors.push(j > i ? DIRECTION_FILL.improver : j < i ? DIRECTION_FILL.decliner : DIRECTION_FILL.stayer);
      const rt = rowTotals[i]!;
      const pct = rt > 0 ? (count / rt) * 100 : 0;
      linkLabels.push(`${L[i]} → ${L[j]}: ${count} students (${Math.round(pct)}% of ${eL} ${L[i]})`);
    }
  }

  const nodeX = [...Array<number>(n).fill(0.001), ...Array<number>(n).fill(0.999)];
  const nodeY = [...proportionalY(rowTotals), ...proportionalY(colTotals)];

  const labelFont = { size: 13, color: "#000000", family: CHART_FONT };
  const annotations: Record<string, unknown>[] = [
    { text: `<b>${eL} ${y7Year}</b>`, x: 0.0, y: 1.06, xref: "paper", yref: "paper", showarrow: false, xanchor: "left", font: { size: 14, color: "#1A237E" } },
    { text: `<b>${lL} ${y9Year}</b>`, x: 1.0, y: 1.06, xref: "paper", yref: "paper", showarrow: false, xanchor: "right", font: { size: 14, color: "#1A237E" } },
  ];
  for (let i = 0; i < n; i++) {
    annotations.push({
      text: `${L[i]} (${rowTotals[i]})`,
      x: -0.005, y: 1.0 - nodeY[i]!, xref: "paper", yref: "paper",
      showarrow: false, xanchor: "right", yanchor: "middle", font: labelFont,
    });
    annotations.push({
      text: `${L[i]} (${colTotals[i]})`,
      x: 1.005, y: 1.0 - nodeY[n + i]!, xref: "paper", yref: "paper",
      showarrow: false, xanchor: "left", yanchor: "middle", font: labelFont,
    });
  }

  return {
    data: [
      {
        type: "sankey",
        arrangement: "fixed",
        node: {
          pad: 24,
          thickness: 20,
          line: { color: "#37474F", width: 0.5 },
          label: Array<string>(n * 2).fill(""), // labels are margin annotations (see module doc)
          color: nodeColors,
          x: nodeX,
          y: nodeY,
        },
        link: {
          source: sources,
          target: targets,
          value: values,
          color: linkColors,
          customdata: linkLabels,
          hovertemplate: "%{customdata}<extra></extra>",
        },
      },
    ],
    layout: {
      title: {
        text: `${pc.domain}: ${eL} ${y7Year} → ${lL} ${y9Year} movement (n=${nTotal})`,
        x: 0.5, xanchor: "center", y: 0.99, yanchor: "top",
      },
      height: 600,
      margin: { l: 200, r: 200, t: 100, b: 40 },
      font: { size: 14, color: "#000000", family: CHART_FONT },
      annotations,
    },
  };
}

export function transitionHeatmapFigure(
  pc: PairedCohort,
  y7Year: number,
  y9Year: number,
): PlotlyFigure {
  const L = PROFICIENCY_LEVELS;
  const n = L.length;
  const eL = `Y${pc.earlierLevel}`;
  const lL = `Y${pc.laterLevel}`;
  const m = transitionMatrix(pc.paired);
  const rowTotals = rowTotalsOf(m);
  const nTotal = rowTotals.reduce((a, b) => a + b, 0);

  // Signed z: positive above diagonal (improve), negative below (decline), 0 on diagonal.
  const z: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      const count = m[i]![j]!;
      row.push(j > i ? count : j < i ? -count : 0);
    }
    z.push(row);
  }
  const absMax = Math.max(1, ...z.flat().map((v) => Math.abs(v)));

  const textGrid: string[][] = [];
  for (let i = 0; i < n; i++) {
    const rt = rowTotals[i]!;
    const row: string[] = [];
    for (let j = 0; j < n; j++) {
      const count = m[i]![j]!;
      const pct = rt > 0 ? Math.round((count / rt) * 100) : 0;
      if (count === 0) row.push("—");
      else if (j > i) row.push(`<b>${count} ↗</b><br>(${pct}%)`);
      else if (j < i) row.push(`<b>${count} ↘</b><br>(${pct}%)`);
      else row.push(`<b>${count}</b><br>(${pct}%)<br><i>stayed</i>`);
    }
    textGrid.push(row);
  }

  return {
    data: [
      {
        type: "heatmap",
        z,
        x: [...L],
        y: [...L],
        text: textGrid,
        texttemplate: "%{text}",
        colorscale: HEATMAP_COLORSCALE,
        zmin: -absMax,
        zmax: absMax,
        showscale: false,
        hovertemplate: `${eL}: %{y}<br>${lL}: %{x}<br>%{text}<extra></extra>`,
      },
    ],
    layout: {
      title: {
        text: `${pc.domain}: ${eL} ${y7Year} → ${lL} ${y9Year} (n=${nTotal})`,
        x: 0.5, xanchor: "center", y: 0.97, yanchor: "top",
      },
      xaxis: { title: { text: `${lL} ${y9Year} proficiency →`, standoff: 10 }, side: "top" },
      yaxis: { title: `${eL} ${y7Year} proficiency →`, automargin: true, autorange: "reversed" },
      height: 460,
      margin: { l: 160, r: 20, t: 140, b: 60 },
      font: { family: CHART_FONT },
    },
  };
}
