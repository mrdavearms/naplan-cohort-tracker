/**
 * Section 9 (school narrative) + Section 10 (cohort leadership narrative),
 * rules-based, ported from `naplan/narrative.py` and the narrative block of
 * `naplan/sections/s10_cohort_tracking.py`.
 *
 * School identity is DATA, not code: the school name, primary year, and any
 * improvement-plan references are supplied via NarrativeContext (populated by
 * Settings). The narrative cites a school's own plan references by role, so it
 * works for any school without hard-coded WHS/AIP/KIS strings.
 */
import { NAS } from "../constants";
import { shortLevel, yearOnYearContext } from "../phase";
import { mcnemarExactPValue } from "../stats";
import type { LoadedFile, PairedCohort, StudentReportRow } from "../types";
import { bottomDescriptors } from "./skillGap";
import { proficiencyCounts, proficiencyPercentages } from "./proficiency";

/** A school's own improvement-plan reference, cited by semantic role. */
export interface ImprovementPlanReference {
  /** Where the narrative should cite this, e.g. "data-inquiry" or "at-risk-students". */
  role: string;
  /** The school's own code/label, e.g. "KIS 1.b". */
  code: string;
  /** Optional human description, e.g. "Year 7 inquiry group, data focus". */
  description?: string;
}

export interface NarrativeContext {
  schoolName: string;
  schoolNumber?: string;
  primaryYear: number;
  /** Framework name for prose, e.g. "AIP". Defaults to "improvement plan". */
  planLabel?: string;
  planReferences?: ImprovementPlanReference[];
  /** Domains the year-on-year + recommendation focus tracks. Defaults to Reading + Numeracy. */
  trackedDomains?: string[];
}

export interface SchoolNarrative {
  heading: string;
  overall: string;
  strengths: string[];
  concerns: string[];
  yearOnYear: string[];
  recommendations: string[];
}

export interface CohortNarrative {
  supported: string[];
  concerns: string[];
  patterns: string[];
  actions: string[];
}

const DEFAULT_TRACKED = ["Reading", "Numeracy"];
const round0 = (x: number): string => `${Math.round(x)}`;
const signed1 = (x: number): string => `${x >= 0 ? "+" : ""}${x.toFixed(1)}`;

function planLabel(ctx: NarrativeContext): string {
  return ctx.planLabel ?? "improvement plan";
}

/** Cite a plan reference for a role: " Map onto KIS 1.b (description)." — or "" if none. */
function citePlanRef(ctx: NarrativeContext, role: string): string {
  const ref = ctx.planReferences?.find((r) => r.role === role);
  if (!ref) return "";
  const desc = ref.description ? ` (${ref.description})` : "";
  return ` Map onto ${ref.code}${desc}.`;
}

function meetingPct(reports: readonly StudentReportRow[]): number {
  const p = proficiencyPercentages(reports);
  return p.Strong + p.Exceeding;
}
function nasPct(reports: readonly StudentReportRow[]): number {
  return proficiencyPercentages(reports)["Needs additional support"];
}

function formatP(p: number | null): string {
  if (p === null) return "n/a";
  if (p < 0.001) return "<0.001";
  return p.toFixed(3);
}

// ── Section 9 — school narrative ────────────────────────────────────────────

function summariseOverall(entries: LoadedFile[]): string {
  if (entries.length === 0) return "No data loaded.";
  const levels = [...new Set(entries.map((e) => e.yearLevel))].sort((a, b) => a - b);
  const domains = [...new Set(entries.map((e) => e.domain))].sort((a, b) => a.localeCompare(b));

  const ratesByLevel = new Map<number, number[]>();
  for (const e of entries) {
    const rate = e.totalStudents > 0 ? (e.participants / e.totalStudents) * 100 : 0;
    let arr = ratesByLevel.get(e.yearLevel);
    if (!arr) {
      arr = [];
      ratesByLevel.set(e.yearLevel, arr);
    }
    arr.push(rate);
  }
  const ratePhrase = [...ratesByLevel.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([yl, rates]) => `Year ${yl} averaging ${round0(rates.reduce((s, r) => s + r, 0) / rates.length)}% participation`)
    .join("; ");

  const meeting = entries.map((e) => meetingPct(e.studentReports));
  const nas = entries.map((e) => nasPct(e.studentReports));
  const avgMeeting = meeting.reduce((s, x) => s + x, 0) / meeting.length;
  const avgNas = nas.reduce((s, x) => s + x, 0) / nas.length;

  return (
    `Across Year ${levels.join(", ")} in ${domains.join(", ")} — ${ratePhrase}. ` +
    `On average across loaded domains, ${round0(avgMeeting)}% of participating students ` +
    `are at Strong or Exceeding, while ${round0(avgNas)}% are at Needs additional support.`
  );
}

