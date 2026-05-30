/** CohortSetupCard: ready/incomplete grouping + the future-vs-past wording.
 *  Pure presentational component — rendered directly with crafted readiness and
 *  a fixed `currentYear` so the time-aware wording is deterministic. */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CohortSetupCard } from "../components/CohortSetupCard";
import type { CohortReadiness } from "@naplan-cohort-tracker/core";

const sec = { phase: "secondary" as const, earlier: 7, later: 9 };
const noop = () => {};

const ready: CohortReadiness = {
  phase: sec, earlierYear: 2024, laterYear: 2026, hasEarlier: true, hasLater: true, complete: true,
};
// Loaded Year 7 (2026); its Year 9 partner is 2028 — the future.
const missingFuture: CohortReadiness = {
  phase: sec, earlierYear: 2026, laterYear: 2028, hasEarlier: true, hasLater: false, complete: false,
};
// Loaded Year 9 (2024); its Year 7 entry (2022) is a past, addable file.
const missingPast: CohortReadiness = {
  phase: sec, earlierYear: 2022, laterYear: 2024, hasEarlier: false, hasLater: true, complete: false,
};

describe("CohortSetupCard", () => {
  it("puts a complete cohort under 'Ready to analyse' with a jump link", () => {
    render(<CohortSetupCard readiness={[ready]} currentYear={2026} onEdit={noop} onViewTracking={noop} />);
    expect(screen.getByText("Ready to analyse")).toBeInTheDocument();
    expect(screen.getByText(/Year 7 \(2024\) → Year 9 \(2026\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /View cohort tracking/ })).toBeInTheDocument();
  });

  it("a FUTURE exit year says it hasn't been sat yet (never 'add the file')", () => {
    render(<CohortSetupCard readiness={[ready, missingFuture]} currentYear={2026} onEdit={noop} onViewTracking={noop} />);
    expect(screen.getByText(/hasn't been sat yet/)).toBeInTheDocument();
    // The future item must not tell the user to add a 2028 file.
    expect(screen.queryByText(/add the/)).toBeNull();
  });

  it("a PAST missing entry file is actionable ('add the … file')", () => {
    render(<CohortSetupCard readiness={[ready, missingPast]} currentYear={2026} onEdit={noop} onViewTracking={noop} />);
    expect(screen.getByText(/add the/)).toBeInTheDocument();
    expect(screen.getByText(/Year 7 \(2022\)/)).toBeInTheDocument();
  });

  it("separates ready from incomplete with the 'for your information' framing", () => {
    render(
      <CohortSetupCard readiness={[ready, missingFuture, missingPast]} currentYear={2026} onEdit={noop} onViewTracking={noop} />,
    );
    expect(screen.getByText("Ready to analyse")).toBeInTheDocument();
    expect(screen.getByText(/for your information/)).toBeInTheDocument();
  });

  it("with no ready cohort, the incomplete list becomes the primary prompt", () => {
    render(<CohortSetupCard readiness={[missingPast]} currentYear={2026} onEdit={noop} onViewTracking={noop} />);
    expect(screen.getByText(/To start tracking a cohort/)).toBeInTheDocument();
    expect(screen.queryByText(/for your information/)).toBeNull();
  });
});
