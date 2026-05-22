/**
 * Sections 1–9 overview PDF. Per-year-level participation, proficiency (with the
 * stacked-bar chart), cross-domain ranking, equity and skill gaps, plus the
 * year-on-year movement and the rules-based school narrative. NAPLAN attribution
 * framing is preserved (Year 7 = primary-school output; Year 9 = the school's
 * contribution). No student names appear.
 */
import {
  availableYears,
  bottomDescriptors,
  buildSchoolNarrative,
  domainsFor,
  equityBreakdown,
  getEntry,
  getPrimaryYearEntries,
  nasSummary,
  NAS,
  proficiencyPercentages,
  rankDomainsByNas,
  stackedProficiencyBarFigure,
  storeEntries,
  yearLevelsFor,
  yearOnYearNas,
  type ProficiencyPercentages,
  type Settings,
  type StackedBarRow,
  type Store,
} from "@naplan-throughline/core";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { figureToPng } from "./chartImage";
import { bulletList, coverPage, footer, pct1, PDF_STYLES, table } from "./common";

const ATTR_Y7 =
  "Year 7 NAPLAN (sat in Term 1) reflects students' primary-school learning — feeder-cohort intake, not this school's teaching.";
const ATTR_Y9 =
  "Year 9 reflects the secondary school's contribution (the cohort has had about two years here). NAPLAN is diagnostic evidence, not a target instrument.";

async function yearLevelSection(store: Store, primaryYear: number, yearLevel: number): Promise<Content[]> {
  const domains = domainsFor(store, primaryYear, yearLevel);
  if (domains.length === 0) return [];
  const out: Content[] = [];
  out.push({ text: `Year ${yearLevel} — ${primaryYear}`, style: "h2" });
  out.push({ text: yearLevel === 7 ? ATTR_Y7 : ATTR_Y9, style: "caption" });

  // S1 Participation
  out.push({ text: "Participation", style: "h3" });
  out.push(
    table(
      ["Domain", "Participated", "Total", "Rate"],
      domains.map((dom) => {
        const e = getEntry(store, primaryYear, yearLevel, dom)!;
        const rate = e.totalStudents > 0 ? (e.participants / e.totalStudents) * 100 : 0;
        return [dom, e.participants, e.totalStudents, pct1(rate)];
      }),
      ["*", "auto", "auto", "auto"],
    ),
  );

  // S2 Proficiency — chart + table
  const rows: StackedBarRow[] = domains.map((dom) => ({
    label: dom,
    percentages: proficiencyPercentages(getEntry(store, primaryYear, yearLevel, dom)!.studentReports),
  }));
  const h = Math.max(160, 70 + rows.length * 42);
  const png = await figureToPng(
    stackedProficiencyBarFigure(rows, { title: `Year ${yearLevel} proficiency mix`, xTitle: "% of participants" }),
    520,
    h,
  );
  out.push({ text: "Proficiency", style: "h3" });
  out.push({ image: png, width: 500, margin: [0, 2, 0, 6] });
  out.push(
    table(
      ["Domain", "NAS", "Developing", "Strong", "Exceeding"],
      rows.map((r) => [
        r.label,
        pct1(r.percentages[NAS]),
        pct1(r.percentages.Developing),
        pct1(r.percentages.Strong),
        pct1(r.percentages.Exceeding),
      ]),
    ),
  );

  // S4 Cross-domain ranking
  const perDomain: Record<string, ProficiencyPercentages> = {};
  for (const dom of domains) perDomain[dom] = rows.find((r) => r.label === dom)!.percentages;
  const ranked = rankDomainsByNas(perDomain);
  out.push({ text: "Highest need by domain (Section 4)", style: "h3" });
  out.push(
    table(
      ["Rank", "Domain", "NAS %", "Meeting+ %"],
      ranked.map((d, i) => {
        const p = perDomain[d.domain]!;
        return [i + 1, d.domain, pct1(d.nasPct), pct1(p.Strong + p.Exceeding)];
      }),
      ["auto", "*", "auto", "auto"],
    ),
  );

  // S6 Equity — compact per domain
  out.push({ text: "Equity (Section 6)", style: "h3" });
  const eqRows: (string | number)[][] = [];
  for (const dom of domains) {
    const eq = equityBreakdown(getEntry(store, primaryYear, yearLevel, dom)!.studentReports);
    const lbote = eq.lbote.find((g) => g.label === "LBOTE");
    const atsiText = eq.atsiSuppressed ? `suppressed (n=${eq.atsiCount}<5)` : `${eq.atsi.find((g) => g.label === "ATSI")?.nasGapVsCohort.toFixed(1) ?? "—"} pp`;
    eqRows.push([
      dom,
      pct1(eq.cohortNasPct),
      eq.lboteReported && lbote ? `${lbote.nasGapVsCohort >= 0 ? "+" : ""}${lbote.nasGapVsCohort.toFixed(1)} pp` : "not reported",
      atsiText,
    ]);
  }
  out.push(table(["Domain", "Cohort NAS%", "LBOTE gap", "ATSI gap"], eqRows, ["*", "auto", "auto", "auto"]));
  out.push({ text: "Gap = subgroup NAS% minus cohort NAS% (positive = more need). Subgroups under n=5 are suppressed.", style: "caption" });

  return out;
}

