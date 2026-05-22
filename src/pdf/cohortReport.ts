/**
 * Section 10 cohort deep-dive PDF — the headline value-add report. Tracks the
 * same students from Year 7 (primaryYear − 2) to Year 9 (primaryYear), matched
 * on Local Student ID. McNemar's exact test (not CI overlap) assesses the paired
 * NAS change. No student names appear; the "left WHS" sentinel is relabelled.
 */
import {
  attritionAnalysis,
  buildCohortNarrative,
  buildCohortPairings,
  cohortHeadline,
  cohortMatchRate,
  cohortYears,
  equitySubCohorts,
  interpretAttrition,
  interpretEquity,
  interpretMcnemar,
  interpretTransition,
  interpretWilson,
  mcnemarPaired,
  transitionHeatmapFigure,
  transitionSankeyFigure,
  wilsonCiDotPlotFigure,
  type PairedCohort,
  type Settings,
  type Store,
} from "@naplan-throughline/core";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { figureToPng } from "./chartImage";
import { bulletList, coverPage, footer, pct1, PDF_STYLES, table } from "./common";

const fmtP = (p: number | null): string => (p == null ? "n/a" : p < 0.001 ? "<0.001" : p.toFixed(3));
const ppStr = (x: number | null): string => (x == null ? "—" : `${x >= 0 ? "+" : ""}${x.toFixed(1)} pp`);

async function domainBlock(pc: PairedCohort, y7Year: number, y9Year: number): Promise<Content[]> {
  const out: Content[] = [];
  out.push({ text: `${pc.domain} — Year 7 to Year 9 transition`, style: "h2", pageBreak: "before" });

  const sankey = await figureToPng(transitionSankeyFigure(pc, y7Year, y9Year), 520, 360);
  const heat = await figureToPng(transitionHeatmapFigure(pc, y7Year, y9Year), 520, 360);
  out.push({ image: sankey, width: 500, margin: [0, 2, 0, 6] });
  out.push({ image: heat, width: 500, margin: [0, 2, 0, 6] });
  out.push(bulletList(interpretTransition(pc)));

  const wilson = await figureToPng(wilsonCiDotPlotFigure(pc, y7Year, y9Year), 520, 200);
  const mc = mcnemarPaired(pc.paired);
  out.push({ text: "NAS rate, Year 7 vs Year 9 (Wilson 95% CI · McNemar)", style: "h3" });
  out.push({ image: wilson, width: 500, margin: [0, 2, 0, 6] });
  out.push({ text: `McNemar exact p = ${fmtP(mc.pValue)}. ${mc.note}`, style: "caption" });
  out.push(bulletList([...interpretMcnemar(mc, pc.domain, pc.paired.length), ...interpretWilson(pc)]));

  const attr = attritionAnalysis(pc);
  out.push({ text: "Attrition — stayers vs leavers", style: "h3" });
  out.push(
    table(
      ["Group", "n", "Y7 NAS count", "Y7 NAS%"],
      [
        ["Stayers (matched)", attr.stayersN, attr.stayersNasCount, pct1(attr.stayersNasPct)],
        ["Leavers", attr.leaversN, attr.leaversNasCount, pct1(attr.leaversNasPct)],
      ],
      ["*", "auto", "auto", "auto"],
    ),
  );
  out.push(bulletList(interpretAttrition(pc)));

  const sub = equitySubCohorts(pc);
  out.push({ text: "Equity within the matched cohort", style: "h3" });
  out.push(
    table(
      ["Sub-cohort", "n", "Y7 NAS%", "Y9 NAS%", "Δ NAS"],
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

export async function buildCohortDoc(
  store: Store,
  primaryYear: number,
  settings: Settings,
): Promise<TDocumentDefinitions> {
  const generatedAt = new Date();
  const [y7Year, y9Year] = cohortYears(primaryYear);
  const pairings = buildCohortPairings(store, primaryYear);
  const ctx = {
    schoolName: settings.schoolName || "This school",
    schoolNumber: settings.schoolNumber,
    primaryYear,
    planLabel: settings.planLabel,
    planReferences: settings.improvementPlanRefs,
    trackedDomains: settings.trackedDomains,
  };

  const body: Content[] = [];
  body.push({ text: "Cohort tracking", style: "h1" });

  if (pairings.size === 0) {
    body.push({
      text: `No matched Year 7 to Year 9 cohort for ${primaryYear}. This report needs a Year 7 file from ${y7Year} and a Year 9 file from ${y9Year} for at least one domain.`,
      style: "lead",
    });
  } else {
    const mr = cohortMatchRate(pairings);
    body.push({
      text: `The same ${mr.matched} students tracked from Year 7 (${y7Year}) to Year 9 (${y9Year}), matched on Local Student ID (${pct1(mr.matchRatePct)} of the ${mr.y9CohortTotal} Year 9 students). ${mr.leavers} left after Year 7; ${mr.joiners} joined after Year 7.`,
      style: "lead",
    });

    // Headline table
    body.push({ text: "Paired-cohort headline", style: "h2" });
    body.push(
      table(
        ["Domain", "Paired n", "Y7 NAS%", "Y9 NAS%", "Δ NAS", "McNemar p"],
        [...pairings.entries()].map(([dom, pc]) => {
          const h = cohortHeadline(pc);
          const mc = mcnemarPaired(pc.paired);
          return [dom, h.pairedN, pct1(h.y7NasPct), pct1(h.y9NasPct), ppStr(h.deltaNasPp), fmtP(mc.pValue)];
        }),
        ["*", "auto", "auto", "auto", "auto", "auto"],
      ),
    );
    body.push({ text: "Lower NAS is better. A McNemar p < 0.05 means the paired change is distinguishable from chance.", style: "caption" });

    // Leadership narrative
    const n = buildCohortNarrative(pairings, ctx);
    body.push({ text: "Leadership narrative", style: "h2" });
    if (n.supported.length) {
      body.push({ text: "Statistically supported", style: "h3" });
      body.push(bulletList(n.supported));
    }
    if (n.concerns.length) {
      body.push({ text: "Concerns", style: "h3" });
      body.push(bulletList(n.concerns));
    }
    if (n.patterns.length) {
      body.push({ text: "Patterns", style: "h3" });
      body.push(bulletList(n.patterns));
    }
    if (n.actions.length) {
      body.push({ text: "Suggested actions", style: "h3" });
      body.push(bulletList(n.actions));
    }

    for (const pc of pairings.values()) {
      body.push(...(await domainBlock(pc, y7Year, y9Year)));
    }
  }

  return {
    info: { title: `NAPLAN ${primaryYear} cohort tracking`, creator: "Naplan Throughline" },
    pageSize: "A4",
    pageMargins: [40, 40, 40, 40],
    styles: PDF_STYLES,
    defaultStyle: { font: "Roboto", fontSize: 10, color: "#333533" },
    footer: footer(generatedAt),
    content: [
      ...coverPage({
        title: "NAPLAN Cohort Tracking",
        subtitle: `Section 10 · Year 7 ${y7Year} → Year 9 ${y9Year}`,
        schoolName: settings.schoolName,
        schoolNumber: settings.schoolNumber,
        generatedAt,
      }),
      ...body,
    ],
  };
}
