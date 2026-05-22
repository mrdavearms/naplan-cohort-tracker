import { describe, expect, it } from "vitest";
import { dumbbellFigure, movementStackedFigure, type BandMovement, type DumbbellRow } from "../src/index";

function mv(up: number, stayed: number, down: number): BandMovement {
  const total = up + stayed + down;
  const pct = (x: number) => (total ? (x / total) * 100 : 0);
  return { up, stayed, down, total, upPct: pct(up), stayedPct: pct(stayed), downPct: pct(down) };
}

describe("dumbbellFigure", () => {
  const rows = [
    { domain: "Reading", y7Value: 11, y9Value: 5.5, direction: "improved" as const },
    { domain: "Grammar", y7Value: 11.6, y9Value: 15.9, direction: "worsened" as const },
  ];

  it("emits a Y7 marker trace, a Y9 marker trace, and a connecting line per row", () => {
    const fig = dumbbellFigure(rows, { axisTitle: "NAS %" });
    const markerTraces = fig.data.filter((t) => (t as { mode?: string }).mode === "markers");
    expect(markerTraces).toHaveLength(2); // Y7 + Y9
    const lineShapes = (fig.layout as { shapes?: unknown[] }).shapes ?? [];
    expect(lineShapes).toHaveLength(2); // one per domain
    const y9 = fig.data.find((t) => (t as { name?: string }).name === "Year 9") as { x: number[] };
    expect(y9.x).toEqual([5.5, 15.9]); // Y9 values in row order
  });
});

describe("movementStackedFigure", () => {
  it("builds three stacked traces (down, stayed, up) per row, summing to 100%", () => {
    const fig = movementStackedFigure([{ label: "Reading (n=4)", movement: mv(1, 2, 1) }]);
    expect(fig.data).toHaveLength(3);
    const names = fig.data.map((t) => (t as { name: string }).name);
    expect(names).toEqual(["Moved down", "Stayed", "Moved up"]);
    expect((fig.layout as { barmode?: string }).barmode).toBe("stack");
    // up share for the single row = 25%
    const upTrace = fig.data[2] as { x: number[] };
    expect(upTrace.x[0]).toBeCloseTo(25, 5);
  });
});
