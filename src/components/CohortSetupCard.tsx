/**
 * "Cohort tracking setup" — the post-load summary that makes a half-loaded
 * cohort self-diagnosing. Two clearly separated groups:
 *   1. Ready to analyse — the complete cohort(s) the user can work with now
 *      (prominent, positive), with a jump into Section 10.
 *   2. Other files you've loaded — the half-loaded ones, as calm context.
 *
 * The missing-file wording is time-aware: a cohort whose exit year is still in
 * the FUTURE can't be completed (the later year hasn't been sat yet), so we say
 * so rather than telling the user to "add" a file that can't exist. `currentYear`
 * is injected (defaults to the real year) so tests stay deterministic.
 */
import type { ReactNode } from "react";
import { CheckCircleIcon, ExclamationTriangleIcon, FolderOpenIcon } from "@heroicons/react/24/outline";
import { Card } from "./ui";
import type { CohortReadiness } from "@naplan-cohort-tracker/core";

/** The plain-English line for one half-loaded cohort. */
function incompleteMessage(r: CohortReadiness, currentYear: number): ReactNode {
  const earlier = `Year ${r.phase.earlier} (${r.earlierYear})`;
  const later = `Year ${r.phase.later} (${r.laterYear})`;
  const cohort = `Year ${r.phase.earlier} → ${r.phase.later}`;

  // hasEarlier === true means the LATER (exit) file is the one missing.
  if (r.hasEarlier) {
    if (r.laterYear > currentYear) {
      // The exit year is in the future — it simply hasn't been sat yet.
      return (
        <>
          You've loaded <strong>{earlier}</strong> — its matching <strong>{later}</strong> hasn't been
          sat yet.
        </>
      );
    }
    return (
      <>
        You've loaded <strong>{earlier}</strong> — add the <strong>{later}</strong> file to track this{" "}
        {cohort} cohort.
      </>
    );
  }
  // The EARLIER (entry) file is missing — always a past year, so it's addable.
  return (
    <>
      You've loaded <strong>{later}</strong> — add the <strong>{earlier}</strong> file to track this{" "}
      {cohort} cohort.
    </>
  );
}

export function CohortSetupCard({
  readiness,
  currentYear = new Date().getFullYear(),
  onEdit,
  onViewTracking,
}: {
  readiness: CohortReadiness[];
  /** Reference year for the future/past wording (injectable for tests). */
  currentYear?: number;
  onEdit: () => void;
  onViewTracking: () => void;
}) {
  const ready = readiness.filter((r) => r.complete);
  const incomplete = readiness.filter((r) => !r.complete);
  const hasReady = ready.length > 0;

  return (
    <Card>
      <h2 className="text-lg font-semibold text-graphite">Cohort tracking setup</h2>

      {readiness.length === 0 && (
        <p className="mt-2 text-sm text-graphite/70">
          No two-year cohort yet. Add an entry-year file and its exit-year file two years apart — for
          example Year 7 (2024) with Year 9 (2026). Sections 1–9 still work with single-year data.
        </p>
      )}

      {/* 1. Ready to analyse — prominent, positive. */}
      {hasReady && (
        <div className="mt-3 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-sage-text">Ready to analyse</h3>
          {ready.map((r, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-xl border border-sage/40 bg-sage-bg p-3 text-sm"
            >
              <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-sage-text" />
              <div className="flex-1">
                <p className="text-graphite">
                  <strong>
                    Year {r.phase.earlier} ({r.earlierYear}) → Year {r.phase.later} ({r.laterYear})
                  </strong>{" "}
                  — the same students two years apart.
                </p>
                <button
                  type="button"
                  onClick={onViewTracking}
                  className="mt-1 text-xs font-medium text-coral-text hover:underline"
                >
                  View cohort tracking →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. Other loaded files — calm context (or the primary prompt if nothing is ready). */}
      {incomplete.length > 0 && (
        <div className="mt-4 space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-graphite/50">
            {hasReady
              ? "Other files you've loaded — for your information"
              : "To start tracking a cohort, add the missing file"}
          </h3>
          <ul className="space-y-1.5 text-sm">
            {incomplete.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-graphite/70">
                <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-tuscan-dark" />
                <span>{incompleteMessage(r, currentYear)}</span>
              </li>
            ))}
          </ul>
          <p className="pt-0.5 text-xs text-graphite/55">
            {hasReady
              ? "Add a missing file via Edit imported files, or ignore these — they don't affect the analysis above."
              : "Add the missing file via Edit imported files to start tracking a cohort."}
          </p>
          <button
            type="button"
            onClick={onEdit}
            className="mt-1 inline-flex items-center gap-2 rounded-lg border border-tuscan/50 bg-white/70 px-3 py-1.5 text-xs font-medium text-graphite hover:bg-white"
          >
            <FolderOpenIcon className="h-4 w-4 text-graphite/60" />
            Edit imported files
          </button>
        </div>
      )}
    </Card>
  );
}
