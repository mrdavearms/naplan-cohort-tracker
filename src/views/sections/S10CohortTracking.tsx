/**
 * Section 10 — Cohort tracking. THE headline measure: the same students tracked
 * across two years (primaryYear − 2 → primaryYear), matched on Local Student ID
 * — Year 3→5 for a primary school, Year 7→9 for a secondary school. This is the
 * only section that isolates the school's own value-add (same cohort, two years
 * apart), as opposed to year-on-year comparisons of different cohorts. Labels
 * follow the loaded phase's levels. McNemar's exact test (not CI overlap)
 * assesses whether the paired NAS change is distinguishable from chance.
 */
import { useEffect, useMemo, useState } from "react";
import {
  attritionAnalysis,
  attritionCompositionSentence,
  bandMovement,
  buildCohortNarrative,
  buildCohortPairings,
  classGroupTracking,
  cohortAttributionNote,
  cohortHeadline,
  cohortYears,
  crossDomainFollowUp,
  detectabilityNote,
  inferCohortLevels,
  trackablePhases,
  declinedOrStalled,
  equitySubCohorts,
  getEntry,
  improved,
  interpretAttrition,
  interpretClassGroups,
  interpretEquity,
  interpretMcnemar,
  interpretReadingSubdomains,
  interpretTransition,
  interpretWilson,
  joinerAnalysis,
  LEFT_WHS,
  mcnemarPaired,
  movementStackedFigure,
  subdomainMovement,
  transitionHeatmapFigure,
  transitionSankeyFigure,
  wilsonCiDotPlotFigure,
  type CohortKind,
  type CohortPhase,
  type NarrativeContext,
  type PairedCohort,
} from "@naplan-cohort-tracker/core";
import { useApp } from "../../state/AppState";
import { Card, EmptyState, Pill, SectionHeading } from "../../components/ui";
import { Chart } from "../../components/Chart";
import { MatchRateBanner } from "../../components/MatchRateBanner";
import { ExportPdfButton } from "../../components/ExportPdfButton";
import { CrossDomainOverview } from "../../components/CrossDomainOverview";

const pp = (x: number | null): string => (x == null ? "—" : `${x >= 0 ? "+" : ""}${x.toFixed(1)}pp`);
const pct = (x: number | null): string => (x == null ? "—" : `${x.toFixed(1)}%`);
const formatP = (p: number | null): string => (p == null ? "n/a" : p < 0.001 ? "<0.001" : p.toFixed(3));
/** Net student count behind a pp delta — "6 fewer at NAS", "2 more Meeting+". */
const netCountLabel = (count: number, noun: string): string =>
  count === 0 ? "no net change" : `${Math.abs(count)} ${count < 0 ? "fewer" : "more"} ${noun}`;
/** Display-only relabel of the core's parity string (avoids school-specific wording). */
const destLabel = (s: string): string => (s === LEFT_WHS ? "Left the school" : s);

