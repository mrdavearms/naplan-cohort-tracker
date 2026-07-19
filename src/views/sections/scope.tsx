/**
 * Shared scope controls for single-year sections (1–8): a year-level tab
 * selector (Year 3/5 for primary, Year 7/9 for secondary), plus the NAPLAN
 * attribution framing that must accompany each year level (CLAUDE.md). The
 * per-level wording lives in core's `attributionNote` so it stays correct for
 * primary (Year 3 baseline / Year 5 contribution) and secondary alike.
 */
import { useMemo, useState } from "react";
import { attributionNote, storeEntries, yearLevelsFor, type Store } from "@naplan-cohort-tracker/core";
import clsx from "clsx";
import { useApp } from "../../state/AppState";

/** Year levels present for the primary year, defaulting selection to Year 9. */
export function useYearLevel(store: Store, primaryYear: number) {
  const yearLevels = useMemo(() => yearLevelsFor(store, primaryYear), [store, primaryYear]);
  const [yearLevel, setYearLevel] = useState<number>(() => yearLevels.at(-1) ?? 9);
  // keep selection valid if the available levels change
  const effective = yearLevels.includes(yearLevel) ? yearLevel : (yearLevels.at(-1) ?? 9);
  return { yearLevels, yearLevel: effective, setYearLevel };
}

export function YearLevelTabs({
  yearLevels,
  value,
  onChange,
}: {
  yearLevels: number[];
  value: number;
  onChange: (y: number) => void;
}) {
  if (yearLevels.length <= 1) return null;
  return (
    <div className="mb-4 inline-flex rounded-xl border border-alabaster bg-white/60 p-1">
      {yearLevels.map((y) => (
        <button
          key={y}
          type="button"
          onClick={() => onChange(y)}
          className={clsx(
            "rounded-lg px-4 py-1.5 text-sm font-medium transition",
            value === y ? "bg-coral text-white shadow-sm" : "text-graphite/70 hover:text-graphite",
          )}
        >
          Year {y}
        </button>
      ))}
    </div>
  );
}

/** The attribution caveat for the selected year level. Reads the store directly
 *  so every call site stays unchanged: the Year 7 wording depends on whether
 *  this school also teaches primary (a combined P–12), which is a property of
 *  the loaded data, not of the calling section. */
export function AttributionNote({ yearLevel, year }: { yearLevel: number; year: number }) {
  const { state } = useApp();
  const schoolHasPrimaryLevels = useMemo(
    () => storeEntries(state.store).some((e) => e.yearLevel <= 5),
    [state.store],
  );
  return (
    <p className="mb-4 rounded-lg border border-alabaster bg-linen/50 px-3 py-2 text-xs text-graphite/70">
      {attributionNote(yearLevel, year, { schoolHasPrimaryLevels })}
    </p>
  );
}
