/**
 * Top bar: shows the loaded source folder, the primary-year selector (the year
 * whose Year 9 cohort anchors the analysis), and a change-folder action.
 */
import { availableYears } from "@naplan-throughline/core";
import { useApp } from "../state/AppState";
import { FolderPicker } from "./FolderPicker";
import { SECTION_BY_ID } from "../views/sections";

export function TopBar() {
  const { state, setPrimaryYear } = useApp();
  if (state.status !== "loaded") return null;

  const years = availableYears(state.store);
  const viewTitle =
    state.activeView === "home"
      ? "Overview"
      : state.activeView === "settings"
        ? "Settings"
        : SECTION_BY_ID[state.activeView]?.title ?? "";

  return (
    <header className="flex items-center justify-between gap-4 border-b border-alabaster bg-white/40 px-8 py-3 backdrop-blur-sm">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-graphite">{viewTitle}</div>
        {state.sourceLabel && (
          <div className="truncate text-xs text-graphite/50">Folder: {state.sourceLabel}</div>
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
        <FolderPicker compact />
      </div>
    </header>
  );
}
