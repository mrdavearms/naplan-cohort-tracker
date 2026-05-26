/**
 * Build the diagnostics text for the "Export diagnostics" affordance.
 * STRICTLY no student data — counts, versions and the ID match-rate only, so a
 * failure on a user's machine is legible without any telemetry or PII.
 */
import {
  availableYears,
  buildCohortPairings,
  cohortMatchRate,
  type SkippedFile,
  type Store,
} from "@naplan-cohort-tracker/core";

export interface DiagnosticsInput {
  appVersion: string;
  os: string;
  arch: string;
  userAgent: string;
  schoolName: string;
  primaryYear: number | null;
  store: Store;
  skipped: SkippedFile[];
  unresolved: SkippedFile[];
}

export function buildDiagnosticsText(d: DiagnosticsInput): string {
  const lines: string[] = [];
  lines.push("NAPLAN Cohort Tracker — diagnostics");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push(`App version: ${d.appVersion}`);
  lines.push(`OS / arch: ${d.os} ${d.arch}`);
  lines.push(`WebView: ${d.userAgent}`);
  lines.push("");
  lines.push(`School: ${d.schoolName || "(not set)"}`);
  lines.push(`Primary year: ${d.primaryYear ?? "(none)"}`);
  lines.push(`Years loaded: ${availableYears(d.store).join(", ") || "(none)"}`);
  lines.push(`Datasets loaded: ${d.store.size}`);

  if (d.primaryYear != null) {
    const pairings = buildCohortPairings(d.store, d.primaryYear);
    if (pairings.size > 0) {
      const mr = cohortMatchRate(pairings);
      const sample = [...pairings.values()][0];
      const pair = sample ? `Y${sample.earlierLevel}->Y${sample.laterLevel}` : "cohort";
      lines.push(
        `${pair} match (${mr.representativeDomain}): ${mr.matched} of ${mr.y9CohortTotal} ` +
          `(${mr.matchRatePct.toFixed(0)}%); leavers ${mr.leavers}, joiners ${mr.joiners}, ` +
          `excluded ${mr.filtered}`,
      );
    } else {
      lines.push("Cohort match: no matched cohort for the primary year");
    }
  }

  const issues = [...d.skipped, ...d.unresolved];
  lines.push("");
  lines.push(`Files not loaded: ${issues.length}`);
  for (const s of issues) lines.push(`  - ${s.filename} — ${s.reason}`);

  lines.push("");
  lines.push("(No student names or IDs are included in this file.)");
  return lines.join("\n");
}
