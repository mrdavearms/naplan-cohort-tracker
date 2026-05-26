/**
 * Shared scope controls for single-year sections (1–8): a Year 7 / Year 9 tab
 * selector, plus the NAPLAN attribution framing that must accompany any Year-7
 * view (CLAUDE.md). Year 7 reflects PRIMARY-school output (feeder cohorts);
 * Year 9 reflects the secondary school's contribution.
 */
import { useMemo, useState } from "react";
import { yearLevelsFor, type Store } from "@naplan-cohort-tracker/core";
import clsx from "clsx";

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

/** The attribution caveat for the selected year level. */
export function AttributionNote({ yearLevel, year }: { yearLevel: number; year: number }) {
  const text =
    yearLevel === 7
      ? `Year 7 NAPLAN is sat in Term 1 — it reflects students' primary-school learning, not this school's teaching. Treat ${year} Year 7 results as feeder-cohort intake, not a measure of the school improving or declining.`
      : `Year 9 reflects the secondary school's contribution (the cohort has had ~2 years here). NAPLAN is diagnostic evidence to inform planning, not a target-measurement instrument.`;
  return (
    <p className="mb-4 rounded-lg border border-alabaster bg-linen/50 px-3 py-2 text-xs text-graphite/70">
      {text}
    </p>
  );
}
