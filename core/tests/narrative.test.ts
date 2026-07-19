/**
 * Narrative rule-logic tests. The embedded numbers come from already-validated
 * functions; these pin which bullets fire, the school-identity parameterisation,
 * and the configurable plan-reference citation.
 */
import { describe, expect, it } from "vitest";
import {
  buildCohortNarrative,
  buildSchoolNarrative,
  type LoadedFile,
  type NarrativeContext,
  type PairedCohort,
  type PairedStudent,
  type StudentReportRow,
} from "../src/index";

const NAS = "Needs additional support";

function rep(domain: string, proficiency: string): StudentReportRow {
  return {
    studentId: null,
    localStudentId: null,
    localStudentIdDisplay: "*",
    yearLevel: 9,
    classGroups: null,
    domain,
    proficiencyLevel: proficiency,
    participationCode: "Participated",
    indigenousStatus: null,
    lboteStatus: null,
    atsiGroup: "Not reported",
  };
}

function entry(yearOfTest: number, yearLevel: number, domain: string, profs: string[]): LoadedFile {
  const reports = profs.map((p) => ({ ...rep(domain, p), yearLevel }));
  return {
    yearOfTest,
    yearLevel,
    domain,
    studentReports: reports,
    studentResults: [],
    sourceFilename: `${domain}.xlsx`,
    participants: reports.length,
    totalStudents: reports.length,
  };
}

const ctx: NarrativeContext = {
  schoolName: "Example High School",
  schoolNumber: "1234",
  primaryYear: 2026,
  planLabel: "AIP",
  planReferences: [
    { role: "data-inquiry", code: "KIS 1.b", description: "data focus" },
    { role: "at-risk-students", code: "KIS 1.e" },
  ],
};

describe("buildSchoolNarrative", () => {
  it("uses the configured school identity, not a hard-coded name", () => {
    const entries = [entry(2026, 9, "Reading", ["Strong", "Strong", NAS, "Exceeding"])];
    const n = buildSchoolNarrative(entries, ctx);
    expect(n.heading).toBe("Example High School (1234) — 2026 NAPLAN narrative");
    expect(n.overall).toContain("Reading");
    expect(n.strengths.length).toBeGreaterThan(0);
    expect(n.concerns.length).toBeGreaterThan(0);
  });

  it("reports year-on-year against primaryYear-1 from the data", () => {
    const entries = [
      entry(2025, 9, "Reading", [NAS, NAS, NAS, NAS, "Strong"]),
      entry(2026, 9, "Reading", [NAS, "Strong", "Strong", "Strong", "Strong"]),
    ];
    const n = buildSchoolNarrative(entries, ctx);
    const line = n.yearOnYear.find((l) => l.includes("Reading"))!;
    expect(line).toContain("2025");
    expect(line).toContain("2026");
    expect(line).toContain("down by 3"); // 4 NAS -> 1 NAS (beyond the +/-2 flat band)
  });
});

function pairedStudent(y7: string, y9: string): PairedStudent {
  return {
    localStudentId: "x",
    classGroupY7: null,
    proficiencyY7: y7,
    lboteStatus: null,
    atsiGroup: "Not reported",
    participationCode: "Participated",
    classGroupY9: null,
    proficiencyY9: y9,
  };
}

function pairedCohort(domain: string, paired: PairedStudent[]): PairedCohort {
  return { domain, earlierLevel: 7, laterLevel: 9, paired, leavers: [], joiners: [], pairedFilteredCount: 0 };
}

describe("buildCohortNarrative", () => {
  it("cites a school's own plan reference by role", () => {
    // Reading: 10 students move out of NAS -> significant improvement, big drop.
    const reading = pairedCohort(
      "Reading",
      Array.from({ length: 10 }, () => pairedStudent(NAS, "Strong")),
    );
    const n = buildCohortNarrative(new Map([["Reading", reading]]), ctx);
    expect(n.supported.some((s) => s.includes("Reading"))).toBe(true);
    // The Reading-propagation action should cite the configured data-inquiry ref.
    expect(n.actions.join(" ")).toContain("KIS 1.b");
    // The intervention-list action should cite the at-risk ref.
    expect(n.actions.join(" ")).toContain("KIS 1.e");
    // Uses the configured plan label + NEXT year (the plan being written this year covers next year).
    expect(n.actions.join(" ")).toContain("2027 AIP");
  });

  it("falls back to generic phrasing when no plan references are configured", () => {
    const reading = pairedCohort(
      "Reading",
      Array.from({ length: 10 }, () => pairedStudent(NAS, "Strong")),
    );
    const bare: NarrativeContext = { schoolName: "X", primaryYear: 2026 };
    const n = buildCohortNarrative(new Map([["Reading", reading]]), bare);
    expect(n.actions.join(" ")).not.toContain("KIS");
    expect(n.actions.join(" ")).toContain("improvement plan"); // default label
  });

  it("reports the honest 'no domains pass' line when nothing is significant", () => {
    // balanced discordant -> not significant
    const flat = pairedCohort("Numeracy", [
      pairedStudent(NAS, "Strong"),
      pairedStudent("Strong", NAS),
      pairedStudent("Strong", "Strong"),
    ]);
    const n = buildCohortNarrative(new Map([["Numeracy", flat]]), ctx);
    expect(n.supported.some((s) => s.includes("No domains pass"))).toBe(true);
  });
});

describe("buildCohortNarrative — target action", () => {
  const reading = pairedCohort(
    "Reading",
    Array.from({ length: 10 }, () => pairedStudent(NAS, "Strong")),
  );

  it("does not invent a percentage-point target range", () => {
    const n = buildCohortNarrative(new Map([["Reading", reading]]), ctx);
    const targetAction = n.actions.find((a) => a.includes("target"));
    expect(targetAction).toBeDefined();
    expect(targetAction).not.toMatch(/5–7 pp|5-7 pp/);
  });

  it("anchors the target to this cohort's own paired-cohort result", () => {
    const n = buildCohortNarrative(new Map([["Reading", reading]]), ctx);
    const targetAction = n.actions.find((a) => a.includes("target"))!;
    expect(targetAction).toMatch(/paired-cohort result|did not achieve a NAS reduction/i);
  });

  it("names the NEXT planning year, not the data year", () => {
    // ctx.primaryYear is 2026, so the plan being written is the 2027 one.
    const n = buildCohortNarrative(new Map([["Reading", reading]]), ctx);
    const targetAction = n.actions.find((a) => a.includes("target"))!;
    expect(targetAction).toContain("2027");
    expect(targetAction).not.toMatch(/\b2026 (AIP|annual implementation plan)/i);
  });
});
