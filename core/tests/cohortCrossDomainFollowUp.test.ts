/**
 * 1-5 — cross-domain follow-up intersection. Hand-built two-domain pairings map
 * with a student flagged in both, verifying the join, the domain-count sort, and
 * the flag detail.
 */
import { describe, expect, it } from "vitest";
import { crossDomainFollowUp, type PairedCohort, type PairedStudent } from "../src/index";

const NAS = "Needs additional support";

function ps(id: string, y7: string, y9: string): PairedStudent {
  return {
    localStudentId: id,
    classGroupY7: null,
    proficiencyY7: y7,
    lboteStatus: null,
    atsiGroup: "Not reported",
    participationCode: "Participated",
    classGroupY9: null,
    proficiencyY9: y9,
  };
}

function pc(domain: string, paired: PairedStudent[]): PairedCohort {
  return { domain, earlierLevel: 7, laterLevel: 9, paired, leavers: [], joiners: [], pairedFilteredCount: 0 };
}

describe("crossDomainFollowUp", () => {
  it("joins declined/stalled across domains and ranks multi-domain students first", () => {
    // Reading: A stalled at NAS, B declined.   Numeracy: A declined, C stalled.
    const reading = pc("Reading", [ps("A", NAS, NAS), ps("B", "Strong", "Developing"), ps("C", "Strong", "Strong")]);
    const numeracy = pc("Numeracy", [ps("A", "Strong", "Developing"), ps("C", NAS, NAS), ps("B", "Strong", "Strong")]);
    const pairings = new Map<string, PairedCohort>([
      ["Reading", reading],
      ["Numeracy", numeracy],
    ]);

    const rows = crossDomainFollowUp(pairings);
    // A is flagged in both domains → first, with count 2.
    expect(rows[0]!.localStudentId).toBe("A");
    expect(rows[0]!.domainCount).toBe(2);
    expect(rows[0]!.flags).toEqual([
      { domain: "Reading", flag: "Stalled at NAS" },
      { domain: "Numeracy", flag: "Declined" },
    ]);
    // B and C each flagged in one domain.
    expect(rows.map((r) => r.localStudentId)).toEqual(["A", "B", "C"]);
    expect(rows[1]!.domainCount).toBe(1);
    expect(rows[2]!.domainCount).toBe(1);
  });

  it("is empty when no student declined or stalled in any domain", () => {
    const clean = pc("Reading", [ps("A", "Strong", "Strong"), ps("B", NAS, "Strong")]);
    expect(crossDomainFollowUp(new Map([["Reading", clean]]))).toEqual([]);
  });
});
