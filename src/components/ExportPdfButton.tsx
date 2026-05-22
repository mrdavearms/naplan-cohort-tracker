/**
 * Export-to-PDF button. Builds the overview (Sections 1–9) or cohort (Section
 * 10) report from the loaded store + settings, then saves it (native dialog in
 * Tauri, download in the browser). Charts render to fixed-size PNGs first.
 */
import { useState } from "react";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { useApp } from "../state/AppState";
import { buildOverviewDoc } from "../pdf/overviewReport";
import { buildCohortDoc } from "../pdf/cohortReport";
import { savePdf } from "../pdf/savePdf";

export function ExportPdfButton({ kind }: { kind: "overview" | "cohort" }) {
  const { state } = useApp();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (state.status !== "loaded" || state.primaryYear == null) return null;
  const primaryYear = state.primaryYear;

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const doc =
        kind === "overview"
          ? await buildOverviewDoc(state.store, primaryYear, state.settings)
          : await buildCohortDoc(state.store, primaryYear, state.settings);
      const filename =
        kind === "overview"
          ? `NAPLAN ${primaryYear} overview.pdf`
          : `NAPLAN ${primaryYear} cohort tracking.pdf`;
      const result = await savePdf(doc, filename);
      setMsg(result === null ? "Cancelled." : result === "downloaded" ? "Downloaded." : `Saved to ${result}`);
    } catch (e) {
      setMsg(`Could not generate the PDF: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl bg-coral px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-coral-dark focus:outline-none focus:ring-2 focus:ring-coral focus:ring-offset-2 disabled:opacity-60"
      >
        <ArrowDownTrayIcon className="h-4 w-4" />
        {busy
          ? "Generating…"
          : kind === "overview"
            ? "Export overview PDF"
            : "Export cohort PDF"}
      </button>
      {msg && <span className="text-sm text-graphite/60">{msg}</span>}
    </div>
  );
}
