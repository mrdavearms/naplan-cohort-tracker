/**
 * Top bar: shows the loaded source folder, the primary-year selector (the year
 * whose Year 9 cohort anchors the analysis), and a change-folder action.
 */
import { availableYears } from "@naplan-throughline/core";
import { FolderOpenIcon } from "@heroicons/react/24/outline";
import { useApp } from "../state/AppState";
import { SECTION_BY_ID } from "../views/sections";

export function TopBar() {
  const { state, setPrimaryYear, setView } = useApp();
  if (state.status !== "loaded") return null;

  const years = availableYears(state.store);
  const viewTitle =
    state.activeView === "home"
      ? "Overview"
      : state.activeView === "settings"
        ? "Settings"
        : state.activeView === "about"
          ? "About"
          : state.activeView === "import"
            ? "Import files"
            : SECTION_BY_ID[state.activeView]?.title ?? "";

  return (
    <header className="flex items-center justify-between gap-4 border-b border-alabaster bg-white/40 px-8 py-3 backdrop-blur-sm">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-graphite">{viewTitle}</div>
        {state.sourceLabel && (
          <div className="truncate text-xs text-graphite/50">Source: {state.sourceLabel}</div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-graphite/70">
          Primary year
          <select
            value={state.primaryYear ?? ""}
            onChange={(e) => setPrimaryYear(Number(e.target.value))}
            className="rounded-lg border border-alabaster bg-white px-3 py-1.5 text-sm text-graphite shadow-sm focus:border-coral focus:ring-coral"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setView("import")}
          className="inline-flex items-center gap-2 rounded-xl bg-coral px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-coral-dark focus:outline-none focus:ring-2 focus:ring-coral focus:ring-offset-2"
        >
          <FolderOpenIcon className="h-5 w-5" />
          Edit files
        </button>
      </div>
    </header>
  );
}
