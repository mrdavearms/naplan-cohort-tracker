/**
 * UI smoke tests: every section view + Home + Settings + the match-rate banner
 * renders against a real (synthetic) store without throwing, and shows its
 * headline content. This is the automated stand-in for clicking through the
 * packaged app — it exercises the core→view wiring for all 10 sections.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { buildCohortPairings, type Store } from "@naplan-throughline/core";
import { buildSyntheticStore } from "./fixtures";
import { renderWithApp } from "./renderWithApp";

import { HomeView } from "../views/HomeView";
import { SettingsView } from "../views/SettingsView";
import { MatchRateBanner } from "../components/MatchRateBanner";
import { S1Participation } from "../views/sections/S1Participation";
import { S2Proficiency } from "../views/sections/S2Proficiency";
import { S3YearOnYear } from "../views/sections/S3YearOnYear";
import { S4CrossDomain } from "../views/sections/S4CrossDomain";
import { S5SkillGaps } from "../views/sections/S5SkillGaps";
import { S6Equity } from "../views/sections/S6Equity";
import { S7ClassGroups } from "../views/sections/S7ClassGroups";
import { S8TargetedSupport } from "../views/sections/S8TargetedSupport";
import { S9Narrative } from "../views/sections/S9Narrative";
import { S10CohortTracking } from "../views/sections/S10CohortTracking";
import { CrossDomainOverview } from "../components/CrossDomainOverview";

let store: Store;
beforeAll(async () => {
  store = await buildSyntheticStore();
});

describe("section views render with data", () => {
  const cases: [string, () => React.ReactElement, RegExp][] = [
    ["S1 Participation", () => <S1Participation />, /participation/i],
    ["S2 Proficiency", () => <S2Proficiency />, /proficiency/i],
    ["S3 Year-on-year", () => <S3YearOnYear />, /year-on-year/i],
    ["S4 Cross-domain", () => <S4CrossDomain />, /cross-domain/i],
    ["S5 Skill gaps", () => <S5SkillGaps />, /skill gap/i],
    ["S6 Equity", () => <S6Equity />, /equity/i],
    ["S7 Class groups", () => <S7ClassGroups />, /class group/i],
    ["S8 Targeted support", () => <S8TargetedSupport />, /targeted support/i],
    ["S9 Narrative", () => <S9Narrative />, /narrative/i],
    ["S10 Cohort tracking", () => <S10CohortTracking />, /cohort tracking/i],
  ];

  for (const [name, render, expected] of cases) {
    it(`${name} renders its heading`, () => {
      renderWithApp(render(), { store });
      expect(screen.getAllByText(expected).length).toBeGreaterThan(0);
    });
  }
});

describe("shell views", () => {
  it("Home overview renders with the match-rate and stats", () => {
    renderWithApp(<HomeView />, { store });
    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getAllByText(/datasets/i).length).toBeGreaterThan(0);
  });

  it("Settings renders the school-identity form (neutral by default)", () => {
    renderWithApp(<SettingsView />, { store, view: "settings" });
    expect(screen.getByRole("heading", { name: /School identity/i })).toBeInTheDocument();
    const nameInput = screen.getByLabelText(/School name/i) as HTMLInputElement;
    expect(nameInput.value).toBe(""); // blank install = neutral, no WHS
  });

  it("MatchRateBanner shows the matched count for the synthetic Reading cohort", () => {
    renderWithApp(<MatchRateBanner store={store} primaryYear={2026} />, { store });
    expect(screen.getByText(/Matched/i)).toBeInTheDocument();
  });
});

describe("cross-domain overview", () => {
  it("renders the overview against the synthetic cohort without throwing", () => {
    const pairings = buildCohortPairings(store, 2026);
    renderWithApp(<CrossDomainOverview pairings={pairings} />, { store });
    expect(screen.getByText(/Across all domains/i)).toBeInTheDocument();
    expect(screen.getByText(/Band movement/i)).toBeInTheDocument();
  });
});

describe("Section 10 per-domain additions", () => {
  it("renders movement, subdomains and the follow-up list for the synthetic cohort", () => {
    renderWithApp(<S10CohortTracking />, { store });
    expect(screen.getAllByText(/band movement/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/students to follow up/i).length).toBeGreaterThan(0);
  });
});
