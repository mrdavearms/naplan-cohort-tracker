/**
 * Principal-lens interpretation bullets for the Section 10 drill-downs.
 * Ported from `naplan/cohort_interpret.py`. Each generator takes the same data
 * the charts use and returns plain-text bullet strings (the caller renders).
 * Australian English; no student names; sub-cohorts of n<5 described
 * qualitatively, never with identifying numbers.
 *
 * Deviations from the legacy:
 * - interpretWilson's "not confirmed" bullet says "this domain" (the legacy
 *   leaked a literal "{dom}" placeholder — a bug).
 * - interpretReadingSubdomains cites the school's configurable plan reference
 *   (role "data-inquiry") instead of a hard-coded "AIP KIS 1.b".
 */
import { NAS, PROFICIENCY_LEVELS } from "../constants";
import { mcnemarPaired, transitionMatrix } from "../cohort";
import { cohortNextStep, shortLevel } from "../phase";
import { wilsonCi } from "../stats";
import type { McNemarResult, PairedCohort, StudentResultRow } from "../types";
import { attritionComposition, detectabilityFloor } from "./cohortTracking";
import type { NarrativeContext } from "./narrative";

const SUPPRESSION_THRESHOLD = 5;
const round0 = (x: number): string => `${Math.round(x)}`;
const f1 = (x: number): string => x.toFixed(1);
const signed1 = (x: number): string => `${x >= 0 ? "+" : ""}${x.toFixed(1)}`;

function formatP(p: number | null): string {
  if (p === null) return "n/a";
  if (p < 0.001) return "<0.001";
  return p.toFixed(3);
}

const I = {
  NAS: PROFICIENCY_LEVELS.indexOf("Needs additional support"),
  DEV: PROFICIENCY_LEVELS.indexOf("Developing"),
  STRONG: PROFICIENCY_LEVELS.indexOf("Strong"),
  EXC: PROFICIENCY_LEVELS.indexOf("Exceeding"),
};

// ── Drill-down A — McNemar ──────────────────────────────────────────────────
export function interpretMcnemar(
  r: McNemarResult,
  dom: string,
  n: number,
  earlierLevel = 7,
  laterLevel = 9,
): string[] {
  const eL = shortLevel(earlierLevel);
  const lL = shortLevel(laterLevel);
  const nextStep = cohortNextStep(earlierLevel, laterLevel);
  const bullets: string[] = [];
  const movedOut = r.movedOutOfNas;
  const movedIn = r.movedIntoNas;
  const discordant = movedOut + movedIn;
  const net = movedOut - movedIn;

  if (discordant === 0) {
    bullets.push(
      "**No change in NAS status across the cohort.** Zero students moved into or out of NAS " +
        `between ${eL} and ${lL} in this domain. The NAS group is fixed — the same students it was two years ago.`,
    );
  } else if (net > 0) {
    const ratioPhrase =
      movedIn === 0
        ? "no students moved in the wrong direction"
        : `${movedOut} improving for every ${movedIn} declining`;
    bullets.push(
      `**Direction is positive.** ${movedOut} students moved out of NAS, ${movedIn} moved in — ${ratioPhrase}. ` +
        `For a ${dom} cohort of ${n} paired students, this is genuine directional movement, even if the absolute counts are small.`,
    );
  } else if (net < 0) {
    bullets.push(
      `**Direction is negative.** ${movedIn} students moved into NAS while only ${movedOut} moved out — ` +
        `a net decline of ${Math.abs(net)} students. In this domain the cohort is moving the wrong way, and the ` +
        `students who slipped into NAS in ${lL} — listed by Local Student ID under "Follow-up across domains" ` +
        "below — are the priority list for the leadership team to review.",
    );
  } else {
    bullets.push(
      `**Direction is flat.** ${movedOut} students moved out of NAS and ${movedIn} moved in — equal counts in both ` +
        "directions. The size of the NAS group is preserved but the composition has changed; check whether the new " +
        `NAS entrants were stronger students in ${eL} who lost ground.`,
    );
  }

  if (r.pValue === null) {
    bullets.push(
      "**McNemar's test is not applicable** when zero students change NAS status — the test needs students " +
        "whose NAS status changed (in either direction), and with none there is nothing to test. The direction " +
        "is what it is; statistical inference doesn't add anything.",
    );
  } else if (r.pValue < 0.05) {
    bullets.push(
      `**Statistical confidence is high.** McNemar exact p = ${formatP(r.pValue)} — the change is unlikely to be ` +
        "chance. We can describe this result to the leadership team and the community as a confirmed cohort effect, " +
        "not a directional hope.",
    );
  } else {
    bullets.push(
      `**Statistical confidence is limited.** McNemar exact p = ${formatP(r.pValue)}. With only ${discordant} ` +
        `students changing NAS status out of ${n} paired, the cohort is too small for the test to rule out chance ` +
        "even where the direction is encouraging. This is a sample-size limit, not a data quality issue — describe " +
        "the result as 'directionally improving, not yet statistically confirmed' rather than as proven.",
    );
  }

  if (r.stayersNas === 1) {
    bullets.push(
      `**One student was at NAS in both ${eL} and ${lL}.** That student needs a named intervention plan for ${nextStep} in this ` +
        "domain — two years at NAS is the clearest indicator that current support hasn't reached them.",
    );
  } else if (r.stayersNas > 1) {
    bullets.push(
      `**${r.stayersNas} students were at NAS in both ${eL} and ${lL}.** This is the highest-priority intervention list ` +
        "for the next school year in this domain. Two years at NAS is strong evidence the current approach isn't " +
        "reaching them — they need named, individualised plans rather than generic cohort-level support.",
    );
  }

  if (movedIn === 1) {
    bullets.push(
      "**One student moved from not-NAS to NAS.** Worth a direct look — check engagement, attendance, wellbeing, " +
        "and transition factors before assuming the result is academic.",
    );
  } else if (movedIn > 1) {
    bullets.push(
      `**${movedIn} students slipped from not-NAS to NAS.** Each is worth a named conversation: regression at this ` +
        "scale isn't random noise. Common factors to investigate are attendance disruption, wellbeing changes, " +
        "transition between subject teachers, and engagement signals.",
    );
  }

  return bullets;
}

