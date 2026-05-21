/**
 * Section 1 — Participation. Per domain (for the selected year level): how many
 * students participated vs were absent/withdrawn, and the participation rate.
 * Absent/Withdrawn students are kept in participation analytics (excluded only
 * from proficiency analytics elsewhere).
 */
import {
  domainsFor,
  getEntry,
  participationBreakdown,
  participationSummary,
} from "@naplan-throughline/core";
import { useApp } from "../../state/AppState";
import { Card, EmptyState, SectionHeading } from "../../components/ui";
import { AttributionNote, useYearLevel, YearLevelTabs } from "./scope";

export function S1Participation() {
  const { state } = useApp();
  const store = state.store;
  const primaryYear = state.primaryYear!;
  const { yearLevels, yearLevel, setYearLevel } = useYearLevel(store, primaryYear);

  const domains = domainsFor(store, primaryYear, yearLevel);

  return (
    <div>
      <SectionHeading number={1} title="Participation" blurb={`Who sat the test — ${primaryYear} Year ${yearLevel}.`} />
      <YearLevelTabs yearLevels={yearLevels} value={yearLevel} onChange={setYearLevel} />
      <AttributionNote yearLevel={yearLevel} year={primaryYear} />

      {domains.length === 0 ? (
        <EmptyState title="No data for this year level" />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-alabaster text-left text-xs uppercase tracking-wide text-graphite/50">
                <th className="py-2">Domain</th>
                <th className="py-2 text-right">Participated</th>
                <th className="py-2 text-right">Absent</th>
                <th className="py-2 text-right">Withdrawn</th>
                <th className="py-2 text-right">Total</th>
                <th className="py-2 text-right">Rate</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((dom) => {
                const reports = getEntry(store, primaryYear, yearLevel, dom)!.studentReports;
                const b = participationBreakdown(reports);
                const s = participationSummary(reports);
                return (
                  <tr key={dom} className="border-b border-alabaster/60 last:border-0">
                    <td className="py-2 font-medium text-graphite">{dom}</td>
                    <td className="py-2 text-right tabular-nums">{b.participated}</td>
                    <td className="py-2 text-right tabular-nums text-graphite/70">{b.absent}</td>
                    <td className="py-2 text-right tabular-nums text-graphite/70">{b.withdrawn}</td>
                    <td className="py-2 text-right tabular-nums">{s.total}</td>
                    <td className="py-2 text-right font-medium tabular-nums">{s.rate.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
