/**
 * Cross-domain Year 7 -> Year 9 overview: dumbbell (with a NAS%/Meeting+%
 * toggle) + net-change strip + movement small-multiples. Answers "where did we
 * add value across all four domains?" for leadership data conversations.
 */
import { useMemo, useState } from "react";
import {
  crossDomainSummary,
  divergingDeltaFigure,
  dumbbellFigure,
  movementStackedFigure,
  type CrossDomainRow,
  type DumbbellRow,
  type MovementBarRow,
  type PairedCohort,
} from "@naplan-cohort-tracker/core";
import { Card } from "./ui";
import { Chart } from "./Chart";

type Metric = "nas" | "meeting";

function direction(metric: Metric, y7: number, y9: number): DumbbellRow["direction"] {
  const delta = y9 - y7;
  if (Math.abs(delta) < 0.05) return "flat";
  // NAS lower is better; Meeting+ higher is better.
  if (metric === "nas") return delta < 0 ? "improved" : "worsened";
  return delta > 0 ? "improved" : "worsened";
}

export function CrossDomainOverview({ pairings }: { pairings: Map<string, PairedCohort> }) {
  const [metric, setMetric] = useState<Metric>("nas");
  const rows: CrossDomainRow[] = useMemo(() => crossDomainSummary(pairings), [pairings]);
  if (rows.length === 0) return null;

  const dumbbellRows: DumbbellRow[] = rows.map((r) => {
    const y7 = metric === "nas" ? r.y7NasPct : r.y7MeetingPct;
    const y9 = metric === "nas" ? r.y9NasPct : r.y9MeetingPct;
    return { domain: r.domain, y7Value: y7, y9Value: y9, direction: direction(metric, y7, y9) };
  });
  const movementRows: MovementBarRow[] = rows.map((r) => ({
    label: `${r.domain} (n=${r.pairedN})`,
    movement: r.movement,
  }));

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-graphite">Across all domains</h2>
        <div className="inline-flex rounded-xl border border-alabaster bg-white/60 p-1 text-sm">
          {(["nas", "meeting"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={
                "rounded-lg px-3 py-1 transition " +
                (metric === m ? "bg-coral text-white" : "text-graphite/70 hover:text-graphite")
              }
            >
              {m === "nas" ? "NAS %" : "Meeting+ %"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-1 text-sm font-medium text-graphite/70">
            {metric === "nas" ? "NAS %" : "Strong + Exceeding %"}: Year 7 → Year 9
          </h3>
          <Chart figure={dumbbellFigure(dumbbellRows, { axisTitle: metric === "nas" ? "NAS %" : "Meeting+ %" })} height={200} />
        </div>
        <div>
          <h3 className="mb-1 text-sm font-medium text-graphite/70">Net change in NAS (pp)</h3>
          <Chart figure={divergingDeltaFigure(rows.map((r) => ({ domain: r.domain, deltaNasPp: r.deltaNasPp })))} height={200} />
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-medium text-graphite/70">Band movement (moved down · stayed · moved up)</h3>
        <Chart figure={movementStackedFigure(movementRows)} height={Math.max(160, 70 + movementRows.length * 42)} />
      </div>
    </Card>
  );
}
