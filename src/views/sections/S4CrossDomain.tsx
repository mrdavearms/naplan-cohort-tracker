/**
 * Section 4 — Cross-domain. Which domains carry the highest need for the
 * selected year level, ranked weakest-first by the share of students needing
 * additional support (NAS %). The table also shows the "meeting" side
 * (Strong + Exceeding %) so the reader sees need and strength together.
 */
import {
  domainsFor,
  getEntry,
  proficiencyPercentages,
  rankDomainsByNas,
  type ProficiencyPercentages,
} from "@naplan-cohort-tracker/core";
import { useApp } from "../../state/AppState";
import { Card, EmptyState, Pill, SectionHeading } from "../../components/ui";
import { AttributionNote, useYearLevel, YearLevelTabs } from "./scope";

export function S4CrossDomain() {
  const { state } = useApp();
  const store = state.store;
  const primaryYear = state.primaryYear!;
  const { yearLevels, yearLevel, setYearLevel } = useYearLevel(store, primaryYear);

  const domains = domainsFor(store, primaryYear, yearLevel);

  const perDomainPercentages: Record<string, ProficiencyPercentages> = {};
  for (const dom of domains) {
    perDomainPercentages[dom] = proficiencyPercentages(
      getEntry(store, primaryYear, yearLevel, dom)!.studentReports,
    );
  }
  const ranked = rankDomainsByNas(perDomainPercentages);
  const weakest = ranked[0]?.domain;

  return (
    <div>
      <SectionHeading
        number={4}
        title="Cross-domain"
        blurb={`Where the highest need sits — ${primaryYear} Year ${yearLevel}.`}
      />
      <YearLevelTabs yearLevels={yearLevels} value={yearLevel} onChange={setYearLevel} />
      <AttributionNote yearLevel={yearLevel} year={primaryYear} />

      {domains.length === 0 ? (
        <EmptyState title="No data for this year level" />
      ) : (
        <div className="space-y-6">
          {weakest && (
            <p className="text-sm text-graphite/70">
              Across {primaryYear} Year {yearLevel}, {weakest} has the highest proportion of
              students needing additional support.
            </p>
          )}

          <Card>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-alabaster text-left text-xs uppercase tracking-wide text-graphite/50">
                  <th className="py-2">Rank</th>
                  <th className="py-2">Domain</th>
                  <th className="py-2 text-right">NAS %</th>
                  <th className="py-2 text-right">Meeting % (Strong + Exceeding)</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((row, i) => {
                  const pct = perDomainPercentages[row.domain]!;
                  const meeting = pct["Strong"] + pct["Exceeding"];
                  return (
                    <tr key={row.domain} className="border-b border-alabaster/60 last:border-0">
                      <td className="py-2 tabular-nums text-graphite/60">{i + 1}</td>
                      <td className="py-2 font-medium text-graphite">
                        {row.domain}
                        {i === 0 && (
                          <span className="ml-2">
                            <Pill tone="coral">highest need</Pill>
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-right font-medium tabular-nums">
                        {row.nasPct.toFixed(1)}%
                      </td>
                      <td className="py-2 text-right tabular-nums text-graphite/70">
                        {meeting.toFixed(1)}%
                      </td>
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
