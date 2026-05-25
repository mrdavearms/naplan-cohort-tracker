/**
 * Home view (loaded only) — the overview: match-rate banner, what loaded, any
 * skipped files, and a way back to the import screen to add or fix files. The
 * empty-state on-ramp lives in ImportStaging, rendered by App before any load.
 */
import { availableYears, getPrimaryYearEntries } from "@naplan-throughline/core";
import { ExclamationTriangleIcon, FolderOpenIcon } from "@heroicons/react/24/outline";
import { useApp } from "../state/AppState";
import { ImportStaging } from "../components/ImportStaging";
import { MatchRateBanner } from "../components/MatchRateBanner";
import { Card, Pill, StatTile } from "../components/ui";
import { ExportPdfButton } from "../components/ExportPdfButton";

export function HomeView() {
  const { state, setView } = useApp();

  // Defensive: HomeView is only routed to when loaded, but if it ever isn't,
  // show the import on-ramp rather than a blank overview.
  if (state.status !== "loaded" || state.primaryYear == null) {
    return <ImportStaging />;
  }

  const { store, primaryYear, skipped, unresolved } = state;
  const years = availableYears(store);
  const primaryEntries = getPrimaryYearEntries(store, primaryYear);
  const issues = [...skipped, ...unresolved];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-graphite">Overview</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setView("import")}
            className="inline-flex items-center gap-2 rounded-xl border border-alabaster bg-white px-4 py-2 text-sm font-medium text-graphite shadow-sm transition hover:bg-linen/60"
          >
            <FolderOpenIcon className="h-5 w-5 text-graphite/60" />
            Edit imported files
          </button>
          <ExportPdfButton kind="overview" />
        </div>
      </div>

      <MatchRateBanner store={store} primaryYear={primaryYear} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Primary year" value={primaryYear} sub="Year 9 cohort anchor" />
        <StatTile label="Years loaded" value={years.length} sub={years.join(", ")} />
        <StatTile label="Datasets" value={store.size} sub="year × level × domain" />
        <StatTile label={`${primaryYear} datasets`} value={primaryEntries.length} />
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-graphite">Loaded datasets</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {[...store.values()]
            .sort((a, b) => b.yearOfTest - a.yearOfTest || a.yearLevel - b.yearLevel)
            .map((e) => (
              <Pill key={`${e.yearOfTest}-${e.yearLevel}-${e.domain}`} tone="neutral">
                {e.yearOfTest} · Y{e.yearLevel} · {e.domain} ({e.participants}/{e.totalStudents})
              </Pill>
            ))}
        </div>
      </Card>

      {issues.length > 0 && (
        <Card className="border-tuscan/50 bg-tuscan/5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-graphite">
            <ExclamationTriangleIcon className="h-5 w-5 text-tuscan-dark" />
            {issues.length} file{issues.length === 1 ? "" : "s"} not loaded
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-graphite/70">
            {issues.map((s, i) => (
              <li key={i}>
                <span className="font-medium text-graphite">{s.filename}</span> — {s.reason}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setView("import")}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-tuscan/50 bg-white/70 px-3 py-1.5 text-xs font-medium text-graphite hover:bg-white"
          >
            <FolderOpenIcon className="h-4 w-4 text-graphite/60" />
            Edit imported files
          </button>
        </Card>
      )}
    </div>
  );
}
