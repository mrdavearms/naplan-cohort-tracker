/**
 * Section 3 — Year-on-year. How the "Needs additional support" (NAS) band has
 * moved across the available test years, for a chosen year level + domain.
 * Ported from the legacy s3_aip_target. Lower NAS is better, so a falling NAS
 * count counts as "improved".
 *
 * Framing caveat: for Year 7 this is FEEDER-COHORT variation — different
 * students each year, not the school improving or declining. For Year 9 it
 * reflects the school's contribution but is still a different cohort each year
 * (tracking one cohort Y7→Y9 is Section 10).
 */
import { useMemo, useState } from "react";
import {
  availableYears,
  domainsFor,
  getEntry,
  nasSummary,
  yearOnYearNas,
  type YearOnYearPoint,
} from "@naplan-cohort-tracker/core";
import { useApp } from "../../state/AppState";
import { Card, EmptyState, Pill, SectionHeading, StatTile } from "../../components/ui";
import { AttributionNote, useYearLevel, YearLevelTabs } from "./scope";
import clsx from "clsx";

export function S3YearOnYear() {
  const { state } = useApp();
  const store = state.store;
  const primaryYear = state.primaryYear!;
  const { yearLevels, yearLevel, setYearLevel } = useYearLevel(store, primaryYear);

  // Domains available for the primary year at the selected year level.
  const domains = useMemo(
    () => domainsFor(store, primaryYear, yearLevel),
    [store, primaryYear, yearLevel],
  );

  const [domain, setDomain] = useState<string>(() => domains[0] ?? "");
  // Keep the selected domain valid if the available list changes.
  const activeDomain = domains.includes(domain) ? domain : (domains[0] ?? "");

  // Build the NAS history across ALL test years for (yearLevel, activeDomain).
  const change = useMemo(() => {
    const history: YearOnYearPoint[] = [];
    for (const year of availableYears(store)) {
      const entry = getEntry(store, year, yearLevel, activeDomain);
      if (!entry) continue;
      history.push({ year, summary: nasSummary(entry.studentReports) });
    }
    return yearOnYearNas(history);
  }, [store, yearLevel, activeDomain]);

  const { history, status, countDelta, pctDelta } = change;

  return (
    <div>
      <SectionHeading
        number={3}
        title="Year-on-year"
        blurb={`How the "Needs additional support" band has moved across years — Year ${yearLevel}.`}
      />
      <YearLevelTabs yearLevels={yearLevels} value={yearLevel} onChange={setYearLevel} />
      <AttributionNote yearLevel={yearLevel} year={primaryYear} />

      {yearLevel === 7 ? (
        <p className="mb-4 rounded-lg border border-alabaster bg-linen/50 px-3 py-2 text-xs text-graphite/70">
          Each year shown is a different group of students arriving from primary
          school. Treat any movement here as feeder-cohort variation, not the
          school improving or declining.
        </p>
      ) : (
        <p className="mb-4 rounded-lg border border-alabaster bg-linen/50 px-3 py-2 text-xs text-graphite/70">
          Each year shown is a different Year 9 cohort, not the same students
          tracked over time. To follow one cohort from Year 7 to Year 9, see
          Section 10.
        </p>
      )}

      {domains.length === 0 ? (
        <EmptyState title="No data for this year level" />
      ) : (
        <div className="space-y-6">
          <DomainSelector domains={domains} value={activeDomain} onChange={setDomain} />

          {status === "no_data" ? (
            <EmptyState title="Only one year of data is loaded">
              There's nothing to compare yet — load another year's files to see
              how the NAS band has moved.
            </EmptyState>
          ) : (
            <Card>
              <div className="flex flex-wrap items-center gap-3">
                <StatTile
                  label={`NAS change — Year ${yearLevel} ${activeDomain}`}
                  value={<HeadlineValue countDelta={countDelta} pctDelta={pctDelta} />}
                  sub={`${history[0]!.year} → ${history[history.length - 1]!.year}`}
                />
                <StatusPill status={status} />
              </div>
            </Card>
          )}

          <Card>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-alabaster text-left text-xs uppercase tracking-wide text-graphite/50">
                  <th className="py-2">Year</th>
                  <th className="py-2 text-right">Participants</th>
                  <th className="py-2 text-right">NAS count</th>
                  <th className="py-2 text-right">NAS%</th>
                </tr>
              </thead>
              <tbody>
                {history.map((p) => (
                  <tr key={p.year} className="border-b border-alabaster/60 last:border-0">
                    <td className="py-2 font-medium text-graphite">{p.year}</td>
                    <td className="py-2 text-right tabular-nums">{p.summary.participants}</td>
                    <td className="py-2 text-right tabular-nums">{p.summary.nasCount}</td>
                    <td className="py-2 text-right font-medium tabular-nums">
                      {p.summary.nasPct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}

/** A row of domain toggle buttons, matching the Settings domain-toggle style. */
function DomainSelector({
  domains,
  value,
  onChange,
}: {
  domains: string[];
  value: string;
  onChange: (d: string) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl border border-alabaster bg-white/60 p-1">
      {domains.map((dom) => (
        <button
          key={dom}
          type="button"
          onClick={() => onChange(dom)}
          className={clsx(
            "rounded-lg px-4 py-1.5 text-sm font-medium transition",
            value === dom ? "bg-coral text-white shadow-sm" : "text-graphite/70 hover:text-graphite",
          )}
        >
          {dom}
        </button>
      ))}
    </div>
  );
}

/** Plain-language headline: NAS down/up by N students, +/- pp (down is good). */
function HeadlineValue({
  countDelta,
  pctDelta,
}: {
  countDelta: number | null;
  pctDelta: number | null;
}) {
  if (countDelta == null || pctDelta == null) return <>No comparison</>;
  if (countDelta === 0) {
    return (
      <>
        No change <span className="text-base font-normal text-graphite/60">({signedPp(pctDelta)})</span>
      </>
    );
  }
  const direction = countDelta < 0 ? "down" : "up";
  const students = Math.abs(countDelta);
  return (
    <>
      NAS {direction} {students} {students === 1 ? "student" : "students"}{" "}
      <span className="text-base font-normal text-graphite/60">({signedPp(pctDelta)})</span>
    </>
  );
}

/** Coloured status pill — improved (NAS fell) is sage, worsened is coral. */
function StatusPill({ status }: { status: "improved" | "flat" | "worsened" | "no_data" }) {
  const map = {
    improved: { tone: "sage" as const, label: "Improved — NAS fell" },
    worsened: { tone: "coral" as const, label: "Worsened — NAS rose" },
    flat: { tone: "neutral" as const, label: "Broadly flat" },
    no_data: { tone: "neutral" as const, label: "Not enough data" },
  };
  const { tone, label } = map[status];
  return <Pill tone={tone}>{label}</Pill>;
}

/** Format a percentage-point delta with an explicit sign, e.g. "-3.2pp". */
function signedPp(pctDelta: number): string {
  const sign = pctDelta > 0 ? "+" : "";
  return `${sign}${pctDelta.toFixed(1)}pp`;
}