function rankBy(entries: LoadedFile[], keyFn: (e: LoadedFile) => number): LoadedFile[] {
  return [...entries].sort((a, b) => keyFn(b) - keyFn(a));
}

function strengths(entries: LoadedFile[]): string[] {
  return rankBy(entries, (e) => meetingPct(e.studentReports))
    .slice(0, 2)
    .map((e) => {
      const p = proficiencyPercentages(e.studentReports);
      return (
        `Year ${e.yearLevel} ${e.domain}: ${round0(p.Strong + p.Exceeding)}% of participating ` +
        `students are at Strong or Exceeding, with ${round0(p.Exceeding)}% at Exceeding.`
      );
    });
}

function concerns(entries: LoadedFile[]): string[] {
  return rankBy(entries, (e) => nasPct(e.studentReports))
    .slice(0, 2)
    .map((e) => {
      const counts = proficiencyCounts(e.studentReports);
      const p = proficiencyPercentages(e.studentReports);
      return (
        `Year ${e.yearLevel} ${e.domain}: ${counts["Needs additional support"]} participating ` +
        `students (${round0(p["Needs additional support"])}%) are at Needs additional support.`
      );
    });
}

function yearOnYearLines(allEntries: LoadedFile[], ctx: NarrativeContext): string[] {
  const tracked = ctx.trackedDomains ?? DEFAULT_TRACKED;
  const get = (year: number, yl: number, dom: string) =>
    allEntries.find((e) => e.yearOfTest === year && e.yearLevel === yl && e.domain === dom);
  // The year levels actually present for the primary year, ascending — works for
  // primary (3, 5), secondary (7, 9), or a combined school (all four).
  const levels = [
    ...new Set(allEntries.filter((e) => e.yearOfTest === ctx.primaryYear).map((e) => e.yearLevel)),
  ].sort((a, b) => a - b);
  const lines: string[] = [];
  for (const yl of levels) {
    for (const dom of tracked) {
      const current = get(ctx.primaryYear, yl, dom);
      if (!current) continue;
      const curNas = proficiencyCounts(current.studentReports)["Needs additional support"];
      const context = yearOnYearContext(yl);
      const prior = get(ctx.primaryYear - 1, yl, dom);
      if (!prior) {
        lines.push(`Year ${yl} ${dom} ${context}: ${curNas} students at NAS in ${ctx.primaryYear}. No ${ctx.primaryYear - 1} data loaded.`);
        continue;
      }
      const priorNas = proficiencyCounts(prior.studentReports)["Needs additional support"];
      const delta = curNas - priorNas;
      const direction =
        Math.abs(delta) <= 2 ? "flat (within 2 students)" : delta < 0 ? `NAS count down by ${Math.abs(delta)}` : `NAS count up by ${delta}`;
      lines.push(
        `Year ${yl} ${dom} ${context}: ${priorNas} at NAS in ${ctx.primaryYear - 1} → ${curNas} at NAS in ${ctx.primaryYear} — ${direction}.`,
      );
    }
  }
  return lines;
}

