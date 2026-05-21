/**
 * Section 4 — Cross-Domain Comparison (pure computation).
 * Ported from `naplan/sections/s4_cross_domain.py`.
 *
 * The numeric core is ranking the loaded domains by their NAS percentage,
 * highest (weakest) first. The prose interpretation is ported with the other
 * narrative generators.
 */
import type { ProficiencyPercentages } from "./proficiency";

export interface DomainNas {
  domain: string;
  nasPct: number;
}

/** Rank domains by NAS % descending (weakest first). Ties keep input order. */
export function rankDomainsByNas(
  perDomainPercentages: Record<string, ProficiencyPercentages>,
): DomainNas[] {
  const ranked = Object.entries(perDomainPercentages).map(([domain, pct]) => ({
    domain,
    nasPct: pct["Needs additional support"],
  }));
  ranked.sort((a, b) => b.nasPct - a.nasPct);
  return ranked;
}
