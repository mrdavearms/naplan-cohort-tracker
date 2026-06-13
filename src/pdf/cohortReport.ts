/**
 * Section 10 cohort deep-dive PDF — the headline value-add report. Tracks the
 * same students across two years (primaryYear − 2 → primaryYear), matched on
 * Local Student ID — Year 3→5 for primary, Year 7→9 for secondary. McNemar's
 * exact test (not CI overlap) assesses the paired NAS change. No student names
 * appear; the "left WHS" sentinel is relabelled.
 */
import {
  attritionAnalysis,
  attritionCompositionSentence,
  bandMovement,
  buildCohortNarrative,
  buildCohortPairings,
  cohortHeadline,
  cohortAttributionNote,
  cohortMatchRate,
  cohortYears,
  crossDomainFollowUp,
  detectabilityNote,
  inferCohortLevels,
  trackablePhases,
  crossDomainSummary,
  declinedOrStalled,
  divergingDeltaFigure,
  dumbbellFigure,
  equitySubCohorts,
  interpretAttrition,
  interpretEquity,
  interpretMcnemar,
  interpretTransition,
  interpretWilson,
  mcnemarPaired,
  movementStackedFigure,
  subdomainMovement,
  transitionHeatmapFigure,
  transitionSankeyFigure,
  wilsonCiDotPlotFigure,
  type CohortPhase,
  type DumbbellRow,
  type MovementBarRow,
  type NarrativeContext,
  type PairedCohort,
  type Settings,
  type Store,
} from "@naplan-cohort-tracker/core";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { figureToPng } from "./chartImage";
import { bulletList, coverPage, footer, pct1, PDF_STYLES, table } from "./common";

const fmtP = (p: number | null): string => (p == null ? "n/a" : p < 0.001 ? "<0.001" : p.toFixed(3));
const ppStr = (x: number | null): string => (x == null ? "—" : `${x >= 0 ? "+" : ""}${x.toFixed(1)} pp`);