function schoolRecommendations(entries: LoadedFile[]): string[] {
  const recs: string[] = [];

  const nasRanked = rankBy(entries, (e) => nasPct(e.studentReports));
  const top = nasRanked[0];
  if (top && top.studentResults.length > 0) {
    const bottom = bottomDescriptors(top.studentResults, 10);
    if (bottom.length > 0) {
      const subCounts = new Map<string, number>();
      for (const b of bottom) subCounts.set(b.subdomain, (subCounts.get(b.subdomain) ?? 0) + 1);
      let topSub = "";
      let topCount = -1;
      for (const [sub, c] of subCounts) {
        if (c > topCount) {
          topSub = sub;
          topCount = c;
        }
      }
      recs.push(
        `Prioritise teacher professional learning on ${topSub} in Year ${top.yearLevel} ${top.domain}: ` +
          `${topCount} of the 10 lowest-accuracy items fall in this subdomain.`,
      );
    }
  }

  for (const e of entries) {
    const parts = e.studentReports.filter((r) => r.participationCode === "Participated");
    const cohortNas = nasPct(e.studentReports);
    for (const [label, mask] of [
      ["LBOTE", (p: (typeof parts)[number]) => p.lboteStatus === "Yes"],
      ["Aboriginal and/or Torres Strait Islander", (p: (typeof parts)[number]) => p.atsiGroup === "ATSI"],
    ] as const) {
      const grp = parts.filter(mask);
      if (grp.length < 5) continue;
      const grpNas = (grp.filter((p) => p.proficiencyLevel === NAS).length / grp.length) * 100;
      if (grpNas - cohortNas > 5) {
        recs.push(
          `Investigate the equity gap for ${label} students in Year ${e.yearLevel} ${e.domain}: ` +
            `their NAS rate (${round0(grpNas)}%) is ${round0(grpNas - cohortNas)} percentage points ` +
            `above the whole-cohort rate.`,
        );
        break;
      }
    }
    if (recs.length >= 3) break;
  }

  if (recs.length < 3) {
    recs.push(
      "Use the Section 8 NAS list to set intervention groups by class for the next term, " +
        "with priority for students at NAS in two or more domains.",
    );
  }
  return recs.slice(0, 3);
}

/** Build the Section 9 plain-English school narrative for the primary year. */
export function buildSchoolNarrative(
  allEntries: readonly LoadedFile[],
  ctx: NarrativeContext,
): SchoolNarrative {
  const entries = allEntries.filter((e) => e.yearOfTest === ctx.primaryYear);
  const numberSuffix = ctx.schoolNumber ? ` (${ctx.schoolNumber})` : "";
  return {
    heading: `${ctx.schoolName}${numberSuffix} — ${ctx.primaryYear} NAPLAN narrative`,
    overall: summariseOverall(entries),
    strengths: strengths(entries),
    concerns: concerns(entries),
    yearOnYear: yearOnYearLines([...allEntries], ctx),
    recommendations: schoolRecommendations(entries),
  };
}

// ── Section 10 — cohort leadership narrative ────────────────────────────────

interface DomainSummary {
  n: number;
  p7: number;
  p9: number;
  delta: number;
  pValue: number | null;
  leaversNasPct: number;
  leaversTotal: number;
  stayersY7NasPct: number;
}

function summariseCohort(pairings: Map<string, PairedCohort>): Map<string, DomainSummary> {
  const out = new Map<string, DomainSummary>();
  for (const [dom, pc] of pairings) {
    if (pc.paired.length === 0) continue;
    const n = pc.paired.length;
    const p7 = (pc.paired.filter((s) => s.proficiencyY7 === NAS).length / n) * 100;
    const p9 = (pc.paired.filter((s) => s.proficiencyY9 === NAS).length / n) * 100;
    // mcnemar p via the same path the stats core uses
    const movedOut = pc.paired.filter((s) => s.proficiencyY7 === NAS && s.proficiencyY9 !== NAS).length;
    const movedIn = pc.paired.filter((s) => s.proficiencyY7 !== NAS && s.proficiencyY9 === NAS).length;
    const leaversNas = pc.leavers.filter((l) => l.proficiencyY7 === NAS).length;
    const leaversTotal = pc.leavers.length;
    out.set(dom, {
      n,
      p7,
      p9,
      delta: p9 - p7,
      pValue: movedOut + movedIn === 0 ? null : mcnemarExactPValue(movedOut, movedIn),
      leaversNasPct: leaversTotal > 0 ? (leaversNas / leaversTotal) * 100 : 0,
      leaversTotal,
      stayersY7NasPct: p7,
    });
  }
  return out;
}