// ── Drill-down B — Attrition ────────────────────────────────────────────────
export function interpretAttrition(pc: PairedCohort): string[] {
  const eL = shortLevel(pc.earlierLevel);
  const lL = shortLevel(pc.laterLevel);
  const leaversTotal = pc.leavers.length;
  const stayersTotal = pc.paired.length;
  const leaversNas = pc.leavers.filter((l) => l.proficiencyY7 === NAS).length;
  const stayersNas = pc.paired.filter((s) => s.proficiencyY7 === NAS).length;
  const leaversPct = (leaversNas / Math.max(leaversTotal, 1)) * 100;
  const stayersPct = (stayersNas / Math.max(stayersTotal, 1)) * 100;
  const diff = leaversPct - stayersPct;

  const isTop = (p: string | null) => p === "Strong" || p === "Exceeding";
  const leaversTopPct = (pc.leavers.filter((l) => isTop(l.proficiencyY7)).length / Math.max(leaversTotal, 1)) * 100;
  const stayersTopPct = (pc.paired.filter((s) => isTop(s.proficiencyY7)).length / Math.max(stayersTotal, 1)) * 100;
  const topDiff = leaversTopPct - stayersTopPct;

  const bullets: string[] = [];

  if (Math.abs(diff) < 5) {
    bullets.push(
      `**No clear selection effect at the NAS end.** Leavers' ${eL} NAS rate (${f1(leaversPct)}%) is comparable to ` +
        `stayers' (${f1(stayersPct)}%). The students who left weren't disproportionately weaker in this domain — ` +
        `the cohort that stayed is broadly representative of the original ${eL} group.`,
    );
  } else if (diff > 0) {
    const ratio = stayersPct > 0 ? leaversPct / stayersPct : 0;
    const ratioPhrase = ratio ? `${f1(ratio)}× the stayers' rate` : "much higher than stayers'";
    bullets.push(
      `**Selection effect at the NAS end.** Leavers' ${eL} NAS rate (${f1(leaversPct)}%) was ${ratioPhrase} ` +
        `(${f1(stayersPct)}%). The ${leaversTotal} students who left were disproportionately weaker in this domain ` +
        `at ${eL} — they took the lowest-performing slice of the cohort with them when they left.`,
    );
  } else {
    bullets.push(
      `**Reverse selection: leavers were stronger at NAS than stayers** (${f1(leaversPct)}% vs ${f1(stayersPct)}% ` +
        `${eL} NAS). Unusual pattern — the cohort that stayed has a higher NAS concentration than the cohort that left. ` +
        "Worth investigating leavers' destinations (selective schools, interstate moves) before drawing conclusions.",
    );
  }

  if (Math.abs(topDiff) < 5) {
    bullets.push(
      `**No selection effect at the top end either.** Leavers and stayers had similar Strong+Exceeding rates ` +
        `(${f1(leaversTopPct)}% vs ${f1(stayersTopPct)}%). The departure pattern wasn't concentrated at any band.`,
    );
  } else if (topDiff < 0) {
    bullets.push(
      `**Top-end gap reinforces the selection story.** Leavers' Strong+Exceeding rate was ${f1(leaversTopPct)}% vs ` +
        `stayers' ${f1(stayersTopPct)}% — a ${signed1(topDiff)} pp gap. Even at the high end, leavers were less ` +
        `prepared in ${eL} than the cohort that stayed.`,
    );
  } else {
    bullets.push(
      `**Top-end leavers were stronger than top-end stayers** (${f1(leaversTopPct)}% vs ${f1(stayersTopPct)}% ` +
        `Strong+Exceeding). Some high-performing ${eL} students left before ${lL} — worth understanding where they went ` +
        "and whether retention strategies could have changed the decision.",
    );
  }

  if (diff > 10) {
    bullets.push(
      `**Adjust the headline interpretation accordingly.** A meaningful share of the ${lL} cohort improvement in this ` +
        `domain reflects this selection effect — the ${lL} cohort isn't 'the ${eL} cohort matured', it's the part of the ` +
        `${eL} cohort that remained. When briefing stakeholders, lead with the paired (stayers-only) comparison.`,
    );
  }

  bullets.push(
    `**Action**: Identify the ${leaversTotal} leavers' destinations (other state schools, selective schools, ` +
      "private, interstate, early exit) from the school's enrolment records. The pattern of destinations is the " +
      "missing piece — until we know it, we can't tell whether attrition was a school-choice signal, a geographic " +
      "move, or a wellbeing/engagement disengagement.",
  );

  return bullets;
}