async function domainBlock(pc: PairedCohort, y7Year: number, y9Year: number, store: Store): Promise<Content[]> {
  const out: Content[] = [];
  const earlierLabel = `Year ${pc.earlierLevel}`;
  const laterLabel = `Year ${pc.laterLevel}`;
  const eShort = `Y${pc.earlierLevel}`;
  const lShort = `Y${pc.laterLevel}`;
  out.push({ text: `${pc.domain} — ${earlierLabel} to ${laterLabel} transition`, style: "h2", pageBreak: "before" });

  // No reconciled students: skip the charts/tables (which would all read n=0)
  // and explain why, rather than printing a page that looks broken.
  if (pc.paired.length === 0) {
    out.push({
      text: `No students could be matched between ${earlierLabel} (${y7Year}) and ${laterLabel} (${y9Year}) for ${pc.domain}. This usually means the Local Student IDs don't reconcile across the two files, so there's nothing to track for this domain — check that both years use the school's Local Student ID.`,
      style: "lead",
    });
    return out;
  }

  // Render the Sankey on a wide internal canvas (820px) so its fixed 200px
  // side margins still leave a generous plot area and the Y7/Y9 year headers
  // can't collide; pdfmake scales it down to the page width (see CLAUDE.md).
  const sankey = await figureToPng(transitionSankeyFigure(pc, y7Year, y9Year), 820, 440);
  const heat = await figureToPng(transitionHeatmapFigure(pc, y7Year, y9Year), 560, 380);
  out.push({ image: sankey, width: 500, margin: [0, 2, 0, 6] });
  out.push({ image: heat, width: 500, margin: [0, 2, 0, 6] });
  out.push(bulletList(interpretTransition(pc)));

  const wilson = await figureToPng(wilsonCiDotPlotFigure(pc, y7Year, y9Year), 520, 200);
  const mc = mcnemarPaired(pc.paired, pc.earlierLevel, pc.laterLevel);
  out.push({ text: `NAS rate, ${earlierLabel} vs ${laterLabel} (Wilson 95% CI · McNemar)`, style: "h3" });
  out.push({ image: wilson, width: 500, margin: [0, 2, 0, 6] });
  out.push({ text: `McNemar exact p = ${fmtP(mc.pValue)}. ${mc.note}`, style: "caption" });
  out.push({ text: detectabilityNote(pc.paired.length), style: "caption" });
  out.push(bulletList([...interpretMcnemar(mc, pc.domain, pc.paired.length, pc.earlierLevel, pc.laterLevel), ...interpretWilson(pc)]));

  const movePng = await figureToPng(
    movementStackedFigure([{ label: `${pc.domain} (n=${pc.paired.length})`, movement: bandMovement(pc) }]),
    520,
    140,
  );
  out.push({ text: "Band movement", style: "h3" });
  out.push({ image: movePng, width: 500, margin: [0, 2, 0, 6] });

  const y7Results = store.get(`${y7Year}|${pc.earlierLevel}|${pc.domain}`)?.studentResults ?? [];
  const y9Results = store.get(`${y9Year}|${pc.laterLevel}|${pc.domain}`)?.studentResults ?? [];
  const subs = subdomainMovement(y7Results, y9Results);
  if (subs.length > 0) {
    out.push({ text: `Subdomains — ${eShort} vs ${lShort} % correct (directional, not true growth)`, style: "h3" });
    out.push(
      table(
        ["Subdomain", `${eShort} %`, `${lShort} %`, "Δ"],
        [...subs]
          .sort((a, b) => (a.y9PctCorrect ?? Infinity) - (b.y9PctCorrect ?? Infinity))
          .map((s) => [
            s.subdomain,
            s.y7PctCorrect == null ? "—" : pct1(s.y7PctCorrect),
            s.y9PctCorrect == null ? "—" : pct1(s.y9PctCorrect),
            s.deltaPp == null ? "—" : `${s.deltaPp >= 0 ? "+" : ""}${s.deltaPp.toFixed(1)}`,
          ]),
        ["*", "auto", "auto", "auto"],
      ),
    );
  }

  const ds = declinedOrStalled(pc);
  if (ds.declined.length > 0 || ds.stalled.length > 0) {
    out.push({ text: "Students to follow up (Local IDs only)", style: "h3" });
    out.push(
      table(
        ["Local ID", "Flag", `${eShort} class`, `${lShort} class`, `${eShort} → ${lShort} band`],
        [
          ...ds.declined.map((s) => [s.localStudentId, "Declined", s.classGroupY7 ?? "—", s.classGroupY9 ?? "—", `${s.proficiencyY7} → ${s.proficiencyY9}`]),
          ...ds.stalled.map((s) => [s.localStudentId, "Stalled at NAS", s.classGroupY7 ?? "—", s.classGroupY9 ?? "—", `${s.proficiencyY7} → ${s.proficiencyY9}`]),
        ],
        ["auto", "auto", "auto", "auto", "*"],
      ),
    );
  }

  const attr = attritionAnalysis(pc);
  out.push({ text: "Attrition — stayers vs leavers", style: "h3" });
  out.push(
    table(
      ["Group", "n", `${eShort} NAS count`, `${eShort} NAS%`],
      [
        ["Stayers (matched)", attr.stayersN, attr.stayersNasCount, pct1(attr.stayersNasPct)],
        ["Leavers", attr.leaversN, attr.leaversNasCount, pct1(attr.leaversNasPct)],
      ],
      ["*", "auto", "auto", "auto"],
    ),
  );
  out.push({ text: attritionCompositionSentence(pc), style: "caption" });
  out.push(bulletList(interpretAttrition(pc)));

  const sub = equitySubCohorts(pc);
  out.push({ text: "Equity within the matched cohort", style: "h3" });
  out.push(
    table(
      ["Sub-cohort", "n", `${eShort} NAS%`, `${lShort} NAS%`, "Δ NAS"],
      sub.map((r) =>
        r.suppressed
          ? [r.subgroup, r.n, "suppressed", "(n<5)", "—"]
          : [r.subgroup, r.n, pct1(r.y7NasPct ?? 0), pct1(r.y9NasPct ?? 0), ppStr(r.deltaNasPp)],
      ),
      ["*", "auto", "auto", "auto", "auto"],
    ),
  );
  out.push(bulletList(interpretEquity(pc)));
  return out;
}

