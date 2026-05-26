/**
 * Section 7 — Class groups. The proficiency-level mix (NAS → Developing →
 * Strong → Exceeding) for each class group, per domain, for the selected year
 * level. Class groups with fewer than 5 participating students are suppressed
 * from the chart and ranking to protect privacy (CLAUDE.md, n < 5); their names
 * are listed separately with a suppression note. Students with no proficiency
 * (Absent/Withdrawn) are excluded from these percentages (handled in core).
 */
import { useState } from "react";
import {
  classDistribution,
  domainsFor,
  getEntry,
  stackedProficiencyBarFigure,
  type StackedBarRow,
} from "@naplan-cohort-tracker/core";
import { useApp } from "../../state/AppState";
import { Card, EmptyState, PrivacyNote, SectionHeading } from "../../components/ui";
import { Chart } from "../../components/Chart";
import { AttributionNote, useYearLevel, YearLevelTabs } from "./scope";
import clsx from "clsx";

const NAS = "Needs additional support";

export function S7ClassGroups() {
  const { state } = useApp();
  const store = state.store;
  const primaryYear = state.primaryYear!;
  const { yearLevels, yearLevel, setYearLevel } = useYearLevel(store, primaryYear);
  const domains = domainsFor(store, primaryYear, yearLevel);

  const [domain, setDomain] = useState<string>(() => domains[0] ?? "");
  // keep the domain selection valid if the available domains change
  const activeDomain = domains.includes(domain) ? domain : (domains[0] ?? "");

  const entry = activeDomain ? getEntry(store, primaryYear, yearLevel, activeDomain) : undefined;
  const groups = entry ? classDistribution(entry.studentReports) : [];

  const shown = groups.filter((g) => g.n >= 5);
  const small = groups.filter((g) => g.n < 5);

  const rows: StackedBarRow[] = shown.map((g) => ({
    label: `${g.classGroup} (n=${g.n})`,
    percentages: g.percentages,
  }));

  const chartHeight = Math.max(220, 90 + rows.length * 46);

  return (
    <div>
      <SectionHeading
        number={7}
        title="Class groups"
        blurb={`Proficiency mix by class group — ${primaryYear} Year ${yearLevel}.`}
      />
      <YearLevelTabs yearLevels={yearLevels} value={yearLevel} onChange={setYearLevel} />
      <AttributionNote yearLevel={yearLevel} year={primaryYear} />

      {domains.length === 0 ? (
        <EmptyState title="No data for this year level" />
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-graphite/70">
            How each class group is spread across the four proficiency levels for the chosen domain.
            This helps spot where particular classes are concentrated at the lower or higher levels,
            so support and extension can be targeted.
          </p>

          <div className="inline-flex flex-wrap gap-2">
            {domains.map((dom) => (
              <button
                key={dom}
                type="button"
                onClick={() => setDomain(dom)}
                className={clsx(
                  "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                  dom === activeDomain
                    ? "border-coral bg-coral text-white shadow-sm"
                    : "border-alabaster bg-white/60 text-graphite/70 hover:text-graphite",
                )}
              >
                {dom}
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <EmptyState title="No class group has enough students to show">
              Every class group for {activeDomain} has fewer than 5 participating students, so the
              chart is suppressed to protect privacy.
            </EmptyState>
          ) : (
            <>
              <Card>
                <Chart
                  figure={stackedProficiencyBarFigure(rows, {
                    title: `${primaryYear} Year ${yearLevel} ${activeDomain} — proficiency by class group`,
                    xTitle: "% of participating students",
                    height: chartHeight,
                  })}
                  height={chartHeight}
                />
              </Card>

              <Card>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-alabaster text-left text-xs uppercase tracking-wide text-graphite/50">
                      <th className="py-2">Class group</th>
                      <th className="py-2 text-right">n</th>
                      <th className="py-2 text-right">NAS%</th>
                      <th className="py-2 text-right">Strong+Exceeding%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((g) => {
                      const strongPlus = g.percentages.Strong + g.percentages.Exceeding;
                      return (
                        <tr key={g.classGroup} className="border-b border-alabaster/60 last:border-0">
                          <td className="py-2 font-medium text-graphite">{g.classGroup}</td>
                          <td className="py-2 text-right tabular-nums">{g.n}</td>
                          <td className="py-2 text-right tabular-nums">
                            {g.percentages[NAS].toFixed(0)}%
                          </td>
                          <td className="py-2 text-right tabular-nums">{strongPlus.toFixed(0)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            </>
          )}

          {small.length > 0 && (
            <Card>
              <div className="text-xs font-medium uppercase tracking-wide text-graphite/50">
                Suppressed class groups
              </div>
              <p className="mt-2 text-sm text-graphite/70">
                {small.map((g) => `${g.classGroup} (n=${g.n})`).join(", ")} — excluded from the
                chart and table to protect privacy.
              </p>
            </Card>
          )}

          <PrivacyNote>
            Class groups with fewer than 5 participating students are suppressed from the chart and
            ranking, and their proficiency breakdown is not shown.
          </PrivacyNote>
        </div>
      )}
    </div>
  );
}
