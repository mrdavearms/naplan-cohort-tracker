/**
 * Section 8 — Targeted support. A class-teacher-facing list of students at
 * "Needs additional support" (NAS) in one or more domains for the selected year
 * level. Keyed by Local Student ID only — NEVER names (the {PSI}* suffix marks
 * an ID derived from the VCAA Student ID where the Local ID was blank). Students
 * at NAS in >=2 domains are the higher-priority group and appear first.
 */
import {
  getPrimaryYearEntries,
  NAS,
  targetedSupport,
} from "@naplan-throughline/core";
import { useApp } from "../../state/AppState";
import { Card, EmptyState, Pill, PrivacyNote, SectionHeading, StatTile } from "../../components/ui";
import { AttributionNote, useYearLevel, YearLevelTabs } from "./scope";

export function S8TargetedSupport() {
  const { state } = useApp();
  const store = state.store;
  const primaryYear = state.primaryYear!;
  const { yearLevels, yearLevel, setYearLevel } = useYearLevel(store, primaryYear);

  const table = targetedSupport(getPrimaryYearEntries(store, primaryYear), yearLevel);

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
