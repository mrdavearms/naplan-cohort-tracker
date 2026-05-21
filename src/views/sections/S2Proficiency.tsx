/**
 * Section 2 — Proficiency. The proficiency-level mix per domain for the selected
 * year level, as a stacked bar (NAS → Developing → Strong → Exceeding) plus a
 * counts table. Students with no proficiency (Absent/Withdrawn) are excluded
 * from these percentages (handled in core).
 */
import {
  domainsFor,
  getEntry,
  proficiencyCounts,
  proficiencyPercentages,
  PROFICIENCY_LEVELS,
  stackedProficiencyBarFigure,
  type StackedBarRow,
} from "@naplan-throughline/core";
import { useApp } from "../../state/AppState";
import { Card, EmptyState, SectionHeading } from "../../components/ui";
import { Chart } from "../../components/Chart";
import { AttributionNote, useYearLevel, YearLevelTabs } from "./scope";

export function S2Proficiency() {
  const { state } = useApp();
  const store = state.store;
  const primaryYear = state.primaryYear!;
  const { yearLevels, yearLevel, setYearLevel } = useYearLevel(store, primaryYear);
  const domains = domainsFor(store, primaryYear, yearLevel);

  const rows: StackedBarRow[] = domains.map((dom) => {
    const reports = getEntry(store, primaryYear, yearLevel, dom)!.studentReports;
    return { label: dom, percentages: proficiencyPercentages(reports) };
  });

  const figure = stackedProficiencyBarFigure(rows, {
    title: `${primaryYear} Year ${yearLevel} — proficiency mix by domain`,
    xTitle: "% of participating students",
    height: Math.max(220, 90 + rows.length * 60),
  });

  return (
    <div>
      <SectionHeading number={2} title="Proficiency" blurb={`Proficiency-level mix — ${primaryYear} Year ${yearLevel}.`} />
      <YearLevelTabs yearLevels={yearLevels} value={yearLevel} onChange={setYearLevel} />
      <AttributionNote yearLevel={yearLevel} year={primaryYear} />

      {domains.length === 0 ? (
        <EmptyState title="No data for this year level" />
      ) : (
        <div className="space-y-6">
          <Card>
            <Chart figure={figure} height={Math.max(220, 90 + rows.length * 60)} />
          </Card>

          <Card>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-alabaster text-left text-xs uppercase tracking-wide text-graphite/50">
                  <th className="py-2">Domain</th>
                  {PROFICIENCY_LEVELS.map((lvl) => (
                    <th key={lvl} className="py-2 text-right">
                      {lvl === "Needs additional support" ? "NAS" : lvl}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {domains.map((dom) => {
                  const reports = getEntry(store, primaryYear, yearLevel, dom)!.studentReports;
                  const counts = proficiencyCounts(reports);
                  const pct = proficiencyPercentages(reports);
                  return (
                    <tr key={dom} className="border-b border-alabaster/60 last:border-0">
                      <td className="py-2 font-medium text-graphite">{dom}</td>
                      {PROFICIENCY_LEVELS.map((lvl) => (
                        <td key={lvl} className="py-2 text-right tabular-nums">
                          {counts[lvl]}{" "}
                          <span className="text-graphite/50">({pct[lvl].toFixed(0)}%)</span>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}
