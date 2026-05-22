/**
 * Home view. Empty state = the hero + folder picker (the on-ramp). Loaded state
 * = an overview: the match-rate banner, what loaded, and any skipped files.
 */
import { availableYears, getPrimaryYearEntries } from "@naplan-throughline/core";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useApp } from "../state/AppState";
import { FolderPicker } from "../components/FolderPicker";
import { MatchRateBanner } from "../components/MatchRateBanner";
import { Card, Pill, PrivacyNote, StatTile } from "../components/ui";
import { ExportPdfButton } from "../components/ExportPdfButton";

function Hero({ error, loading }: { error: string | null; loading: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-alabaster bg-white/60">
      <div className="dot-grid pointer-events-none absolute inset-0 opacity-[0.08]" />
      <div className="relative px-8 py-16 text-center">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">
          <span className="hero-shimmer">Naplan Throughline</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-graphite/70">
          On-device NAPLAN cohort analysis. Put your Year 7 and Year 9 SSSR Extract files in a
          folder, then point the app at it — nothing leaves your machine.
        </p>
        <div className="mt-8 flex justify-center">
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-graphite/70">
              <div className="spinner" />
              <span className="text-sm">Loading your NAPLAN files…</span>
            </div>
          ) : (
            <FolderPicker />
          )}
        </div>
        {error && (
          <div className="mx-auto mt-6 flex max-w-xl items-start gap-2 rounded-xl border border-coral/40 bg-coral/5 p-3 text-left text-sm text-coral-text">
            <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <PrivacyNote>
          Local-only · no network calls · no student names in any chart, table, or export.
        </PrivacyNote>
      </div>
    </div>
  );
}

export function HomeView() {
  const { state } = useApp();

  if (state.status !== "loaded" || state.primaryYear == null) {
    return (
      <Hero error={state.status === "error" ? state.error : null} loading={state.status === "loading"} />
    );
  }

  const { store, primaryYear, skipped, unresolved } = state;
  const years = availableYears(store);
  const primaryEntries = getPrimaryYearEntries(store, primaryYear);
  const issues = [...skipped, ...unresolved];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-graphite">Overview</h1>
        <ExportPdfButton kind="overview" />
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
        </Card>
      )}
    </div>
  );
}
