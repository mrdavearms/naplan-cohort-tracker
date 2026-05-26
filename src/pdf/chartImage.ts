/**
 * Render a core PlotlyFigure spec to a fixed-size PNG data URL for embedding in
 * PDFs. Fixed dimensions + a consistent font keep chart output identical across
 * the WebView2 and WebKit engines (PLAN.md early-foundations #5).
 */
import Plotly from "plotly.js-dist-min";
import type { PlotlyFigure } from "@naplan-cohort-tracker/core";

export async function figureToPng(
  figure: PlotlyFigure,
  width: number,
  height: number,
): Promise<string> {
  const div = document.createElement("div");
  div.style.position = "fixed";
  div.style.left = "-10000px";
  div.style.top = "0";
  div.style.width = `${width}px`;
  div.style.height = `${height}px`;
  document.body.appendChild(div);

  const baseFont = (figure.layout["font"] as Record<string, unknown> | undefined) ?? {};
  const layout = {
    ...figure.layout,
    width,
    height,
    paper_bgcolor: "white",
    plot_bgcolor: "white",
    font: { ...baseFont, family: "Inter, Arial, sans-serif" },
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const P = Plotly as any;
    await P.newPlot(div, figure.data, layout, { staticPlot: true, responsive: false });
    const url: string = await P.toImage(div, { format: "png", width, height, scale: 2 });
    return url;
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Plotly as any).purge(div);
    div.remove();
  }
}