/**
 * 1-2 — one computed sentence quantifying the baseline-composition difference
 * between the matched (stayers) group and the full entry cohort. Deliberately
 * claims composition only: it is NOT a corrected headline, because leavers' exit
 * outcomes are unknowable.
 */
export function attritionCompositionSentence(pc: PairedCohort): string {
  const eL = shortLevel(pc.earlierLevel);
  const lL = shortLevel(pc.laterLevel);
  const c = attritionComposition(pc);
  if (c.leaversN === 0) {
    return (
      `Baseline composition: no students left between ${eL} and ${lL}, so the matched group is the ` +
      `full ${eL} entry cohort — there is no composition difference to note.`
    );
  }
  const same = Math.abs(c.diffPp) < 0.05;
  const dir = c.diffPp < 0 ? "lower than" : "higher than";
  const compare = same ? "essentially the same as" : `${f1(Math.abs(c.diffPp))} pp ${dir}`;
  return (
    `Baseline composition: the matched (stayers) group started ${eL} with a NAS rate ${compare} the full ` +
    `${eL} entry cohort (${f1(c.stayersEntryNasPct)}% of ${c.stayersN} stayers vs ${f1(c.fullCohortEntryNasPct)}% of all ` +
    `${c.fullCohortN} students who sat ${eL}). This describes who is in the tracked group — it is not a corrected ` +
    `headline: the ${c.leaversN} leavers' ${lL} outcomes are unknowable, so their effect on the cohort change cannot be recovered.`
  );
}

/**
 * 1-3 — the detectability note for the whole-cohort NAS headline. States the
 * exact-McNemar best-case floor with the mandatory "at least … even in the best
 * case" framing (offsetting movement raises the bar further).
 */
export function detectabilityNote(pairedN: number): string {
  const f = detectabilityFloor(pairedN);
  if (!f.feasible) {
    return (
      `With only n=${pairedN} matched students, no NAS change can reach statistical significance even in the best ` +
      `case — at least ${f.minMovers} students would have to move one way (more than the whole cohort). ` +
      `Read direction and counts, not a significance test.`
    );
  }
  return (
    `Detectability: with n=${pairedN} matched students, a NAS change smaller than ±${f.minDeltaPp} pp ` +
    `(at least ${f.minMovers} students moving one way) cannot reach statistical significance even in the best case — ` +
    `and any offsetting movement raises that bar further.`
  );
}