/** All Section-10 content for ONE cohort phase: lead, headline table,
 *  cross-domain charts, leadership narrative and the per-domain deep dives.
 *  `withHeading` prefixes a phase heading (used when a P–12 school has both). */
async function phaseSection(
  store: Store,
  primaryYear: number,
  phase: CohortPhase,
  ctx: NarrativeContext,
  withHeading: boolean,
): Promise<Content[]> {
  const [y7Year, y9Year] = cohortYears(primaryYear);
  const pairings = buildCohortPairings(store, primaryYear, phase);
  const earlierLabel = `Year ${phase.earlier}`;
  const laterLabel = `Year ${phase.later}`;
  const eShort = `Y${phase.earlier}`;
  const lShort = `Y${phase.later}`;
  const out: Content[] = [];

  if (withHeading) {
    out.push({ text: `${earlierLabel} → ${laterLabel} cohort`, style: "h1", pageBreak: "before" });
  }

  if (pairings.size === 0) {
    out.push({
      text: `No matched ${earlierLabel} to ${laterLabel} cohort for ${primaryYear}. This report needs a ${earlierLabel} file from ${y7Year} and a ${laterLabel} file from ${y9Year} for at least one domain.`,
      style: "lead",
    });
    return out;
  }

  const mr = cohortMatchRate(pairings);
  out.push({
    text: `The same ${mr.matched} students tracked from ${earlierLabel} (${y7Year}) to ${laterLabel} (${y9Year}), matched on Local Student ID (${pct1(mr.matchRatePct)} of the ${mr.laterCohortTotal} ${laterLabel} students). ${mr.leavers} left after ${earlierLabel}; ${mr.joiners} joined after ${earlierLabel}.`,
    style: "lead",
  });
  out.push({ text: cohortAttributionNote(phase.earlier, phase.later, y7Year, y9Year), style: "caption" });

  // Headline table
  out.push({ text: "Paired-cohort headline", style: "h2" });
  out.push(
    table(
      ["Domain", "Paired n", `${eShort} NAS%`, `${lShort} NAS%`, "Δ NAS", "McNemar p"],
      [...pairings.entries()].map(([dom, pc]) => {
        const h = cohortHeadline(pc);
        const mc = mcnemarPaired(pc.paired, pc.earlierLevel, pc.laterLevel);
        return [dom, h.pairedN, pct1(h.y7NasPct), pct1(h.y9NasPct), ppStr(h.deltaNasPp), fmtP(mc.pValue)];
      }),
      ["*", "auto", "auto", "auto", "auto", "auto"],
    ),
  );
  out.push({ text: "Lower NAS is better. A McNemar p < 0.05 means the paired change is distinguishable from chance.", style: "caption" });

  const summary = crossDomainSummary(pairings);
  const dumbbellRows: DumbbellRow[] = summary.map((r) => ({
    domain: r.domain,
    y7Value: r.y7NasPct,
    y9Value: r.y9NasPct,
    direction: r.deltaNasPp < 0 ? "improved" : r.deltaNasPp > 0 ? "worsened" : "flat",
  }));
  // Full-width, stacked — one visualisation wide, never side by side.
  const dumbbellPng = await figureToPng(dumbbellFigure(dumbbellRows, { axisTitle: "NAS %", earlierLabel, laterLabel }), 720, 300);
  const deltaPng = await figureToPng(
    divergingDeltaFigure(summary.map((r) => ({ domain: r.domain, deltaNasPp: r.deltaNasPp }))),
    720,
    300,
  );
  const movementRows: MovementBarRow[] = summary.map((r) => ({ label: `${r.domain} (n=${r.pairedN})`, movement: r.movement }));
  const movementPng = await figureToPng(movementStackedFigure(movementRows), 720, 300);

  out.push({ text: `Across all domains (${earlierLabel} → ${laterLabel})`, style: "h2" });
  out.push({ text: `NAS % — ${earlierLabel} → ${laterLabel}`, style: "h3" });
  out.push({ image: dumbbellPng, width: 500, margin: [0, 2, 0, 6] });
  out.push({ text: "Net change in NAS (pp)", style: "h3" });
  out.push({ image: deltaPng, width: 500, margin: [0, 2, 0, 6] });
  out.push({ text: "Band movement — moved down · stayed · moved up", style: "h3" });
  out.push({ image: movementPng, width: 500, margin: [0, 2, 0, 8] });

  // Leadership narrative
  const n = buildCohortNarrative(pairings, ctx);
  out.push({ text: "Leadership narrative", style: "h2" });
  if (n.supported.length) {
    out.push({ text: "Statistically supported", style: "h3" });
    out.push(bulletList(n.supported));
  }
  if (n.concerns.length) {
    out.push({ text: "Concerns", style: "h3" });
    out.push(bulletList(n.concerns));
  }
  if (n.patterns.length) {
    out.push({ text: "Patterns", style: "h3" });
    out.push(bulletList(n.patterns));
  }
  if (n.actions.length) {
    out.push({ text: "Suggested actions", style: "h3" });
    out.push(bulletList(n.actions));
  }

  // Cross-domain follow-up intersection (1-5): students flagged in 2+ domains.
  const followUp = crossDomainFollowUp(pairings);
  if (followUp.length > 0) {
    out.push({ text: "Follow-up across domains", style: "h2" });
    out.push({
      text: "Matched students who declined or stalled, joined across all domains in this phase. Two or more domains is the clearest intervention priority. Local Student IDs only.",
      style: "caption",
    });
    out.push(
      table(
        ["Local ID", "Domains", "Flagged in"],
        followUp.map((r) => [r.localStudentId, r.domainCount, r.flags.map((f) => `${f.domain} (${f.flag})`).join(", ")]),
        ["auto", "auto", "*"],
      ),
    );
  }

  for (const pc of pairings.values()) {
    out.push(...(await domainBlock(pc, y7Year, y9Year, store)));
  }
  return out;
}

