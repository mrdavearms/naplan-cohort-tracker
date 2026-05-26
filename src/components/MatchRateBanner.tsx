/**
 * The visible Y7↔Y9 ID match-rate banner — makes the most common "looks broken"
 * case (Local Student IDs that don't reconcile across years) self-diagnosing.
 * Keying is on Local student ID (with the {PSI}* fallback), never the VCAA PSI.
 */
import { useMemo } from "react";
import { ArrowsRightLeftIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import {
  buildCohortPairings,
  cohortMatchRate,
  cohortYears,
  type Store,
} from "@naplan-cohort-tracker/core";

export function MatchRateBanner({ store, primaryYear }: { store: Store; primaryYear: number }) {
  const [y7Year, y9Year] = cohortYears(primaryYear);
  const pairings = useMemo(() => buildCohortPairings(store, primaryYear), [store, primaryYear]);

  if (pairings.size === 0) {
    return (
      <div className="rounded-2xl border border-alabaster bg-white/70 p-4 text-sm text-graphite/70">
        No matched Y7→Y9 cohort for {y9Year}. Cohort tracking needs a Year 7 file from{" "}
        <strong>{y7Year}</strong> and a Year 9 file from <strong>{y9Year}</strong> in the same folder.
      </div>
    );
  }

  const mr = cohortMatchRate(pairings);
  const low = mr.matchRatePct < 50;

  return (
    <div
      className={
        "rounded-2xl border p-4 " +
        (low ? "border-coral/40 bg-coral/5" : "border-sage/40 bg-sage-bg")
      }
    >
      <div className="flex items-start gap-3">
        {low ? (
          <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-coral-text" />
        ) : (
          <ArrowsRightLeftIcon className="mt-0.5 h-5 w-5 shrink-0 text-sage-text" />
        )}
        <div className="text-sm">
          <p className="font-medium text-graphite">
            Matched <strong>{mr.matched}</strong> of <strong>{mr.y9CohortTotal}</strong>{" "}
            Year 9 students back to their Year 7 record ({mr.matchRatePct.toFixed(0)}%).
          </p>
          <p className="mt-1 text-graphite/70">
            Tracking the same students from Year 7 ({y7Year}) to Year 9 ({y9Year}).{" "}
            {mr.leavers} left after Year 7 · {mr.joiners} joined after Year 7
            {mr.filtered > 0 ? ` · ${mr.filtered} excluded (no result one year)` : ""}.
          </p>
          {low && (
            <p className="mt-1 text-coral-text">
              A low match rate usually means the Local Student IDs don’t reconcile across years —
              check the two files cover the same cohort.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
