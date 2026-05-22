/**
 * Chart-spec structural tests. Charts are visual (final appearance is verified
 * when rendered in Phase 4/5); here we assert the spec carries the right data
 * derived from the oracle-validated transition matrix / Wilson functions.
 */
import { describe, expect, it } from "vitest";
import {
  DIRECTION_FILL,
  PROFICIENCY_COLOURS,
  stackedProficiencyBarFigure,
  transitionHeatmapFigure,
  transitionSankeyFigure,
  wilsonCiDotPlotFigure,
  type PairedCohort,
  type PairedStudent,
} from "../src/index";

const NAS = "Needs additional support";

function ps(y7: string, y9: string): PairedStudent {
  return {
    localStudentId: "x",
    classGroupY7: null,
    proficiencyY7: y7,
    lboteStatus: null,
    atsiGroup: "Not reported",
    participationCode: "Participated",
    classGroupY9: null,
    proficiencyY9: y9,
  };
}

// Known transitions: NAS→NAS, NAS→Strong, Developing→Strong, Strong→NAS, Strong→Exceeding
const pc: PairedCohort = {
  domain: "Reading",
  paired: [ps(NAS, NAS), ps(NAS, "Strong"), ps("Developing", "Strong"), ps("Strong", NAS), ps("Strong", "Exceeding")],
  leavers: [],
  joiners: [],
  pairedFilteredCount: 0,
};

describe("transitionSankeyFigure", () => {
  const fig = transitionSankeyFigure(pc, 2024, 2026);
  const trace = fig.data[0] as any;

  it("is a Sankey with 8 blank node labels (labels live in annotations)", () => {
    expect(trace.type).toBe("sankey");
    expect(trace.node.label).toEqual(["", "", "", "", "", "", "", ""]);
    expect((fig.layout as any).annotations.length).toBe(2 + 8); // Y7/Y9 headers + 8 node labels
  });

  it("has one link per non-zero transition cell, values summing to n", () => {
    expect(trace.link.source).toHaveLength(5);
    expect(trace.link.value.reduce((a: number, b: number) => a + b, 0)).toBe(5);
  });

  it("colours links by direction", () => {
    const colours = new Set<string>(trace.link.color);
    expect(colours.has(DIRECTION_FILL.improver)).toBe(true); // NAS→Strong etc.
    expect(colours.has(DIRECTION_FILL.stayer)).toBe(true); // NAS→NAS
    expect(colours.has(DIRECTION_FILL.decliner)).toBe(true); // Strong→NAS
  });

  it("titles with domain + year range + n", () => {
    expect((fig.layout as any).title.text).toContain("Reading");
    expect((fig.layout as any).title.text).toContain("n=5");
  });
});

describe("transitionHeatmapFigure", () => {
  const fig = transitionHeatmapFigure(pc, 2024, 2026);
  const trace = fig.data[0] as any;

  it("is a heatmap with signed z (improve +, decline -, stay 0)", () => {
    expect(trace.type).toBe("heatmap");
    // rows = Y7 [NAS, Developing, Strong, Exceeding]
    expect(trace.z[0][2]).toBe(1); // NAS→Strong (above diagonal → +)
    expect(trace.z[2][0]).toBe(-1); // Strong→NAS (below diagonal → -)
    expect(trace.z[0][0]).toBe(0); // NAS→NAS (diagonal → 0)
    expect(trace.zmin).toBe(-trace.zmax);
  });

  it("puts the Y9 axis on top and reverses the Y7 axis", () => {
    expect((fig.layout as any).xaxis.side).toBe("top");
    expect((fig.layout as any).yaxis.autorange).toBe("reversed");
  });
});

describe("stackedProficiencyBarFigure", () => {
  it("emits one trace per proficiency level with the right colour + values", () => {
    const fig = stackedProficiencyBarFigure([
      { label: "Year 7", percentages: { [NAS]: 20, Developing: 20, Strong: 40, Exceeding: 20 } },
    ]);
    expect(fig.data).toHaveLength(4);
    const nasTrace = fig.data.find((t) => (t as any).name === NAS) as any;
    expect(nasTrace.x).toEqual([20]);
    expect(nasTrace.marker.color).toBe(PROFICIENCY_COLOURS[NAS]);
    expect((fig.layout as any).barmode).toBe("stack");
  });
});

describe("wilsonCiDotPlotFigure", () => {
  it("emits Y7 + Y9 points with asymmetric Wilson error bars", () => {
    const fig = wilsonCiDotPlotFigure(pc, 2024, 2026);
    expect(fig.data).toHaveLength(2);
    const y7 = fig.data[0] as any;
    expect(y7.y).toEqual(["Y7"]);
    expect(y7.error_x.type).toBe("data");
    expect(y7.error_x.symmetric).toBe(false);
    expect(y7.error_x.array).toHaveLength(1);
    expect(y7.error_x.arrayminus).toHaveLength(1);
  });
});