function skillGapsSection(store: Store, primaryYear: number): Content[] {
  const out: Content[] = [];
  const yearLevel = 9; // diagnostic skill gaps most relevant for the school's own cohort
  const domains = domainsFor(store, primaryYear, yearLevel);
  if (domains.length === 0) return out;
  out.push({ text: "Skill gaps — hardest-going descriptors (Section 5)", style: "h2" });
  out.push({ text: `Year 9, ${primaryYear}. Items attempted by at least half the students who saw them.`, style: "caption" });
  for (const dom of domains) {
    const results = getEntry(store, primaryYear, yearLevel, dom)?.studentResults ?? [];
    const bottom = bottomDescriptors(results, 5);
    if (bottom.length === 0) continue;
    out.push({ text: dom, style: "h3" });
    out.push(
      table(
        ["Descriptor", "Subdomain", "Difficulty", "Accuracy"],
        bottom.map((d) => [d.descriptor, d.subdomain, d.itemDifficulty ?? "—", pct1(d.accuracyPct)]),
        ["*", "auto", "auto", "auto"],
      ),
    );
  }
  return out;
}

function yearOnYearSection(store: Store, primaryYear: number): Content[] {
  const out: Content[] = [];
  const years = availableYears(store);
  if (years.length < 2) return out;
  out.push({ text: "Year-on-year NAS movement (Section 3)", style: "h2", pageBreak: "before" });
  out.push({
    text: "Each year is a different cohort. Year 7 movement is feeder-cohort variation; Year 9 reflects the school. Lower NAS is better. Cohort tracking of the same students is in the separate Section 10 report.",
    style: "caption",
  });
  for (const yearLevel of yearLevelsFor(store, primaryYear)) {
    const domains = domainsFor(store, primaryYear, yearLevel);
    if (domains.length === 0) continue;
    out.push({ text: `Year ${yearLevel}`, style: "h3" });
    const rows: (string | number)[][] = [];
    for (const dom of domains) {
      const history = years
        .map((y) => {
          const e = getEntry(store, y, yearLevel, dom);
          return e ? { year: y, summary: nasSummary(e.studentReports) } : null;
        })
        .filter((x): x is { year: number; summary: ReturnType<typeof nasSummary> } => x != null);
      const change = yearOnYearNas(history);
      const status =
        change.status === "improved" ? "improved" : change.status === "worsened" ? "worsened" : change.status === "flat" ? "flat" : "—";
      rows.push([
        dom,
        history.map((p) => p.year).join("→") || "—",
        change.pctDelta == null ? "—" : `${change.pctDelta >= 0 ? "+" : ""}${change.pctDelta.toFixed(1)} pp`,
        status,
      ]);
    }
    out.push(table(["Domain", "Years", "NAS Δ", "Status"], rows, ["*", "auto", "auto", "auto"]));
  }
  return out;
}

function narrativeSection(store: Store, primaryYear: number, settings: Settings): Content[] {
  const ctx = {
    schoolName: settings.schoolName || "This school",
    schoolNumber: settings.schoolNumber,
    primaryYear,
    planLabel: settings.planLabel,
    planReferences: settings.improvementPlanRefs,
    trackedDomains: settings.trackedDomains,
  };
  const n = buildSchoolNarrative(storeEntries(store), ctx);
  const out: Content[] = [{ text: "School narrative (Section 9)", style: "h2", pageBreak: "before" }];
  out.push({ text: n.overall, style: "body" });
  if (n.strengths.length) {
    out.push({ text: "Strengths", style: "h3" });
    out.push(bulletList(n.strengths));
  }
  if (n.concerns.length) {
    out.push({ text: "Concerns", style: "h3" });
    out.push(bulletList(n.concerns));
  }
  if (n.yearOnYear.length) {
    out.push({ text: "Year-on-year", style: "h3" });
    out.push(bulletList(n.yearOnYear));
  }
  if (n.recommendations.length) {
    out.push({ text: "Recommendations", style: "h3" });
    out.push(bulletList(n.recommendations));
  }
  out.push({ text: "A rules-based draft to support — not replace — professional judgement.", style: "caption" });
  return out;
}

export async function buildOverviewDoc(
  store: Store,
  primaryYear: number,
  settings: Settings,
): Promise<TDocumentDefinitions> {
  const generatedAt = new Date();
  const entries = getPrimaryYearEntries(store, primaryYear);

  const body: Content[] = [];
  body.push({ text: "Overview", style: "h1" });
  body.push({
    text: `This overview covers ${entries.length} dataset(s) loaded for ${primaryYear}, across ${
      yearLevelsFor(store, primaryYear).map((y) => `Year ${y}`).join(" and ") || "no year levels"
    }. Writing and gender are not in the SSSR export and are out of scope.`,
    style: "lead",
  });

  for (const yearLevel of yearLevelsFor(store, primaryYear)) {
    body.push(...(await yearLevelSection(store, primaryYear, yearLevel)));
  }
  body.push(...skillGapsSection(store, primaryYear));
  body.push(...yearOnYearSection(store, primaryYear));
  body.push(...narrativeSection(store, primaryYear, settings));

  return {
    info: { title: `NAPLAN ${primaryYear} overview`, creator: "Naplan Throughline" },
    pageSize: "A4",
    pageMargins: [40, 40, 40, 40],
    styles: PDF_STYLES,
    defaultStyle: { font: "Roboto", fontSize: 10, color: "#333533" },
    footer: footer(generatedAt),
    content: [
      ...coverPage({
        title: "NAPLAN Overview",
        subtitle: `Sections 1–9 · ${primaryYear}`,
        schoolName: settings.schoolName,
        schoolNumber: settings.schoolNumber,
        generatedAt,
      }),
      ...body,
    ],
  };
}
