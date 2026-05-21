/**
 * Section metadata — drives the sidebar nav and view routing. Numbering mirrors
 * the legacy `naplan/sections/s1..s10`. NAPLAN attribution framing (CLAUDE.md):
 * Year 7 reflects primary-school output; Year 9 reflects the secondary school's
 * contribution; Section 10 (same students Y7→Y9) is the headline value-add.
 */
import type { ViewId } from "../state/AppState";

export interface SectionMeta {
  id: ViewId;
  /** Section number for display, e.g. "1". Null for non-section views. */
  number: number | null;
  title: string;
  /** One-line plain-English description. */
  blurb: string;
}

export const SECTIONS: SectionMeta[] = [
  { id: "s1", number: 1, title: "Participation", blurb: "Who sat the test — participated, absent, withdrawn." },
  { id: "s2", number: 2, title: "Proficiency", blurb: "Proficiency-level mix per domain." },
  { id: "s3", number: 3, title: "Year-on-year", blurb: "How the “Needs additional support” band has moved across years." },
  { id: "s4", number: 4, title: "Cross-domain", blurb: "Which domains have the highest need." },
  { id: "s5", number: 5, title: "Skill gaps", blurb: "Subdomain accuracy and the hardest-going descriptors." },
  { id: "s6", number: 6, title: "Equity", blurb: "LBOTE and ATSI sub-cohort gaps (suppressed when small)." },
  { id: "s7", number: 7, title: "Class groups", blurb: "Proficiency mix by class group." },
  { id: "s8", number: 8, title: "Targeted support", blurb: "Students needing support across one or more domains." },
  { id: "s9", number: 9, title: "Narrative", blurb: "A rules-based leadership narrative for the year." },
  { id: "s10", number: 10, title: "Cohort tracking", blurb: "The same students Y7→Y9 — the school value-add measure." },
];

export const SECTION_BY_ID: Record<string, SectionMeta> = Object.fromEntries(
  SECTIONS.map((s) => [s.id, s]),
);
