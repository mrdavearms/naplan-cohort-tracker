/**
 * Interpretation-bullet rule-firing tests. The embedded numbers come from
 * already-validated functions; these pin which bullets fire under which
 * conditions, the {dom}-bug fix in interpretWilson, and the configurable
 * plan-reference citation in interpretReadingSubdomains.
 */
import { describe, expect, it } from "vitest";
import {
  interpretAttrition,
  interpretClassGroups,
  interpretEquity,
  interpretMcnemar,
  interpretReadingSubdomains,
  interpretTransition,
  interpretWilson,
  mcnemarPaired,
  type LeaverRow,
  type NarrativeContext,
  type PairedCohort,
  type PairedStudent,
  type StudentResultRow,
} from "../src/index";

const NAS = "Needs additional support";

function ps(
  y7: string,
  y9: string,
  opts: { lbote?: string | null; atsi?: string; classY7?: string | null; classY9?: string | null } = {},
): PairedStudent {
  return {
    localStudentId: "x",
    classGroupY7: opts.classY7 ?? null,
    proficiencyY7: y7,
    lboteStatus: opts.lbote ?? null,
    atsiGroup: opts.atsi ?? "Not reported",
    participationCode: "Participated",
    classGroupY9: opts.classY9 ?? null,
    proficiencyY9: y9,
  };
}

function leaver(y7: string | null, classY7: string | null = null): LeaverRow {
  return {
    localStudentId: "l",
    classGroupY7: classY7,
    proficiencyY7: y7,
    lboteStatus: null,
    atsiGroup: "Not reported",
    participationCode: "Participated",
  };
}

function cohort(paired: PairedStudent[], leavers: LeaverRow[] = []): PairedCohort {
  return { domain: "Reading", earlierLevel: 7, laterLevel: 9, paired, leavers, joiners: [], pairedFilteredCount: 0 };
}

describe("interpretMcnemar", () => {
  it("positive direction + high confidence + persistent-NAS list", () => {
    const paired = [
      ...Array.from({ length: 8 }, () => ps(NAS, "Strong")),
      ps(NAS, NAS),
      ps(NAS, NAS),
    ];
    const text = interpretMcnemar(mcnemarPaired(paired), "Reading", paired.length).join(" ");
    expect(text).toContain("Direction is positive");
    expect(text).toContain("no students moved in the wrong direction");
    expect(text).toContain("Statistical confidence is high");
    expect(text).toContain("at NAS in both Y7 and Y9");
  });

  it("no discordant → flat + not applicable", () => {
    const text = interpretMcnemar(mcnemarPaired([ps("Strong", "Strong"), ps(NAS, NAS)]), "Reading", 2).join(" ");
    expect(text).toContain("No change in NAS status");
    expect(text).toContain("not applicable");
  });
});

describe("interpretAttrition", () => {
  it("flags a selection effect and headline caveat when leavers are far weaker", () => {
    const paired = Array.from({ length: 10 }, () => ps("Strong", "Strong")); // 0% Y7 NAS
    const leavers = Array.from({ length: 6 }, () => leaver(NAS)); // 100% Y7 NAS
    const text = interpretAttrition(cohort(paired, leavers)).join(" ");
    expect(text).toContain("Selection effect at the NAS end");
    expect(text).toContain("Adjust the headline interpretation");
    expect(text).toContain("Action");
  });

  it("reports no selection effect when comparable", () => {
    const paired = [ps(NAS, "Strong"), ...Array.from({ length: 9 }, () => ps("Strong", "Strong"))];
    const leavers = [leaver(NAS), ...Array.from({ length: 9 }, () => leaver("Strong"))];
    expect(interpretAttrition(cohort(paired, leavers)).join(" ")).toContain("No clear selection effect");
  });
});

describe("interpretEquity", () => {
  it("describes visible subgroups and flags suppressed ones", () => {
    // 6 LBOTE No / Non-ATSI (visible); LBOTE Yes + ATSI empty (suppressed).
    const paired = [
      ps(NAS, NAS, { lbote: "No", atsi: "Non-ATSI" }),
      ps(NAS, "Strong", { lbote: "No", atsi: "Non-ATSI" }),
      ...Array.from({ length: 4 }, () => ps("Strong", "Strong", { lbote: "No", atsi: "Non-ATSI" })),
    ];
    const text = interpretEquity(cohort(paired)).join(" ");
    expect(text).toContain("2 of 4 subgroups");
    expect(text).toContain("LBOTE No (n=6)");
    expect(text).toContain("case management");
  });
});

describe("interpretTransition", () => {
  it("reports stability and the Y7-NAS upward pathway", () => {
    const paired = [
      ps(NAS, NAS),
      ps(NAS, NAS),
      ps(NAS, "Strong"),
      ps(NAS, "Strong"),
      ps(NAS, "Strong"),
      ps("Strong", "Strong"),
      ps("Strong", "Strong"),
      ps("Strong", NAS),
    ];
    const text = interpretTransition(cohort(paired)).join(" ");
    expect(text).toContain("The cohort is mostly stable");
    expect(text).toContain("Y7-NAS students mostly moved up");
  });
});

describe("interpretWilson", () => {
  it("gives a significance verdict and does NOT leak a literal {dom}", () => {
    const paired = Array.from({ length: 10 }, () => ps(NAS, "Strong"));
    const text = interpretWilson(cohort(paired)).join(" ");
    expect(text).toContain("Significance verdict");
    expect(text).not.toContain("{dom}");
  });
});

describe("interpretReadingSubdomains", () => {
  function res(subdomain: string, response: string): StudentResultRow {
    return {
      studentPsi: "p",
      yearLevel: 7,
      classGroups: null,
      itemId: "i",
      itemDifficulty: 450,
      domain: "Reading",
      subdomain,
      descriptor: "d",
      studentMarkedResponse: response,
      difficultyBand: "Below 480",
    };
  }
  const y7 = [res("Comprehension", "Incorrect"), res("Comprehension", "Incorrect")];
  const y9 = [res("Comprehension", "Correct"), res("Comprehension", "Incorrect")];

  it("cites the configured plan reference by role", () => {
    const ctx: NarrativeContext = {
      schoolName: "X",
      primaryYear: 2026,
      planReferences: [{ role: "data-inquiry", code: "KIS 1.b", description: "data focus" }],
    };
    expect(interpretReadingSubdomains(y7, y9, 2024, 2026, ctx).join(" ")).toContain("KIS 1.b (data focus)");
  });

  it("falls back to generic phrasing without a plan reference", () => {
    const text = interpretReadingSubdomains(y7, y9, 2024, 2026).join(" ");
    expect(text).toContain("your improvement plan's data-focused inquiry work");
    expect(text).not.toContain("KIS");
  });
});

describe("interpretClassGroups", () => {
  it("ranks the highest-NAS and highest-attrition classes", () => {
    const paired = [
      ...Array.from({ length: 5 }, () => ps(NAS, "Strong", { classY7: "7C", classY9: "9A" })),
      ...Array.from({ length: 5 }, () => ps("Strong", "Strong", { classY7: "7A", classY9: "9A" })),
    ];
    const leavers = Array.from({ length: 3 }, () => leaver(NAS, "7C")); // 7C also loses students
    const text = interpretClassGroups(cohort(paired, leavers)).join(" ");
    expect(text).toContain("Class 7C had the highest Y7 NAS concentration");
    expect(text).toContain("load-bearing"); // the streaming caveat
  });
});