// ── Drill-down C — Equity sub-cohorts ───────────────────────────────────────
export function interpretEquity(pc: PairedCohort): string[] {
  const eL = shortLevel(pc.earlierLevel);
  const lL = shortLevel(pc.laterLevel);
  const groups: Array<[string, typeof pc.paired]> = [
    ["LBOTE Yes", pc.paired.filter((s) => s.lboteStatus === "Yes")],
    ["LBOTE No", pc.paired.filter((s) => s.lboteStatus === "No")],
    ["Aboriginal and/or TSI", pc.paired.filter((s) => s.atsiGroup === "ATSI")],
    ["Non-Indigenous", pc.paired.filter((s) => s.atsiGroup === "Non-ATSI")],
  ];
  const suppressed = groups.filter(([, g]) => g.length < SUPPRESSION_THRESHOLD).map(([label]) => label);
  const visible = groups.filter(([, g]) => g.length >= SUPPRESSION_THRESHOLD);

  const bullets: string[] = [];
  if (suppressed.length > 0) {
    bullets.push(
      `**Most subgroups are too small for cohort analysis.** ${suppressed.length} of 4 subgroups ` +
        `(${suppressed.join(", ")}) fall below the n<5 suppression threshold in this domain's paired cohort. For ` +
        "these students, the right frame is named case management — we know them as individuals, and that's how the " +
        "leadership team should engage with their outcomes, not as statistical subgroups.",
    );
  }

  const deltas: number[] = [];
  for (const [label, g] of visible) {
    const n = g.length;
    const p7 = (g.filter((s) => s.proficiencyY7 === NAS).length / n) * 100;
    const p9 = (g.filter((s) => s.proficiencyY9 === NAS).length / n) * 100;
    const delta = p9 - p7;
    deltas.push(delta);
    if (Math.abs(delta) < 1) {
      bullets.push(
        `**${label} (n=${n}): essentially unchanged.** NAS rate ${f1(p7)}% → ${f1(p9)}% (${signed1(delta)} pp). ` +
          "The largest subgroup isn't moving in this domain — worth asking what teaching practice could shift this for the next cohort.",
      );
    } else if (delta < 0) {
      bullets.push(
        `**${label} (n=${n}): improving.** NAS rate dropped from ${f1(p7)}% to ${f1(p9)}% (${signed1(delta)} pp). ` +
          "For the majority subgroup, this is the dominant signal driving the headline movement in this domain.",
      );
    } else {
      bullets.push(
        `**${label} (n=${n}): declining.** NAS rate rose from ${f1(p7)}% to ${f1(p9)}% (${signed1(delta)} pp). ` +
          "Worth a closer look — even in the larger subgroup, the cohort moved the wrong way.",
      );
    }
  }

  if (deltas.length >= 2) {
    const spread = Math.max(...deltas) - Math.min(...deltas);
    if (spread < 3) {
      bullets.push(
        "**Visible subgroups moved in parallel.** The two larger subgroups had near-identical changes in NAS rate " +
          "(within 3 pp of each other). Whatever drove the headline movement applied broadly, not differentially.",
      );
    } else if (spread > 8) {
      bullets.push(
        `**Visible subgroups diverged.** The two larger subgroups saw NAS-rate changes that differed by ${f1(spread)} pp. ` +
          "Worth understanding what teaching, support, or background factor explains the gap — equity work depends on " +
          "knowing why one subgroup moved further than the other.",
      );
    }
  }

  if (suppressed.length > 0) {
    bullets.push(
      "**For the suppressed subgroups, talk to the case managers.** The students themselves and their support plans " +
        `are the right unit of analysis. The leadership team should review their ${eL}→${lL} progress with their named ` +
        "teachers and case workers, not from this report.",
    );
  }

  return bullets;
}

