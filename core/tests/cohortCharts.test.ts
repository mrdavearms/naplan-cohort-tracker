import { describe, expect, it } from "vitest";
import { movementStackedFigure, type BandMovement } from "../src/index";

function mv(up: number, stayed: number, down: number): BandMovement {
  const total = up + stayed + down;
  const pct = (x: number) => (total ? (x / total) * 100 : 0);
  return { up, stayed, down, total, upPct: pct(up), stayedPct: pct(stayed), downPct: pct(down) };
}

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
