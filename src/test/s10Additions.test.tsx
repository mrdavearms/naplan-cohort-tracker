/**
 * jsdom render tests for the v1.2 Section-10 additions (1-1 … 1-6). Plotly is
 * stubbed; these exercise the core→view wiring against the committed synthetic
 * fixtures (see CLAUDE.md: verify analysis views with jsdom, not the browser).
 */
import { beforeAll, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import type { Store } from "@naplan-cohort-tracker/core";
import { buildSyntheticStore } from "./fixtures";
import { renderWithApp } from "./renderWithApp";
import { S10CohortTracking } from "../views/sections/S10CohortTracking";

let store: Store;
beforeAll(async () => {
  store = await buildSyntheticStore();
});

describe("1-1 counts beside percentages", () => {
  it("shows the net student count beside the headline NAS / Meeting+ deltas", () => {
    renderWithApp(<S10CohortTracking />, { store });
    // netCountLabel renders one of these phrasings beside each pp delta.
    expect(screen.getAllByText(/\d+ (fewer|more) (at NAS|Meeting\+)|no net change/).length).toBeGreaterThan(0);
  });
});

describe("1-2 quantified attrition sentence", () => {
  it("renders the baseline-composition sentence under the attrition table", () => {
    renderWithApp(<S10CohortTracking />, { store });
    expect(screen.getByText(/Baseline composition:/)).toBeInTheDocument();
    expect(screen.getByText(/not a corrected\s+headline/)).toBeInTheDocument();
  });
});

describe("1-3 detectability note", () => {
  it("renders the best-case detectability floor near the McNemar result", () => {
    renderWithApp(<S10CohortTracking />, { store });
    // n=5 synthetic cohort is below the 6-mover floor → infeasible wording.
    expect(screen.getByText(/even in the best case/)).toBeInTheDocument();
    expect(screen.getByText(/at least 6 students/)).toBeInTheDocument();
  });
});

describe("1-4 improved list", () => {
  it("renders the recognition list of students who moved up a band", () => {
    renderWithApp(<S10CohortTracking />, { store });
    expect(screen.getByText(/students who improved/i)).toBeInTheDocument();
    // synthetic Reading cohort has 3 improvers.
    expect(screen.getAllByText(/Up a band|Moved out of NAS/).length).toBeGreaterThan(0);
  });
});