// ── Drill-down D — Transition matrix ────────────────────────────────────────
export function interpretTransition(pc: PairedCohort): string[] {
  const eL = shortLevel(pc.earlierLevel);
  const lL = shortLevel(pc.laterLevel);
  const m = transitionMatrix(pc.paired);
  const rowSum = (i: number) => m[i]!.reduce((s, x) => s + x, 0);
  const nTotal = m.reduce((s, row) => s + row.reduce((a, b) => a + b, 0), 0);
  let diagonal = 0;
  let above = 0;
  let below = 0;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const v = m[i]![j]!;
      if (j === i) diagonal += v;
      else if (j > i) above += v;
      else below += v;
    }
  }

  const bullets: string[] = [];
  const diagPct = nTotal > 0 ? (diagonal / nTotal) * 100 : 0;
  const netPhrase =
    above >= below ? `${above - below} net students` : `${below - above} students in the wrong direction`;
  bullets.push(
    `**The cohort is mostly stable.** ${diagonal} of ${nTotal} students (${round0(diagPct)}%) stayed at the same ` +
      `proficiency level ${eL}→${lL}. ${above} moved up, ${below} moved down — improvement outweighs decline by ${netPhrase}.`,
  );

  const nasTotal = rowSum(I.NAS);
  if (nasTotal > 0) {
    const stayedNas = m[I.NAS]![I.NAS]!;
    const movedUp = m[I.NAS]![I.DEV]! + m[I.NAS]![I.STRONG]! + m[I.NAS]![I.EXC]!;
    const upPct = (movedUp / nasTotal) * 100;
    if (movedUp > stayedNas) {
      bullets.push(
        `**${eL}-NAS students mostly moved up.** Of ${nasTotal} students at NAS in ${eL}, ${movedUp} moved up to ` +
          `Developing or above by ${lL} (${round0(upPct)}%); ${stayedNas} stayed at NAS. This is the strongest piece of ` +
          "evidence in the cohort that targeted support for the lowest performers is reaching the students who stay.",
      );
    } else if (movedUp === stayedNas) {
      bullets.push(
        `**${eL}-NAS students split evenly.** Of ${nasTotal} students at NAS in ${eL}, ${movedUp} moved up and ` +
          `${stayedNas} stayed at NAS. Half-half is a signal that the current intervention reaches some students but ` +
          "not others — worth understanding what differentiates the two groups.",
      );
    } else {
      bullets.push(
        `**${eL}-NAS students mostly stuck at NAS.** Of ${nasTotal} students at NAS in ${eL}, only ${movedUp} moved up; ` +
          `${stayedNas} stayed at NAS. The persistent-NAS group is the highest-priority named intervention list — ` +
          "the current approach isn't moving them.",
      );
    }
  }

  const topTotal = rowSum(I.STRONG) + rowSum(I.EXC);
  if (topTotal > 0) {
    const slipped = m[I.STRONG]![I.NAS]! + m[I.STRONG]![I.DEV]! + m[I.EXC]![I.NAS]! + m[I.EXC]![I.DEV]!;
    const held = topTotal - slipped;
    const heldPct = (held / topTotal) * 100;
    if (slipped === 0) {
      bullets.push(
        `**The top end held perfectly.** All ${topTotal} ${eL}-Strong-or-Exceeding students stayed at Strong or ` +
          `Exceeding by ${lL} — zero slippage. The high-performing cohort is robust under the current approach.`,
      );
    } else if (slipped <= 3) {
      bullets.push(
        `**The top end held well, with a few named slips.** ${held} of ${topTotal} ${eL}-Strong-or-Exceeding students ` +
          `(${round0(heldPct)}%) held their position; ${slipped} slipped to Developing or NAS. With small absolute ` +
          "numbers, those individual students are worth a direct conversation rather than a cohort-level response.",
      );
    } else {
      bullets.push(
        `**Noticeable top-end slippage.** ${slipped} of ${topTotal} ${eL}-Strong-or-Exceeding students slipped to ` +
          `Developing or NAS by ${lL} (${round0((slipped / topTotal) * 100)}%). Worth investigating: subject-teacher ` +
          `continuity, engagement signals, wellbeing changes, and Year ${pc.earlierLevel + 1}-${pc.laterLevel} transition factors are the usual culprits.`,
      );
    }
  }

  const devTotal = rowSum(I.DEV);
  if (devTotal > 0 && devTotal >= Math.max(rowSum(0), rowSum(1), rowSum(2), rowSum(3))) {
    const devUp = m[I.DEV]![I.STRONG]! + m[I.DEV]![I.EXC]!;
    const devStayed = m[I.DEV]![I.DEV]!;
    const devDown = m[I.DEV]![I.NAS]!;
    bullets.push(
      `**The Developing cohort is the largest single group and the biggest pedagogical opportunity.** ${devTotal} ` +
        `${eL}-Developing students — ${devUp} moved up to Strong or Exceeding, ${devStayed} stayed Developing, ${devDown} ` +
        "dropped to NAS. Aggregate improvement is maximised when teaching investment moves the Developing band up " +
        "rather than focusing only on the NAS group.",
    );
  }

  return bullets;
}