export async function buildCohortDoc(
  store: Store,
  primaryYear: number,
  settings: Settings,
): Promise<TDocumentDefinitions> {
  const generatedAt = new Date();
  const [y7Year, y9Year] = cohortYears(primaryYear);
  const phases = trackablePhases(store, primaryYear);
  const ctx: NarrativeContext = {
    schoolName: settings.schoolName || "This school",
    schoolNumber: settings.schoolNumber,
    primaryYear,
    planLabel: settings.planLabel,
    planReferences: settings.improvementPlanRefs,
    trackedDomains: settings.trackedDomains,
  };

  const body: Content[] = [];
  body.push({ text: "Cohort tracking", style: "h1" });

  if (phases.length === 0) {
    const { earlier, later } = inferCohortLevels([...store.values()].map((e) => e.yearLevel));
    body.push({
      text: `No matched Year ${earlier} to Year ${later} cohort for ${primaryYear}. This report needs a Year ${earlier} file from ${y7Year} and a Year ${later} file from ${y9Year} for at least one domain.`,
      style: "lead",
    });
  } else {
    for (const phase of phases) {
      body.push(...(await phaseSection(store, primaryYear, phase, ctx, phases.length > 1)));
    }
  }

  // Cover subtitle: name the single phase, or signal both for a combined school.
  const subtitle =
    phases.length === 1
      ? `Section 10 · Year ${phases[0]!.earlier} ${y7Year} → Year ${phases[0]!.later} ${y9Year}`
      : phases.length > 1
        ? `Section 10 · cohort tracking · ${y7Year} → ${y9Year}`
        : "Section 10 · cohort tracking";

  return {
    info: { title: `NAPLAN ${primaryYear} cohort tracking`, creator: "NAPLAN Cohort Tracker" },
    pageSize: "A4",
    pageMargins: [40, 40, 40, 40],
    styles: PDF_STYLES,
    defaultStyle: { font: "Roboto", fontSize: 10, color: "#333533" },
    footer: footer(generatedAt),
    content: [
      ...coverPage({
        title: "NAPLAN Cohort Tracking",
        subtitle,
        schoolName: settings.schoolName,
        schoolNumber: settings.schoolNumber,
        generatedAt,
      }),
      ...body,
    ],
  };
}
