/**
 * 1-4 — the "improved" recognition list (mirror of declinedOrStalled).
 */
import { describe, expect, it } from "vitest";
import { improved, type PairedCohort, type PairedStudent } from "../src/index";

const NAS = "Needs additional support";

function psFull(id: string, y7: string, y9: string, cg7: string | null, cg9: string | null): PairedStudent {
  return {
    localStudentId: id,
    classGroupY7: cg7,
    proficiencyY7: y7,
    lboteStatus: null,
    atsiGroup: "Not reported",
    participationCode: "Participated",
    classGroupY9: cg9,
    proficiencyY9: y9,
  };
}

describe("improved", () => {
  it("lists students who moved up a band, flagging those who left NAS", () => {
    const pc: PairedCohort = {
      domain: "Reading",
      earlierLevel: 7,
      laterLevel: 9,
      paired: [
        psFull("A", NAS, "Strong", "07A", "09A"), // up + left NAS
        psFull("B", "Developing", "Strong", "07A", "09B"), // up, not from NAS
        psFull("C", "Strong", "Strong", "07A", "09A"), // held (excluded)
        psFull("D", "Exceeding", "Developing", "07A", "09A"), // declined (excluded)
        psFull("E", NAS, "Developing", "07B", "09C"), // up + left NAS
      ],
      leavers: [],
      joiners: [],
      pairedFilteredCount: 0,
    };
    const r = improved(pc);
    expect(r.map((s) => s.localStudentId)).toEqual(["A", "B", "E"]);
    expect(r.map((s) => s.leftNas)).toEqual([true, false, true]);
    expect(r[0]).toMatchObject({ classGroupY7: "07A", classGroupY9: "09A", proficiencyY7: NAS, proficiencyY9: "Strong" });
  });

  it("is empty when nobody moved up", () => {
    const pc: PairedCohort = {
      domain: "Reading",
      earlierLevel: 7,
      laterLevel: 9,
      paired: [psFull("A", "Strong", "Strong", null, null), psFull("B", "Strong", NAS, null, null)],
      leavers: [],
      joiners: [],
      pairedFilteredCount: 0,
    };
    expect(improved(pc)).toEqual([]);
  });
});