// ── Drill-down E — Wilson CI + significance verdict ─────────────────────────
export function interpretWilson(pc: PairedCohort): string[] {
  const eL = shortLevel(pc.earlierLevel);
  const lL = shortLevel(pc.laterLevel);
  const n = pc.paired.length;
  const y7Count = pc.paired.filter((s) => s.proficiencyY7 === NAS).length;
  const y9Count = pc.paired.filter((s) => s.proficiencyY9 === NAS).length;
  const [y7Lo, y7Hi] = wilsonCi(y7Count, n);
  const [y9Lo, y9Hi] = wilsonCi(y9Count, n);
  const y9Pct = n > 0 ? (y9Count / n) * 100 : 0;
  const y7Width = (y7Hi - y7Lo) * 100;
  const y9Width = (y9Hi - y9Lo) * 100;
  const mc = mcnemarPaired(pc.paired, pc.earlierLevel, pc.laterLevel);

  const bullets: string[] = [];
  const y9InsideY7 = y7Lo * 100 <= y9Pct && y9Pct <= y7Hi * 100;
  if (y9InsideY7) {
    bullets.push(
      `**The ${lL} point estimate (${f1(y9Pct)}%) sits inside the ${eL} uncertainty band ` +
        `(${round0(y7Lo * 100)}–${round0(y7Hi * 100)}%).** Visually that looks like 'no change', but that's the ` +
        "small-cohort uncertainty doing the talking — the paired test is the right place to read significance, not this overlap.",
    );
  } else {
    bullets.push(
      `**The ${lL} point estimate (${f1(y9Pct)}%) sits outside the ${eL} uncertainty band ` +
        `(${round0(y7Lo * 100)}–${round0(y7Hi * 100)}%).** Visually that suggests real change, and the paired ` +
        "McNemar test confirms whether the cohort movement supports that reading.",
    );
  }

  bullets.push(
    `**Both intervals are wide because the cohort is small.** ${eL} band width is ${round0(y7Width)} pp; ${lL} band width ` +
      `is ${round0(y9Width)} pp. At n=${n} students, this is fundamental — every Wilson interval on a low proportion ` +
      "will span 10–15 pp. The intervals aren't noise from messy data; they're the honest uncertainty on what we can " +
      "say from this cohort size.",
  );

  if (mc.pValue === null) {
    bullets.push(
      "**Significance verdict: not applicable.** No students changed NAS status in this domain, so McNemar's test " +
        "can't run. The direction is flat; the uncertainty bands are descriptive only.",
    );
  } else if (mc.pValue < 0.05) {
    bullets.push(
      `**Significance verdict: confirmed (McNemar p = ${formatP(mc.pValue)}).** The cohort change is unlikely to be ` +
        "chance. When briefing stakeholders, describe this as a real effect rather than a directional trend.",
    );
  } else {
    bullets.push(
      `**Significance verdict: not confirmed (McNemar p = ${formatP(mc.pValue)}).** Direction is what it is, but the ` +
        "cohort isn't large enough for the test to rule out chance. External framing: 'directionally improving in " +
        "this domain, statistical confirmation would require a larger cohort or a repeat measurement next year.'",
    );
  }

  bullets.push(
    "**How to describe this externally**: lead with the McNemar result and the paired-cohort delta. Show the Wilson " +
      "plot only as context for why the intervals are wide. Leadership teams (and parent communities) frequently " +
      "misread overlapping CIs as 'no difference' — the matching design corrects for that, and you should describe " +
      "results in that frame, not the cross-sectional one.",
  );

  return bullets;
}

// ── Drill-down F — Reading subdomains ───────────────────────────────────────
function accuracyBySubdomain(results: readonly StudentResultRow[]): Map<string, number> {
  const groups = new Map<string, { correct: number; total: number }>();
  for (const r of results) {
    if (r.subdomain == null) continue;
    let g = groups.get(r.subdomain);
    if (!g) {
      g = { correct: 0, total: 0 };
      groups.set(r.subdomain, g);
    }
    g.total += 1;
    if (r.studentMarkedResponse === "Correct") g.correct += 1;
  }
  const out = new Map<string, number>();
  for (const [sub, g] of groups) out.set(sub, g.total > 0 ? (g.correct / g.total) * 100 : 0);
  return out;
}