function Bullets({ items, accent }: { items: string[]; accent?: "sage" | "coral" }) {
  if (items.length === 0) return null;
  const dot = accent === "sage" ? "text-sage" : accent === "coral" ? "text-coral" : "text-graphite/40";
  return (
    <ul className="space-y-1.5 text-sm text-graphite/80">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2">
          <span className={dot} aria-hidden>
            •
          </span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export function S10CohortTracking() {
  const { state } = useApp();
  const store = state.store;
  const primaryYear = state.primaryYear!;
  const [y7Year, y9Year] = cohortYears(primaryYear);

  // A combined P–12 school can have BOTH cohorts (3→5 and 7→9). Let the user pick
  // which to view; a single-phase school just gets its one phase (no toggle).
  const phases = useMemo(() => trackablePhases(store, primaryYear), [store, primaryYear]);
  const [selectedPhase, setSelectedPhase] = useState<CohortKind | null>(null);
  const activePhase: CohortPhase | undefined =
    phases.find((p) => p.phase === selectedPhase) ?? phases[phases.length - 1];

  // If the loaded data changes so the selected phase no longer exists (e.g. a
  // re-import drops a phase), clear the stale choice and fall back to the default.
  useEffect(() => {
    if (selectedPhase && !phases.some((p) => p.phase === selectedPhase)) setSelectedPhase(null);
  }, [phases, selectedPhase]);

  const pairings = useMemo(
    () => buildCohortPairings(store, primaryYear, activePhase),
    [store, primaryYear, activePhase],
  );
  const domains = useMemo(() => [...pairings.keys()], [pairings]);

  // Label with the active phase's levels (Year 3→5 primary, 7→9 secondary);
  // fall back to a best guess from the loaded data for the empty state.
  const { earlier: earlierLevel, later: laterLevel } = activePhase
    ? { earlier: activePhase.earlier, later: activePhase.later }
    : inferCohortLevels([...store.values()].map((e) => e.yearLevel));
  const earlierLabel = `Year ${earlierLevel}`;
  const laterLabel = `Year ${laterLevel}`;

  const [domain, setDomain] = useState<string>(() => domains[0] ?? "");
  const activeDomain = pairings.has(domain) ? domain : (domains[0] ?? "");
  const pc: PairedCohort | undefined = activeDomain ? pairings.get(activeDomain) : undefined;

  const ctx: NarrativeContext = {
    schoolName: state.settings.schoolName || "This school",
    schoolNumber: state.settings.schoolNumber,
    primaryYear,
    planLabel: state.settings.planLabel,
    planReferences: state.settings.improvementPlanRefs,
    trackedDomains: state.settings.trackedDomains,
  };

  if (domains.length === 0) {
    return (
      <div>
        <SectionHeading number={10} title="Cohort tracking" blurb={`The same students ${earlierLabel} → ${laterLabel} — the school value-add measure.`} />
        <EmptyState title={`No matched ${earlierLabel}→${laterLabel} cohort`}>
          This section needs a {earlierLabel} file from <strong>{y7Year}</strong> and a {laterLabel} file from{" "}
          <strong>{y9Year}</strong> in the loaded folder, for at least one domain.
        </EmptyState>
      </div>
    );
  }

  const narrative = buildCohortNarrative(pairings, ctx);

  return (
    <div className="space-y-6">
      <SectionHeading
        number={10}
        title="Cohort tracking"
        blurb={`The same students from ${earlierLabel} (${y7Year}) to ${laterLabel} (${y9Year}) — the school's value-add measure.`}
      />

      <p className="rounded-xl border border-alabaster bg-white/60 p-3 text-xs text-graphite/70">
        {cohortAttributionNote(earlierLevel, laterLevel, y7Year, y9Year)}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {phases.length > 1 ? (
          <div className="inline-flex rounded-xl border border-alabaster bg-white/60 p-1 text-sm">
            {phases.map((p) => (
              <button
                key={p.phase}
                type="button"
                onClick={() => setSelectedPhase(p.phase)}
                className={
                  "rounded-lg px-3 py-1 transition " +
                  (p.phase === activePhase?.phase ? "bg-coral text-white" : "text-graphite/70 hover:text-graphite")
                }
              >
                {p.phase === "primary"
                  ? "Primary"
                  : p.phase === "transition"
                    ? "Primary→Secondary"
                    : "Secondary"}{" "}
                (Year {p.earlier} → {p.later})
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <ExportPdfButton kind="cohort" />
      </div>

      <MatchRateBanner store={store} primaryYear={primaryYear} phase={activePhase} />

      <CrossDomainOverview pairings={pairings} />

      {/* Cross-domain follow-up intersection — students flagged in 2+ domains */}
      {(() => {
        const rows = crossDomainFollowUp(pairings);
        if (rows.length === 0) return null;
        const priority = rows.filter((r) => r.domainCount >= 2).length;
        return (
          <Card>
            <h2 className="mb-1 text-lg font-semibold text-graphite">Follow-up across domains</h2>
            <p className="mb-3 text-xs text-graphite/60">
              Matched students who declined or stalled, joined across{" "}
              {domains.length === 1 ? "the one loaded domain" : `all ${domains.length} domains`} in this phase. Students
              flagged in two or more domains are the clearest intervention priority. Local Student IDs only.
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-alabaster text-left text-xs uppercase tracking-wide text-graphite/50">
                  <th className="py-2">Local ID</th>
                  <th className="py-2 text-right">Domains</th>
                  <th className="py-2">Flagged in</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.localStudentId} className="border-b border-alabaster/60 last:border-0 align-top">
                    <td className="py-2 font-medium text-graphite">
                      {r.localStudentId}
                      {r.domainCount >= 2 && (
                        <span className="ml-2">
                          <Pill tone="coral">priority</Pill>
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums">{r.domainCount}</td>
                    <td className="py-2 text-graphite/70">
                      {r.flags.map((f) => `${f.domain} (${f.flag})`).join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {priority > 0 && (
              <p className="mt-3 text-xs text-graphite/60">
                {priority} student{priority === 1 ? "" : "s"} flagged in two or more domains.
              </p>
            )}
          </Card>
        );
      })()}

      {/* Per-domain headline */}
      <Card>
        <h2 className="mb-3 text-lg font-semibold text-graphite">Paired-cohort headline</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-alabaster text-left text-xs uppercase tracking-wide text-graphite/50">
              <th className="py-2">Domain</th>
              <th className="py-2 text-right">Paired n</th>
              <th className="py-2 text-right">Y{earlierLevel} NAS%</th>
              <th className="py-2 text-right">Y{laterLevel} NAS%</th>
              <th className="py-2 text-right">Δ NAS</th>
              <th className="py-2 text-right">Δ Meeting+</th>
              <th className="py-2 text-right">McNemar p</th>
            </tr>
          </thead>
          <tbody>
            {domains.map((dom) => {
              const dpc = pairings.get(dom)!;
              const h = cohortHeadline(dpc);
              const mc = mcnemarPaired(dpc.paired, dpc.earlierLevel, dpc.laterLevel);
              const better = h.deltaNasPp < 0;
              return (
                <tr key={dom} className="border-b border-alabaster/60 last:border-0">
                  <td className="py-2 font-medium text-graphite">{dom}</td>
                  <td className="py-2 text-right tabular-nums">{h.pairedN}</td>
                  <td className="py-2 text-right tabular-nums">
                    {h.y7NasPct.toFixed(1)} <span className="text-graphite/40">({h.y7NasCount})</span>
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {h.y9NasPct.toFixed(1)} <span className="text-graphite/40">({h.y9NasCount})</span>
                  </td>
                  <td className={"py-2 text-right tabular-nums " + (better ? "text-sage-text" : h.deltaNasPp > 0 ? "text-coral-text" : "")}>
                    {pp(h.deltaNasPp)}
                    <div className="text-[11px] font-normal text-graphite/50">{netCountLabel(h.deltaNasCount, "at NAS")}</div>
                  </td>
                  <td className={"py-2 text-right tabular-nums " + (h.deltaMeetingPp > 0 ? "text-sage-text" : h.deltaMeetingPp < 0 ? "text-coral-text" : "")}>
                    {pp(h.deltaMeetingPp)}
                    <div className="text-[11px] font-normal text-graphite/50">{netCountLabel(h.deltaMeetingCount, "Meeting+")}</div>
                  </td>
                  <td className="py-2 text-right tabular-nums">{formatP(mc.pValue)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-graphite/60">
          Lower NAS (“Needs additional support”) is better; “Meeting+” is Strong + Exceeding. A
          significant McNemar p (&lt; 0.05) means the paired NAS change is distinguishable from
          chance — not just overlapping confidence intervals.
        </p>
      </Card>

      {/* Leadership narrative */}
      {(narrative.supported.length > 0 ||
        narrative.concerns.length > 0 ||
        narrative.patterns.length > 0 ||
        narrative.actions.length > 0) && (
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-graphite">Leadership narrative</h2>
          {narrative.supported.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-sage-text">Statistically supported</h3>
              <Bullets items={narrative.supported} accent="sage" />
            </div>
          )}
          {narrative.concerns.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-coral-text">Concerns</h3>
              <Bullets items={narrative.concerns} accent="coral" />
            </div>
          )}
          {narrative.patterns.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-graphite">Patterns</h3>
              <Bullets items={narrative.patterns} />
            </div>
          )}
          {narrative.actions.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-graphite">Suggested actions</h3>
              <Bullets items={narrative.actions} />
            </div>
          )}
          <p className="text-xs text-graphite/60">
            A rules-based draft to support — not replace — professional judgement.
          </p>
        </Card>
      )}

      {/* Domain selector for the drill-downs */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-graphite/60">Drill into:</span>
        {domains.map((dom) => (
          <button
            key={dom}
            type="button"
            onClick={() => setDomain(dom)}
            className={
              "rounded-full px-3 py-1 text-sm transition " +
              (dom === activeDomain
                ? "bg-coral text-white"
                : "border border-alabaster bg-white text-graphite/70 hover:border-coral/40")
            }
          >
            {dom}
          </button>
        ))}
      </div>

      {pc && <DomainDrilldown pc={pc} y7Year={y7Year} y9Year={y9Year} store={store} ctx={ctx} />}
    </div>
  );
}

function DomainDrilldown({
  pc,
  y7Year,
  y9Year,
  store,
  ctx,
}: {
  pc: PairedCohort;
  y7Year: number;
  y9Year: number;
  store: ReturnType<typeof useApp>["state"]["store"];
  ctx: NarrativeContext;
}) {
  const mc = mcnemarPaired(pc.paired, pc.earlierLevel, pc.laterLevel);
  const attrition = attritionAnalysis(pc);
  const joiners = joinerAnalysis(pc);
  const subCohorts = equitySubCohorts(pc);
  const classRows = classGroupTracking(pc);

  // Phase labels for this cohort (Year 3→5 primary, Year 7→9 secondary).
  const earlierLabel = `Year ${pc.earlierLevel}`;
  const laterLabel = `Year ${pc.laterLevel}`;
  const eShort = `Y${pc.earlierLevel}`;
  const lShort = `Y${pc.laterLevel}`;

  const y7Results = getEntry(store, y7Year, pc.earlierLevel, pc.domain)?.studentResults ?? [];
  const y9Results = getEntry(store, y9Year, pc.laterLevel, pc.domain)?.studentResults ?? [];
  const subdomainMoves = subdomainMovement(y7Results, y9Results);
  const isReading = pc.domain === "Reading";

  // No reconciled students: every chart below would read n=0 and look broken.
  // Explain it instead — this is the common "Local IDs don't match across years" case.
  if (pc.paired.length === 0) {
    return (
      <Card>
        <h2 className="mb-1 text-lg font-semibold text-graphite">{pc.domain} — no matched students</h2>
        <p className="text-sm text-graphite/70">
          No students could be matched between {earlierLabel} ({y7Year}) and {laterLabel} ({y9Year}) for {pc.domain}.
          This usually means the Local Student IDs don&rsquo;t reconcile across the two files, so there&rsquo;s
          nothing to track for this domain — check that both years use the school&rsquo;s Local Student ID.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Transition: Sankey + heatmap */}
      <Card>
        <h2 className="mb-1 text-lg font-semibold text-graphite">{pc.domain} — proficiency transition</h2>
        <p className="mb-3 text-xs text-graphite/60">
          Where the matched cohort moved between proficiency bands, {earlierLabel} → {laterLabel}.
        </p>
        {/* One visualisation wide — never side by side. A crushed Sankey
            collapses its margins and the year headers overlap (see CLAUDE.md). */}
        <div className="space-y-4">
          <Chart figure={transitionSankeyFigure(pc, y7Year, y9Year)} height={460} />
          <Chart figure={transitionHeatmapFigure(pc, y7Year, y9Year)} height={460} />
        </div>
        <div className="mt-3">
          <Bullets items={interpretTransition(pc)} />
        </div>
      </Card>

      {/* Band movement bar */}
      <Card>
        <h2 className="mb-1 text-lg font-semibold text-graphite">{pc.domain} — band movement</h2>
        <p className="mb-3 text-xs text-graphite/60">
          Share of the matched cohort that moved up a proficiency band, held, or slipped down.
        </p>
        <Chart
          figure={movementStackedFigure([{ label: `${pc.domain} (n=${pc.paired.length})`, movement: bandMovement(pc) }])}
          height={150}
        />
      </Card>

      {/* NAS Wilson CI + McNemar */}
      <Card>
        <h2 className="mb-1 text-lg font-semibold text-graphite">{pc.domain} — NAS rate, {eShort} vs {lShort}</h2>
        <p className="mb-3 text-xs text-graphite/60">
          Wilson 95% confidence intervals on the paired NAS rate, with McNemar’s exact test on the
          discordant pairs.
        </p>
        <Chart figure={wilsonCiDotPlotFigure(pc, y7Year, y9Year)} height={220} />
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <Pill tone={mc.pValue != null && mc.pValue < 0.05 ? "sage" : "neutral"}>
            McNemar p = {formatP(mc.pValue)}
          </Pill>
          <span className="text-graphite/60">{mc.note}</span>
        </div>
        <p className="mt-2 rounded-lg bg-alabaster/40 p-3 text-xs text-graphite/70">
          {detectabilityNote(pc.paired.length)}
        </p>
        <div className="mt-3">
          <Bullets items={interpretMcnemar(mc, pc.domain, pc.paired.length, pc.earlierLevel, pc.laterLevel)} />
          <Bullets items={interpretWilson(pc)} />
        </div>
      </Card>

      {/* Attrition: stayers vs leavers */}
      <Card>
        <h2 className="mb-1 text-lg font-semibold text-graphite">Attrition — stayers vs leavers</h2>
        <p className="mb-3 text-xs text-graphite/60">
          Did the students who left between {earlierLabel} and {laterLabel} differ from those who stayed? (A
          selection effect would bias the headline.)
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-alabaster text-left text-xs uppercase tracking-wide text-graphite/50">
              <th className="py-2">Group</th>
              <th className="py-2 text-right">n</th>
              <th className="py-2 text-right">{eShort} NAS count</th>
              <th className="py-2 text-right">{eShort} NAS%</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-alabaster/60">
              <td className="py-2 font-medium">Stayers (matched)</td>
              <td className="py-2 text-right tabular-nums">{attrition.stayersN}</td>
              <td className="py-2 text-right tabular-nums">{attrition.stayersNasCount}</td>
              <td className="py-2 text-right tabular-nums">{attrition.stayersNasPct.toFixed(1)}%</td>
            </tr>
            <tr>
              <td className="py-2 font-medium">Leavers</td>
              <td className="py-2 text-right tabular-nums">{attrition.leaversN}</td>
              <td className="py-2 text-right tabular-nums">{attrition.leaversNasCount}</td>
              <td className="py-2 text-right tabular-nums">{attrition.leaversNasPct.toFixed(1)}%</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 rounded-lg bg-alabaster/40 p-3 text-sm text-graphite/80">
          {attritionCompositionSentence(pc)}
        </p>
        <div className="mt-3">
          <Bullets items={interpretAttrition(pc)} />
        </div>
      </Card>

      {/* Joiners — exit-year standing vs stayers (mirror of attrition) */}
      <Card>
        <h2 className="mb-1 text-lg font-semibold text-graphite">Joiners — arrived after {earlierLabel}</h2>
        <p className="mb-3 text-xs text-graphite/60">
          Students who joined after {earlierLabel} have no entry baseline, so they are described by where they stand
          at {laterLabel} — compared with the stayers' {laterLabel} standing.
        </p>
        {joiners.joinersN === 0 ? (
          <p className="text-sm text-graphite/60">No students joined after {earlierLabel} in {pc.domain}.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-alabaster text-left text-xs uppercase tracking-wide text-graphite/50">
                <th className="py-2">Group</th>
                <th className="py-2 text-right">n</th>
                <th className="py-2 text-right">{lShort} NAS%</th>
                <th className="py-2 text-right">{lShort} Meeting+%</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-alabaster/60">
                <td className="py-2 font-medium">Joiners</td>
                <td className="py-2 text-right tabular-nums">{joiners.joinersN}</td>
                <td className="py-2 text-right tabular-nums">
                  {joiners.joinersNasPct.toFixed(1)}% <span className="text-graphite/40">({joiners.joinersNasCount})</span>
                </td>
                <td className="py-2 text-right tabular-nums">
                  {joiners.joinersMeetingPct.toFixed(1)}% <span className="text-graphite/40">({joiners.joinersMeetingCount})</span>
                </td>
              </tr>
              <tr>
                <td className="py-2 font-medium">Stayers (matched)</td>
                <td className="py-2 text-right tabular-nums">{joiners.stayersN}</td>
                <td className="py-2 text-right tabular-nums">
                  {joiners.stayersNasPct.toFixed(1)}% <span className="text-graphite/40">({joiners.stayersNasCount})</span>
                </td>
                <td className="py-2 text-right tabular-nums">
                  {joiners.stayersMeetingPct.toFixed(1)}% <span className="text-graphite/40">({joiners.stayersMeetingCount})</span>
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </Card>

      {/* Equity sub-cohorts */}
      <Card>
        <h2 className="mb-1 text-lg font-semibold text-graphite">Equity within the matched cohort</h2>
        <p className="mb-3 text-xs text-graphite/60">
          LBOTE and Aboriginal/Torres Strait Islander NAS movement ({earlierLabel} entry status). Groups
          under n=5 are suppressed; n=5–9 are indicative only.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-alabaster text-left text-xs uppercase tracking-wide text-graphite/50">
              <th className="py-2">Sub-cohort</th>
              <th className="py-2 text-right">n</th>
              <th className="py-2 text-right">{eShort} NAS%</th>
              <th className="py-2 text-right">{lShort} NAS%</th>
              <th className="py-2 text-right">Δ NAS</th>
            </tr>
          </thead>
          <tbody>
            {subCohorts.map((r) => (
              <tr key={r.subgroup} className="border-b border-alabaster/60 last:border-0">
                <td className="py-2 font-medium text-graphite">
                  {r.subgroup}
                  {r.caveat && !r.suppressed && (
                    <span className="ml-2">
                      <Pill tone="tuscan">indicative</Pill>
                    </span>
                  )}
                </td>
                <td className="py-2 text-right tabular-nums">{r.n}</td>
                {r.suppressed ? (
                  <td className="py-2 text-right text-graphite/50" colSpan={3}>
                    suppressed (n &lt; 5)
                  </td>
                ) : (
                  <>
                    <td className="py-2 text-right tabular-nums">
                      {pct(r.y7NasPct)} <span className="text-graphite/40">({r.y7NasCount})</span>
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {pct(r.y9NasPct)} <span className="text-graphite/40">({r.y9NasCount})</span>
                    </td>
                    <td
                      className={
                        "py-2 text-right tabular-nums " +
                        (r.deltaNasPp != null && r.deltaNasPp < 0
                          ? "text-sage-text"
                          : r.deltaNasPp != null && r.deltaNasPp > 0
                            ? "text-coral-text"
                            : "")
                      }
                    >
                      {pp(r.deltaNasPp)}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3">
          <Bullets items={interpretEquity(pc)} />
        </div>
      </Card>

      {/* Class-group tracking */}
      <Card>
        <h2 className="mb-1 text-lg font-semibold text-graphite">{earlierLabel} class-group tracking</h2>
        <p className="mb-3 text-xs text-graphite/60">
          Where each {earlierLabel} class went by {laterLabel}, and how its NAS rate moved (paired students only).
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-alabaster text-left text-xs uppercase tracking-wide text-graphite/50">
              <th className="py-2">{eShort} class</th>
              <th className="py-2 text-right">Total</th>
              <th className="py-2 text-right">Stayed</th>
              <th className="py-2 text-right">Left</th>
              <th className="py-2 text-right">{eShort} NAS%</th>
              <th className="py-2 text-right">{lShort} NAS%</th>
              <th className="py-2">Main destinations</th>
            </tr>
          </thead>
          <tbody>
            {classRows.map((r) => (
              <tr key={r.y7Class} className="border-b border-alabaster/60 last:border-0 align-top">
                <td className="py-2 font-medium text-graphite">{r.y7Class}</td>
                <td className="py-2 text-right tabular-nums">{r.total}</td>
                <td className="py-2 text-right tabular-nums">{r.stayed}</td>
                <td className="py-2 text-right tabular-nums">{r.left}</td>
                <td className="py-2 text-right tabular-nums">{r.y7NasPct.toFixed(1)}%</td>
                <td className="py-2 text-right tabular-nums">{r.y9NasPct.toFixed(1)}%</td>
                <td className="py-2 text-xs text-graphite/60">
                  {r.destinations
                    .slice()
                    .sort((a, b) => b.n - a.n)
                    .slice(0, 4)
                    .map((d) => `${destLabel(d.y9Class)} (${d.n})`)
                    .join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3">
          <Bullets items={interpretClassGroups(pc)} />
        </div>
      </Card>

      {/* Subdomains — all domains */}
      {subdomainMoves.length > 0 ? (
        <Card>
          <h2 className="mb-1 text-lg font-semibold text-graphite">{pc.domain} subdomains — {eShort} vs {lShort} % correct</h2>
          <p className="mb-3 text-xs text-graphite/60">
            Capability against the year-level standard, weakest first. This is a <strong>directional</strong>{" "}
            signal, not true growth — the {eShort} and {lShort} tests differ in difficulty.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-alabaster text-left text-xs uppercase tracking-wide text-graphite/50">
                <th className="py-2">Subdomain</th>
                <th className="py-2 text-right">{eShort} % correct</th>
                <th className="py-2 text-right">{lShort} % correct</th>
                <th className="py-2 text-right">Δ</th>
              </tr>
            </thead>
            <tbody>
              {[...subdomainMoves]
                .sort((a, b) => (a.y9PctCorrect ?? 0) - (b.y9PctCorrect ?? 0))
                .map((s) => (
                  <tr key={s.subdomain} className="border-b border-alabaster/60 last:border-0">
                    <td className="py-2 font-medium text-graphite">{s.subdomain}</td>
                    <td className="py-2 text-right tabular-nums">{pct(s.y7PctCorrect)}</td>
                    <td className="py-2 text-right tabular-nums">{pct(s.y9PctCorrect)}</td>
                    <td
                      className={
                        "py-2 text-right tabular-nums " +
                        (s.deltaPp != null && s.deltaPp > 0
                          ? "text-sage-text"
                          : s.deltaPp != null && s.deltaPp < 0
                            ? "text-coral-text"
                            : "")
                      }
                    >
                      {pp(s.deltaPp)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {isReading && (
            <div className="mt-3">
              <Bullets items={interpretReadingSubdomains(y7Results, y9Results, y7Year, y9Year, ctx, pc.earlierLevel, pc.laterLevel)} />
            </div>
          )}
        </Card>
      ) : (
        <Card>
          <h2 className="mb-1 text-lg font-semibold text-graphite">{pc.domain} subdomains</h2>
          <p className="text-sm text-graphite/60">
            No subdomain-level item data is available for {pc.domain} in both years.
          </p>
        </Card>
      )}

      {/* Students to follow up — declined or stalled */}
      {(() => {
        const ds = declinedOrStalled(pc);
        return (
          <Card>
            <h2 className="mb-1 text-lg font-semibold text-graphite">{pc.domain} — students to follow up</h2>
            <p className="mb-3 text-xs text-graphite/60">
              Matched students who slipped a band, or who stayed at “Needs additional support” both years.
              Local Student IDs only — no names.
            </p>
            {ds.declined.length === 0 && ds.stalled.length === 0 ? (
              <p className="text-sm text-graphite/60">No students declined or stalled in {pc.domain}.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-alabaster text-left text-xs uppercase tracking-wide text-graphite/50">
                    <th className="py-2">Local ID</th>
                    <th className="py-2">Flag</th>
                    <th className="py-2">{eShort} class</th>
                    <th className="py-2">{lShort} class</th>
                    <th className="py-2">{eShort} → {lShort} band</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...ds.declined.map((s) => ({ s, flag: "Declined" as const })),
                    ...ds.stalled.map((s) => ({ s, flag: "Stalled at NAS" as const })),
                  ].map(({ s, flag }, i) => (
                    <tr key={`${s.localStudentId}-${i}`} className="border-b border-alabaster/60 last:border-0">
                      <td className="py-2 font-medium text-graphite">{s.localStudentId}</td>
                      <td className="py-2">
                        <Pill tone="coral">{flag}</Pill>
                      </td>
                      <td className="py-2 text-graphite/70">{s.classGroupY7 ?? "—"}</td>
                      <td className="py-2 text-graphite/70">{s.classGroupY9 ?? "—"}</td>
                      <td className="py-2 tabular-nums">
                        {s.proficiencyY7} → {s.proficiencyY9}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        );
      })()}

      {/* Students who improved — recognition + shared-group spotting (mirror of follow-up) */}
      {(() => {
        const imp = improved(pc);
        return (
          <Card>
            <h2 className="mb-1 text-lg font-semibold text-graphite">{pc.domain} — students who improved</h2>
            <p className="mb-3 text-xs text-graphite/60">
              Matched students who moved up a proficiency band, or out of “Needs additional support”. For
              recognition, and to spot which classes or interventions the improvers shared. Local Student IDs only.
            </p>
            {imp.length === 0 ? (
              <p className="text-sm text-graphite/60">No students moved up a band in {pc.domain}.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-alabaster text-left text-xs uppercase tracking-wide text-graphite/50">
                    <th className="py-2">Local ID</th>
                    <th className="py-2">Flag</th>
                    <th className="py-2">{eShort} class</th>
                    <th className="py-2">{lShort} class</th>
                    <th className="py-2">{eShort} → {lShort} band</th>
                  </tr>
                </thead>
                <tbody>
                  {imp.map((s, i) => (
                    <tr key={`${s.localStudentId}-${i}`} className="border-b border-alabaster/60 last:border-0">
                      <td className="py-2 font-medium text-graphite">{s.localStudentId}</td>
                      <td className="py-2">
                        <Pill tone="sage">{s.leftNas ? "Moved out of NAS" : "Up a band"}</Pill>
                      </td>
                      <td className="py-2 text-graphite/70">{s.classGroupY7 ?? "—"}</td>
                      <td className="py-2 text-graphite/70">{s.classGroupY9 ?? "—"}</td>
                      <td className="py-2 tabular-nums">
                        {s.proficiencyY7} → {s.proficiencyY9}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        );
      })()}
    </div>
  );
}
