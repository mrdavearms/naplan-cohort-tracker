/**
 * Section 6 — Equity. NAS (Needs additional support) gaps for LBOTE and ATSI
 * sub-cohorts measured against the whole cohort, per (year level, domain). A
 * positive gap means the subgroup has MORE need than the cohort (worse); a
 * negative gap means less need (better). Privacy-critical: subgroups under n=5
 * are suppressed and the privacy note stays visible whether or not suppression
 * triggers. Computation lives in core (equityBreakdown); this only renders.
 */
import { useState } from "react";
import {
  domainsFor,
  equityBreakdown,
  equityHeadline,
  getEntry,
  PRIVACY_THRESHOLD,
  type EquityBreakdown,
  type EquitySubgroup,
} from "@naplan-cohort-tracker/core";
import { useApp } from "../../state/AppState";
import { Card, EmptyState, Pill, PrivacyNote, SectionHeading, StatTile } from "../../components/ui";
import { AttributionNote, useYearLevel, YearLevelTabs } from "./scope";

/** Strong + Exceeding combined, as a percentage of participating students. */
function strongPlusExceeding(group: EquitySubgroup): number {
  return group.percentages["Strong"] + group.percentages["Exceeding"];
}

/** Signed gap label, e.g. "+8 pp" (more need) or "-3 pp" (less need). */
function gapLabel(gap: number): string {
  const sign = gap > 0 ? "+" : gap < 0 ? "−" : "";
  return `${sign}${Math.abs(gap).toFixed(1)} pp`;
}

function SubgroupTable({ groups }: { groups: EquitySubgroup[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-alabaster text-left text-xs uppercase tracking-wide text-graphite/50">
          <th className="py-2">Subgroup</th>
          <th className="py-2 text-right">n</th>
          <th className="py-2 text-right">NAS%</th>
          <th className="py-2 text-right">Gap vs cohort</th>
          <th className="py-2 text-right">Strong + Exceeding%</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => {
          const gap = g.nasGapVsCohort;
          if (g.suppressed) {
            return (
              <tr key={g.label} className="border-b border-alabaster/60 last:border-0">
                <td className="py-2 font-medium text-graphite">{g.label}</td>
                <td colSpan={4} className="py-2 text-sm text-graphite/60">
                  Suppressed — fewer than {PRIVACY_THRESHOLD} students in this group.
                </td>
              </tr>
            );
          }
          return (
            <tr key={g.label} className="border-b border-alabaster/60 last:border-0">
              <td className="py-2 font-medium text-graphite">
                <span className="inline-flex items-center gap-2">
                  {g.label}
                  {g.priorityGap ? (
                    <Pill tone="coral">priority gap</Pill>
                  ) : gap < 0 ? (
                    <Pill tone="sage">ahead of cohort</Pill>
                  ) : null}
                </span>
              </td>
              <td className="py-2 text-right tabular-nums">{g.n}</td>
              <td className="py-2 text-right tabular-nums">
                {g.percentages["Needs additional support"].toFixed(0)}%
              </td>
              <td
                className={
                  "py-2 text-right font-medium tabular-nums " +
                  (gap > 0 ? "text-coral-text" : gap < 0 ? "text-sage-text" : "text-graphite/60")
                }
              >
                {gapLabel(gap)}
              </td>
              <td className="py-2 text-right tabular-nums">{strongPlusExceeding(g).toFixed(0)}%</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function S6Equity() {
  const { state } = useApp();
  const store = state.store;
  const primaryYear = state.primaryYear!;
  const { yearLevels, yearLevel, setYearLevel } = useYearLevel(store, primaryYear);

  const domains = domainsFor(store, primaryYear, yearLevel);
  const [domain, setDomain] = useState<string>(() => domains[0] ?? "");
  // keep the selected domain valid if the available list changes
  const activeDomain = domains.includes(domain) ? domain : (domains[0] ?? "");

  const entry = activeDomain
    ? getEntry(store, primaryYear, yearLevel, activeDomain)
    : undefined;
  const breakdown: EquityBreakdown | null = entry
    ? equityBreakdown(entry.studentReports)
    : null;
  const headline = breakdown ? equityHeadline(breakdown) : null;

  return (
    <div>
      <SectionHeading
        number={6}
        title="Equity"
        blurb={`How LBOTE and Indigenous sub-cohorts compare with the whole cohort on the proportion needing additional support — ${primaryYear} Year ${yearLevel}.`}
      />
      <YearLevelTabs yearLevels={yearLevels} value={yearLevel} onChange={setYearLevel} />
      <AttributionNote yearLevel={yearLevel} year={primaryYear} />

      {headline && (
        <p className="mb-4 text-sm font-medium text-graphite">{headline}</p>
      )}

      {domains.length === 0 || !breakdown ? (
        <EmptyState title="No data for this year level" />
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-graphite/70">
            A positive gap means a higher share of that subgroup needs additional support than the
            cohort overall — more need, so a priority for support planning. A negative gap means the
            subgroup is ahead of the cohort. Gaps of more than 5 percentage points are flagged as
            priority gaps.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-graphite/50">
              Domain
            </span>
            <div className="inline-flex flex-wrap gap-1 rounded-xl border border-alabaster bg-white/60 p-1">
              {domains.map((dom) => (
                <button
                  key={dom}
                  type="button"
                  onClick={() => setDomain(dom)}
                  className={
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition " +
                    (dom === activeDomain
                      ? "bg-coral text-white shadow-sm"
                      : "text-graphite/70 hover:text-graphite")
                  }
                >
                  {dom}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile
              label="Whole-cohort NAS"
              value={`${breakdown.cohortNasPct.toFixed(0)}%`}
              sub="Reference point — all subgroup gaps are measured against this."
            />
          </div>

          <Card>
            <h2 className="mb-3 text-base font-semibold text-graphite">
              Language background other than English (LBOTE)
            </h2>
            {!breakdown.lboteReported ? (
              <p className="text-sm text-graphite/60">
                LBOTE status not reported in this dataset.
              </p>
            ) : (
              <SubgroupTable groups={breakdown.lbote} />
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-base font-semibold text-graphite">
              Aboriginal and/or Torres Strait Islander (ATSI)
            </h2>
            {breakdown.atsiSuppressed ? (
              <p className="text-sm text-graphite/70">
                Indigenous results are suppressed for this domain. Fewer than {PRIVACY_THRESHOLD}{" "}
                students identify as Aboriginal and/or Torres Strait Islander, so no subgroup
                figures are shown — in a small cohort an exact count is itself identifying.
              </p>
            ) : (
              <>
                <p className="mb-3 text-xs text-graphite/60">
                  {breakdown.atsiCount} Aboriginal and/or Torres Strait Islander{" "}
                  {breakdown.atsiCount === 1 ? "student" : "students"}; {breakdown.nonAtsiCount}{" "}
                  non-Indigenous {breakdown.nonAtsiCount === 1 ? "student" : "students"}.
                </p>
                <SubgroupTable groups={breakdown.atsi} />
              </>
            )}
          </Card>

          <PrivacyNote>
            Sub-cohorts smaller than n = {PRIVACY_THRESHOLD} are suppressed to protect student
            privacy. This applies whether or not suppression has triggered above. No student names
            appear in this analysis.
          </PrivacyNote>
        </div>
      )}
    </div>
  );
}