export function interpretReadingSubdomains(
  y7Results: readonly StudentResultRow[],
  y9Results: readonly StudentResultRow[],
  y7Year: number,
  y9Year: number,
  ctx?: NarrativeContext,
  earlierLevel = 7,
  laterLevel = 9,
): string[] {
  const eL = shortLevel(earlierLevel);
  const lL = shortLevel(laterLevel);
  const y7 = accuracyBySubdomain(y7Results);
  const y9 = accuracyBySubdomain(y9Results);
  const common = [...y7.keys()].filter((s) => y9.has(s)).sort((a, b) => a.localeCompare(b));
  if (common.length === 0) return [`No subdomain overlap between ${eL} and ${lL} — cannot compare.`];

  const deltas = common.map((sub) => ({ sub, y7: y7.get(sub)!, y9: y9.get(sub)!, delta: y9.get(sub)! - y7.get(sub)! }));
  deltas.sort((a, b) => b.delta - a.delta);
  const top = deltas[0]!;
  const bot = deltas[deltas.length - 1]!;
  const positive = deltas.filter((d) => d.delta > 0).length;

  const bullets: string[] = [];
  bullets.push(
    `**Important interpretation note.** These percentages compare ${eL} items (set to the ${eL} standard, sat in ${y7Year}) ` +
      `with ${lL} items (set to the higher ${lL} standard, sat in ${y9Year}). A positive delta means students achieved a ` +
      "similar or higher hit rate against harder year-level questions — that is real capability growth, not item-level repetition.",
  );

  if (top.delta > 0) {
    bullets.push(
      `**Largest improvement: ${top.sub} (${signed1(top.delta)} pp against the higher ${lL} standard).** ` +
        `${eL} ${round0(top.y7)}% → ${lL} ${round0(top.y9)}%. This is the subdomain to highlight when discussing what's ` +
        "working in Reading instruction. Ask the English/Literacy team what was different about how this subdomain was approached.",
    );
  } else {
    bullets.push(
      `**Best-performing subdomain: ${top.sub} (${signed1(top.delta)} pp).** Even the best subdomain didn't show ` +
        `clear improvement against the higher ${lL} standard — worth understanding whether this is an instructional gap, ` +
        "an assessment-design issue, or just the natural ceiling of the cohort.",
    );
  }

  if (bot.sub !== top.sub) {
    if (bot.delta > 0) {
      bullets.push(
        `**Smallest improvement: ${bot.sub} (${signed1(bot.delta)} pp).** ${eL} ${round0(bot.y7)}% → ${lL} ${round0(bot.y9)}%. ` +
          "Targeted improvement here is the practical priority for the next teaching iteration — the smaller the historical gain, the larger the headroom.",
      );
    } else {
      bullets.push(
        `**Worst-performing subdomain: ${bot.sub} (${signed1(bot.delta)} pp).** ${eL} ${round0(bot.y7)}% → ${lL} ${round0(bot.y9)}%. ` +
          `Students lost ground here against the ${lL} standard — this is the explicit target for next year's curriculum cycle in this domain.`,
      );
    }
  }

  const ref = ctx?.planReferences?.find((r) => r.role === "data-inquiry");
  const refCite = ref ? `${ref.code}${ref.description ? ` (${ref.description})` : ""}` : "your improvement plan's data-focused inquiry work";
  bullets.push(
    `**Connection to ${refCite}**: the subdomain pattern is the practical input to the next inquiry cycle. Where the ` +
      "inquiry group plans its focus, this is the evidence base — not the overall NAS rate, but the subdomain that moved least.",
  );

  bullets.push(
    `**Overall direction**: ${positive} of ${deltas.length} subdomains improved against the higher ${lL} standard. ` +
      (positive === deltas.length
        ? "All moved in the right direction — a coherent picture."
        : `The ${deltas.length - positive} subdomain(s) that didn't move warrant a closer look in the next planning cycle.`),
  );

  return bullets;
}

// ── Drill-down G — Class groups ─────────────────────────────────────────────
interface ClassStat {
  cls: string;
  total: number;
  left: number;
  attritionPct: number;
  y7Nas: number;
  y7NasPct: number;
  stayers: number;
  y9NasPct: number;
}

