/** Render a component with a fabricated loaded app state (no async file load). */
import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { defaultSettings, type Settings, type Store } from "@naplan-cohort-tracker/core";
import { AppContext, type AppContextValue, type AppState, type ViewId } from "../state/AppState";

export function makeState(store: Store, overrides: Partial<AppState> = {}): AppState {
  return {
    status: "loaded",
    store,
    skipped: [],
    unresolved: [],
    error: null,
    sourceLabel: "Naplan (test)",
    primaryYear: 2026,
    settings: defaultSettings(),
    activeView: "home",
    staged: [],
    ...overrides,
  };
}

export function renderWithApp(
  ui: ReactElement,
  opts: {
    store: Store;
    state?: Partial<AppState>;
    settings?: Settings;
    view?: ViewId;
    callbacks?: Partial<Omit<AppContextValue, "state">>;
  } = {} as never,
) {
  const state = makeState(opts.store, {
    ...(opts.settings ? { settings: opts.settings } : {}),
    ...(opts.view ? { activeView: opts.view } : {}),
    ...opts.state,
  });
  const value: AppContextValue = {
    state,
    loadFiles: async () => {},
    setPrimaryYear: () => {},
    setView: () => {},
    updateSettings: () => {},
    stageAdd: () => {},
    stageRemove: () => {},
    stageRemoveFile: () => {},
    stageSetYear: () => {},
    stageClear: () => {},
    loadStaged: async () => {},
    ...opts.callbacks,
  };
  return render(<AppContext.Provider value={value}>{ui}</AppContext.Provider>);
}
