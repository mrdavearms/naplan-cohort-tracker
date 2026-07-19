/**
 * Section 8 — Targeted support. A class-teacher-facing list of students at
 * "Needs additional support" (NAS) in one or more domains for the selected year
 * level. Keyed by Local Student ID only — NEVER names (the {PSI}* suffix marks
 * an ID derived from the VCAA Student ID where the Local ID was blank). Students
 * at NAS in >=2 domains are the higher-priority group and appear first.
 */
import { useState } from "react";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import {
  getPrimaryYearEntries,
  NAS,
  targetedSupport,
} from "@naplan-cohort-tracker/core";
import { useApp } from "../../state/AppState";
import { Card, EmptyState, Pill, PrivacyNote, SectionHeading, StatTile } from "../../components/ui";
import { saveCsv, toCsv } from "../../lib/csv";
import { AttributionNote, useYearLevel, YearLevelTabs } from "./scope";

export function S8TargetedSupport() {
  const { state } = useApp();
  const store = state.store;
  const primaryYear = state.primaryYear!;
  const { yearLevels, yearLevel, setYearLevel } = useYearLevel(store, primaryYear);

  const table = targetedSupport(getPrimaryYearEntries(store, primaryYear), yearLevel);

  const [csvMsg, setCsvMsg] = useState<string | null>(null);

  async function exportCsv() {
    setCsvMsg(null);
    const headers = ["Local Student ID", "Class group", "NAS domains", ...table.domains];
    const rows = table.students.map((s) => [
      s.localStudentIdDisplay,
      s.classGroup ?? "",
      s.nasDomains,
      ...table.domains.map((dom) => s.proficiencyByDomain[dom] ?? ""),
    ]);
    try {
      const result = await saveCsv(
        toCsv(headers, rows),
        `NAPLAN ${primaryYear} Year ${yearLevel} targeted support.csv`,
      );
      setCsvMsg(
        result === null ? "Cancelled." : result === "downloaded" ? "Downloaded." : `Saved to ${result}`,
      );
    } catch (e) {
      setCsvMsg(`Could not save the CSV: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <div>
      <SectionHeading
        number={8}
        title="Targeted support"
        blurb={`Students needing additional support in one or more domains — ${primaryYear} Year ${yearLevel}.`}
      />
      <YearLevelTabs yearLevels={yearLevels} value={yearLevel} onChange={setYearLevel} />
      <AttributionNote yearLevel={yearLevel} year={primaryYear} />

      {table.students.length === 0 ? (
        <EmptyState title={`No students currently at NAS for ${primaryYear} Year ${yearLevel}`} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatTile
              label="At NAS in 1 or more domains"
              value={table.totalNas}
              sub="Needs additional support in at least one tested domain"
            />
            <StatTile
              label="At NAS in 2 or more domains"
              value={table.multiNas}
              sub="Higher priority — needs support across multiple domains"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-2 rounded-xl border border-alabaster bg-white px-4 py-2 text-sm text-graphite shadow-sm transition hover:border-coral/40"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Save this list as CSV
            </button>
            {csvMsg && <span className="text-sm text-graphite/60">{csvMsg}</span>}
          </div>

          <Card>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-alabaster text-left text-xs uppercase tracking-wide text-graphite/50">
                  <th className="py-2">Local Student ID</th>
                  <th className="py-2">Class group</th>
                  <th className="py-2 text-right">NAS domains</th>
                  {table.domains.map((dom) => (
                    <th key={dom} className="py-2">
                      {dom}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.students.map((s) => {
                  const priority = s.nasDomains >= 2;
                  return (
                    <tr
                      key={s.localStudentIdDisplay}
                      className={
                        priority
                          ? "border-l-2 border-coral border-b border-alabaster/60 bg-coral/5 last:border-b-0"
                          : "border-b border-alabaster/60 last:border-0"
                      }
                    >
                      <td className="py-2 pl-2 font-medium text-graphite tabular-nums">
                        {s.localStudentIdDisplay}
                      </td>
                      <td className="py-2 text-graphite/70">{s.classGroup ?? "—"}</td>
                      <td className="py-2 text-right tabular-nums font-medium text-graphite">
                        {s.nasDomains}
                      </td>
                      {table.domains.map((dom) => {
                        const prof = s.proficiencyByDomain[dom];
                        return (
                          <td key={dom} className="py-2">
                            {prof === NAS ? (
                              <Pill tone="coral">NAS</Pill>
                            ) : prof == null ? (
                              <span className="text-graphite/40">—</span>
                            ) : (
                              <span className="text-graphite/70">{prof}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          <PrivacyNote>
            This list uses Local Student IDs only — no student names appear anywhere in the app. A
            {" "}
            <span className="font-mono">*</span> suffix marks an ID derived from the VCAA Student ID
            where the school's Local Student ID was blank.
          </PrivacyNote>
        </div>
      )}
    </div>
  );
}