export function interpretClassGroups(pc: PairedCohort): string[] {
  const eL = shortLevel(pc.earlierLevel);
  const lL = shortLevel(pc.laterLevel);
  const byClass = new Map<string, { left: boolean; y7: string | null; y9: string | null }[]>();
  const add = (cls: string | null, m: { left: boolean; y7: string | null; y9: string | null }) => {
    if (cls == null) return;
    const b = byClass.get(cls);
    if (b) b.push(m);
    else byClass.set(cls, [m]);
  };
  for (const s of pc.paired) add(s.classGroupY7, { left: false, y7: s.proficiencyY7, y9: s.proficiencyY9 });
  for (const l of pc.leavers) add(l.classGroupY7, { left: true, y7: l.proficiencyY7, y9: null });

  const perClass: ClassStat[] = [];
  for (const [cls, members] of byClass) {
    const total = members.length;
    const left = members.filter((m) => m.left).length;
    const y7Nas = members.filter((m) => m.y7 === NAS).length;
    const stayers = members.filter((m) => !m.left);
    const y9Nas = stayers.filter((m) => m.y9 === NAS).length;
    perClass.push({
      cls,
      total,
      left,
      attritionPct: total > 0 ? (left / total) * 100 : 0,
      y7Nas,
      y7NasPct: total > 0 ? (y7Nas / total) * 100 : 0,
      stayers: stayers.length,
      y9NasPct: stayers.length > 0 ? (y9Nas / stayers.length) * 100 : 0,
    });
  }

  const substantive = perClass.filter((x) => x.total >= SUPPRESSION_THRESHOLD);
  const excluded = perClass.filter((x) => x.total < SUPPRESSION_THRESHOLD).map((x) => x.cls);
  if (substantive.length === 0) return [`No ${eL} classes met the n>=5 substantive threshold.`];

  const highestNas = substantive.reduce((a, b) => (b.y7NasPct > a.y7NasPct ? b : a));
  const highestAttr = substantive.reduce((a, b) => (b.attritionPct > a.attritionPct ? b : a));
  const lowestAttr = substantive.reduce((a, b) => (b.attritionPct < a.attritionPct ? b : a));
  const avgAttrition = substantive.reduce((s, x) => s + x.attritionPct, 0) / substantive.length;

  const bullets: string[] = [];
  bullets.push(
    `**Class ${highestNas.cls} had the highest ${eL} NAS concentration**: ${highestNas.y7Nas} of ${highestNas.total} ` +
      `students (${round0(highestNas.y7NasPct)}%) in this domain. If classes are streamed, a concentration ` +
      `like this is expected in a lower-stream class; if they are mixed-ability, it is worth a closer look at ` +
      "how support is distributed across class groups.",
  );
  bullets.push(
    `**Class ${highestAttr.cls} had the highest attrition**: ${highestAttr.left} of ${highestAttr.total} students ` +
      `(${round0(highestAttr.attritionPct)}%) left between ${eL} and ${lL}. Compared with the cohort average of ` +
      `${round0(avgAttrition)}%, this is a meaningful concentration.`,
  );
  if (highestNas.cls === highestAttr.cls) {
    bullets.push(
      `**Class ${highestNas.cls} has both the highest ${eL} NAS rate and the highest attrition.** One class ` +
        "carrying both the most academic need AND the most student movement is a pattern worth understanding " +
        `directly — whether that reflects how the class was formed, how support reached it, or what happened to ` +
        `those students by ${lL}. Worth a deeper conversation with the relevant year-level coordinator and ` +
        "student support team about that cohort specifically.",
    );
  }
  if (lowestAttr.cls !== highestAttr.cls) {
    bullets.push(
      `**Class ${lowestAttr.cls} retained students best**: only ${round0(lowestAttr.attritionPct)}% attrition. The ` +
        `${lowestAttr.stayers} stayers from this class ended ${lL} with a ${round0(lowestAttr.y9NasPct)}% NAS rate — a ` +
        "useful comparator when looking at what drives retention across class groups.",
    );
  }
  bullets.push(
    "**Caveat (load-bearing)**: these patterns reflect how classes were formed and how students moved, not " +
      "teacher performance. Use them for next-cohort resource allocation, not to evaluate teaching. If the " +
      "leadership team is interpreting these numbers as a teacher-quality signal, redirect that conversation.",
  );
  if (excluded.length > 0) {
    bullets.push(
      `**Excluded from rankings (n<${SUPPRESSION_THRESHOLD})**: ${excluded.join(", ")}. These groups are too small ` +
        "to draw stable conclusions from but appear in the table for completeness.",
    );
  }

  return bullets;
}
