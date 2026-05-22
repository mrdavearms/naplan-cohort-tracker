/**
 * Section 5 — Skill gaps. Subdomain accuracy by difficulty band, and the
 * hardest-going descriptors, from the Student Results Table (item-level data)
 * per domain for the selected year level. These are diagnostic skill signals —
 * where the cohort struggled at the item level — not a measure of the school.
 * Item-level only: no student identifiers appear here.
 */
import { useMemo, useState } from "react";
import {
  accuracyBySubdomainAndBand,
  bottomDescriptors,
  DIFFICULTY_BAND_ORDER,
  domainsFor,
  getEntry,
} from "@naplan-throughline/core";
import { useApp } from "../../state/AppState";
import { Card, EmptyState, PrivacyNote, SectionHeading } from "../../components/ui";
import { AttributionNote, useYearLevel, YearLevelTabs } from "./scope";
import clsx from "clsx";

/** Tone an accuracy figure: low (<50%) reads as a gap, high (>=70%) as strength. */
function accuracyToneClass(pct: number): string {
  if (pct < 50) return "text-coral-text";
  if (pct >= 70) return "text-sage-text";
  return "text-graphite";
}

export function S5SkillGaps() {
  const { state } = useApp();
  const store = state.store;
  const primaryYear = state.primaryYear!;
  const { yearLevels, yearLevel, setYearLevel } = useYearLevel(store, primaryYear);

  const domains = domainsFor(store, primaryYear, yearLevel);

  // Domain selector — default to the first available; keep valid if domains change.
  const [domain, setDomain] = useState<string>(() => domains[0] ?? "");
  const effectiveDomain = domains.includes(domain) ? domain : (domains[0] ?? "");

  const entry = effectiveDomain
    ? getEntry(store, primaryYear, yearLevel, effectiveDomain)
    : undefined;
  // Stable reference so the useMemo hooks below don't recompute every render.
  const results = useMemo(() => entry?.studentResults ?? [], [entry]);

  // Pivot the (subdomain × band) accuracy array into one row per subdomain.
  const subdomainRows = useMemo(() => {
    const cells = accuracyBySubdomainAndBand(results);
    const bySubdomain = new Map<
      string,
      Record<string, { accuracyPct: number; nResponses: number }>
    >();
    for (const cell of cells) {
      const row = bySubdomain.get(cell.subdomain) ?? {};
      row[cell.band] = { accuracyPct: cell.accuracyPct, nResponses: cell.nResponses };
      bySubdomain.set(cell.subdomain, row);
    }
    return Array.from(bySubdomain.entries()).map(([subdomain, bands]) => ({ subdomain, bands }));
  }, [results]);

  const hardest = useMemo(() => bottomDescriptors(results, 10), [results]);

  return (
    <div>
      <SectionHeading
        number={5}
        title="Skill gaps"
        blurb={`Item-level accuracy and the hardest-going skills — ${primaryYear} Year ${yearLevel}.`}
      />
      <YearLevelTabs yearLevels={yearLevels} value={yearLevel} onChange={setYearLevel} />
      <AttributionNote yearLevel={yearLevel} year={primaryYear} />

      <p className="mb-4 text-sm text-graphite/70">
        These are diagnostic skill signals drawn from the item-level results — the subdomains
        and individual skill descriptors where the cohort answered the fewest questions
        correctly. Read them as evidence to inform teaching and improvement planning, not as a
        score for the school.
      </p>

      {domains.length === 0 ? (
        <EmptyState title="No data for this year level" />
      ) : (
        <>
          {/* Domain selector — same button-row treatment as the year tabs. */}
          <div className="mb-4 inline-flex flex-wrap gap-1 rounded-xl border border-alabaster bg-white/60 p-1">
            {domains.map((dom) => (
              <button
                key={dom}
                type="button"
                onClick={() => setDomain(dom)}
                className={clsx(
                  "rounded-lg px-4 py-1.5 text-sm font-medium transition",
                  effectiveDomain === dom
                    ? "bg-coral text-white shadow-sm"
                    : "text-graphite/70 hover:text-graphite",
                )}
              >
                {dom}
              </button>
            ))}
          </div>

          {results.length === 0 ? (
            <EmptyState title="No item-level results for this domain/year">
              The Student Results Table for {effectiveDomain} (Year {yearLevel}, {primaryYear})
              has no rows to analyse.
            </EmptyState>
          ) : (
            <div className="space-y-6">
              {/* Block 1 — subdomain accuracy by difficulty band. */}
              <Card>
                <h2 className="mb-1 text-base font-semibold text-graphite">
                  Subdomain accuracy by difficulty band
                </h2>
                <p className="mb-4 text-sm text-graphite/60">
                  Percentage of responses answered correctly, split by item difficulty (the NAPLAN
                  scale score the item sits at). Low accuracy is shown in coral, strong accuracy in
                  green; the number of responses behind each figure is shown beneath.
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-alabaster text-left text-xs uppercase tracking-wide text-graphite/50">
                      <th className="py-2">Subdomain</th>
                      {DIFFICULTY_BAND_ORDER.map((band) => (
                        <th key={band} className="py-2 text-right">
                          {band}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {subdomainRows.map(({ subdomain, bands }) => (
                      <tr key={subdomain} className="border-b border-alabaster/60 last:border-0">
                        <td className="py-2 font-medium text-graphite">{subdomain}</td>
                        {DIFFICULTY_BAND_ORDER.map((band) => {
                          const cell = bands[band];
                          return (
                            <td key={band} className="py-2 text-right align-top tabular-nums">
                              {cell ? (
                                <>
                                  <span className={clsx("font-medium", accuracyToneClass(cell.accuracyPct))}>
                                    {cell.accuracyPct.toFixed(1)}%
                                  </span>
                                  <div className="text-xs text-graphite/50">
                                    ({cell.nResponses} responses)
                                  </div>
                                </>
                              ) : (
                                <span className="text-graphite/30">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              {/* Block 2 — hardest-going descriptors. */}
              <Card>
                <h2 className="mb-1 text-base font-semibold text-graphite">
                  Hardest-going descriptors
                </h2>
                <p className="mb-4 text-sm text-graphite/60">
                  The individual skills the cohort found hardest, restricted to items attempted by
                  at least half the students who saw them, sorted hardest-first.
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-alabaster text-left text-xs uppercase tracking-wide text-graphite/50">
                      <th className="py-2">Descriptor</th>
                      <th className="py-2">Subdomain</th>
                      <th className="py-2 text-right">Item difficulty</th>
                      <th className="py-2 text-right">Students attempted</th>
                      <th className="py-2 text-right">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hardest.map((d) => (
                      <tr key={d.itemId} className="border-b border-alabaster/60 last:border-0">
                        <td className="max-w-xs truncate py-2 font-medium text-graphite" title={d.descriptor}>
                          {d.descriptor}
                        </td>
                        <td className="py-2 text-graphite/70">{d.subdomain}</td>
                        <td className="py-2 text-right tabular-nums text-graphite/70">
                          {d.itemDifficulty == null ? "—" : d.itemDifficulty.toFixed(0)}
                        </td>
                        <td className="py-2 text-right tabular-nums text-graphite/70">
                          {d.studentsAttempted}
                        </td>
                        <td className={clsx("py-2 text-right font-medium tabular-nums", accuracyToneClass(d.accuracyPct))}>
                          {d.accuracyPct.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              <PrivacyNote>
                This view is item-level — it carries no student names or identifiers, only skill
                descriptors and aggregate accuracy. Where small subgroups appear elsewhere in the
                report, groups of fewer than 5 students are suppressed to protect privacy.
              </PrivacyNote>
            </div>
          )}
        </>
      )}
    </div>
  );
}
