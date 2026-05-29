/**
 * Global top bar — present in EVERY state (pre-load and loaded). Carries the
 * brand (left, returns to the on-ramp/home) and the always-available Settings +
 * About; once data is loaded it also shows the source, the primary-year
 * selector (the year whose Year 9 cohort anchors the analysis) and "Edit files".
 */
import { availableYears } from "@naplan-cohort-tracker/core";
import {
  FolderOpenIcon,
  Cog6ToothIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useApp } from "../state/AppState";
import { BetaPill } from "./Beta";

export function TopBar() {
  const { state, setPrimaryYear, setView } = useApp();
  const loaded = state.status === "loaded";
  const active = state.activeView;

  const navBtn = (
    id: "settings" | "about",
    label: string,
    Icon: typeof Cog6ToothIcon,
  ) => (
    <button
      type="button"
      onClick={() => setView(id)}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition",
        active === id
          ? "bg-coral/10 text-coral-text"
          : "text-graphite/70 hover:bg-alabaster/50 hover:text-graphite",
      )}
    >
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );

  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-alabaster bg-white/40 px-6 py-2.5 backdrop-blur-sm">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => setView(loaded ? "home" : "import")}
          className="flex items-center gap-2.5 text-left"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-coral bg-graphite font-serif text-xs font-bold text-linen">
            NCT
          </span>
          <span className="font-display text-base font-extrabold leading-none text-graphite">
            NAPLAN Cohort Tracker
          </span>
        </button>
        <BetaPill />
      </div>

      <div className="flex items-center gap-2">
        {state.status === "loaded" && (
          <>
            {state.sourceLabel && (
              <span className="hidden max-w-[16rem] truncate text-xs text-graphite/50 lg:block">
                Source: {state.sourceLabel}
              </span>
            )}
            <label className="flex items-center gap-2 text-sm text-graphite/70">
              Primary year
              <select
                value={state.primaryYear ?? ""}
                onChange={(e) => setPrimaryYear(Number(e.target.value))}
                className="rounded-lg border border-alabaster bg-white px-3 py-1.5 text-sm text-graphite shadow-sm focus:border-coral focus:ring-coral"
              >
                {availableYears(state.store).map((y) => (
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
            <span className="mx-1 h-6 w-px bg-alabaster" />
          </>
        )}
        {navBtn("settings", "Settings", Cog6ToothIcon)}
        {navBtn("about", "About", InformationCircleIcon)}
      </div>
    </header>
  );
}
