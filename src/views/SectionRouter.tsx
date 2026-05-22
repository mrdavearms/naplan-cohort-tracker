/**
 * Routes the active section id to its view.
 */
import { useApp } from "../state/AppState";
import { S1Participation } from "./sections/S1Participation";
import { S2Proficiency } from "./sections/S2Proficiency";
import { S3YearOnYear } from "./sections/S3YearOnYear";
import { S4CrossDomain } from "./sections/S4CrossDomain";
import { S5SkillGaps } from "./sections/S5SkillGaps";
import { S6Equity } from "./sections/S6Equity";
import { S7ClassGroups } from "./sections/S7ClassGroups";
import { S8TargetedSupport } from "./sections/S8TargetedSupport";
import { S9Narrative } from "./sections/S9Narrative";
import { S10CohortTracking } from "./sections/S10CohortTracking";

export function SectionRouter() {
  const { state } = useApp();
  // Defensive: sections assume a loaded store + a selected year. Never reached
  // in normal flow (App only renders sections when loaded), but guards the
  // `primaryYear!` assertions in every section against a null edge case.
  if (state.status !== "loaded" || state.primaryYear == null) return null;
  switch (state.activeView) {
    case "s1":
      return <S1Participation />;
    case "s2":
      return <S2Proficiency />;
    case "s3":
      return <S3YearOnYear />;
    case "s4":
      return <S4CrossDomain />;
    case "s5":
      return <S5SkillGaps />;
    case "s6":
      return <S6Equity />;
    case "s7":
      return <S7ClassGroups />;
    case "s8":
      return <S8TargetedSupport />;
    case "s9":
      return <S9Narrative />;
    case "s10":
      return <S10CohortTracking />;
    default:
      return null;
  }
}