/** Build the Section 10 leadership narrative (supported / concerns / patterns / actions). */
export function buildCohortNarrative(
  pairings: Map<string, PairedCohort>,
  ctx: NarrativeContext,
): CohortNarrative {
  const summary = summariseCohort(pairings);

  // All pairings in a phase share the same levels (3→5 primary, 7→9 secondary).
  const sample = [...pairings.values()][0];
  const eL = sample ? shortLevel(sample.earlierLevel) : "Y7";
  const lL = sample ? shortLevel(sample.laterLevel) : "Y9";
  const laterYearLabel = sample ? `Year ${sample.laterLevel}` : "Year 9";

  const supported: string[] = [];
  for (const [dom, s] of summary) {
    if (s.delta < 0 && s.pValue !== null && s.pValue < 0.05) {
      supported.push(
        `${dom}: paired-cohort NAS dropped from ${s.p7.toFixed(1)}% to ${s.p9.toFixed(1)}% ` +
          `(${signed1(s.delta)} pp). McNemar p = ${formatP(s.pValue)} — the improvement is ` +
          `statistically distinguishable from chance.`,
      );
    }
  }
  if (supported.length === 0) {
    supported.push(
      "No domains pass the strict combined test of paired NAS reduction with McNemar p<0.05 — " +
        "see the statistical-robustness drill-down for the per-domain detail.",
    );
  }

  const concernsOut: string[] = [];
  for (const [dom, s] of summary) {
    if (s.leaversTotal > 0 && s.leaversNasPct > s.stayersY7NasPct + 10) {
      concernsOut.push(
        `${dom}: leavers' ${eL} NAS rate (${s.leaversNasPct.toFixed(1)}%) was substantially higher than ` +
          `stayers' (${s.stayersY7NasPct.toFixed(1)}%). Part of the cohort improvement may reflect ` +
          `selection rather than teaching effect.`,
      );
    }
    if (s.delta < 0 && (s.pValue === null || s.pValue >= 0.05)) {
      concernsOut.push(
        `${dom}: NAS dropped ${signed1(s.delta)} pp but McNemar p = ${formatP(s.pValue)} ` +
          `(not significant). With this cohort size we can't rule out chance.`,
      );
    }
  }
  if (concernsOut.length === 0) {
    concernsOut.push("No major caveats surfaced by the attrition or significance checks.");
  }

  const patterns = [
    "The transition matrix is the single most informative chart for follow-up with subject leaders. " +
      `Look at: (a) ${eL}-NAS students who moved to Strong or Exceeding — what worked? and (b) ${eL}-Strong ` +
      "students who slipped to NAS or Developing — what changed for them?",
    `The class-group drill-down shows whether any ${eL} class produced disproportionate ${lL} NAS rates. ` +
      "Useful context, but treat carefully — class composition reflects school streaming.",
    "Equity sub-cohort sizes are small, so any directional finding warrants follow-up with the " +
      "individual students rather than statistical generalisation.",
  ];

  const actions: string[] = [];
  const rd = summary.get("Reading");
  if (rd && rd.delta < -5 && rd.pValue !== null && rd.pValue < 0.05) {
    actions.push(
      `Document and propagate the Reading improvement. A ${Math.abs(rd.delta).toFixed(1)} pp NAS reduction ` +
        `(p<0.05) is the strongest defensible result in this dataset. Capture the practice, processes, and ` +
        `instructional model that contributed.${citePlanRef(ctx, "data-inquiry")}`,
    );
  }
  let weakest: [string, DomainSummary] | null = null;
  for (const entry of summary) if (!weakest || entry[1].p9 > weakest[1].p9) weakest = entry;
  if (weakest) {
    actions.push(
      `Prioritise ${weakest[0]} for next year. This is the weakest ${laterYearLabel} result in the paired cohort ` +
        `(${weakest[1].p9.toFixed(1)}% NAS).${citePlanRef(ctx, "data-inquiry")}`,
    );
  }
  // Anchor the target to what THIS cohort actually achieved rather than a
  // hardcoded range. A number invented here reads as evidence-based and would
  // plausibly end up in a real improvement-plan target.
  const trackedDeltas = [...summary.values()]
    .map((d) => d.delta)
    .filter((d) => Number.isFinite(d));
  const bestReduction = trackedDeltas.length > 0 ? Math.min(...trackedDeltas) : 0;
  const evidenceSentence =
    bestReduction < 0
      ? `The strongest paired-cohort result here is a ${Math.abs(bestReduction).toFixed(1)} pp NAS reduction ` +
        `across ${eL} → ${lL} — a target of similar size is defensible; one well beyond it is not yet ` +
        `supported by this evidence.`
      : `This cohort did not achieve a NAS reduction across ${eL} → ${lL}, so any target should be set ` +
        `against the practice changes planned for next year rather than extrapolated from this result.`;
  actions.push(
    `Use this cohort analysis to inform the NAPLAN target in the ${ctx.primaryYear + 1} ${planLabel(ctx)}. ` +
      evidenceSentence,
  );
  actions.push(
    "Build the named-student intervention list from the transition matrix: students who stayed at NAS " +
      `across the full two years are the highest-priority cohort for intensive support.${citePlanRef(ctx, "at-risk-students")}`,
  );

  return { supported, concerns: concernsOut, patterns, actions };
}
