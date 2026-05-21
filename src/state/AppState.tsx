/**
 * Global app state — React Context + useReducer (mirrors the Curriculum Planner
 * pattern; no router). Holds the loaded analysis store, the selected primary
 * year, school-identity settings, and the active view.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import {
  availableYears,
  defaultSettings,
  loadStoreFromFiles,
  type RawWorkbookFile,
  type Settings,
  type SkippedFile,
  type Store,
} from "@naplan-throughline/core";
import { loadSettings, saveSettings } from "../lib/persist";

export type ViewId =
  | "home"
  | "s1"
  | "s2"
  | "s3"
  | "s4"
  | "s5"
  | "s6"
  | "s7"
  | "s8"
  | "s9"
  | "s10"
  | "settings";

export type LoadStatus = "empty" | "loading" | "loaded" | "error";

export interface AppState {
  status: LoadStatus;
  store: Store;
  skipped: SkippedFile[];
  unresolved: SkippedFile[];
  error: string | null;
  /** Folder name the user loaded, for display. */
  sourceLabel: string | null;
  primaryYear: number | null;
  settings: Settings;
  activeView: ViewId;
}

type Action =
  | { type: "loadStart"; sourceLabel: string | null }
  | {
      type: "loadSuccess";
      store: Store;
      skipped: SkippedFile[];
      unresolved: SkippedFile[];
    }
  | { type: "loadError"; error: string }
  | { type: "setPrimaryYear"; year: number }
  | { type: "setView"; view: ViewId }
  | { type: "setSettings"; settings: Settings };

const initialState: AppState = {
  status: "empty",
  store: new Map(),
  skipped: [],
  unresolved: [],
  error: null,
  sourceLabel: null,
  primaryYear: null,
  settings: defaultSettings(),
  activeView: "home",
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "loadStart":
      return { ...state, status: "loading", error: null, sourceLabel: action.sourceLabel };
    case "loadSuccess": {
      const years = availableYears(action.store);
      return {
        ...state,
        status: "loaded",
        store: action.store,
        skipped: action.skipped,
        unresolved: action.unresolved,
        error: null,
        // default to the most recent year that can anchor a Y7→Y9 cohort if possible
        primaryYear: years[0] ?? null,
      };
    }
    case "loadError":
      return { ...state, status: "error", error: action.error };
    case "setPrimaryYear":
      return { ...state, primaryYear: action.year };
    case "setView":
      return { ...state, activeView: action.view };
    case "setSettings":
      return { ...state, settings: action.settings };
    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  loadFiles: (files: RawWorkbookFile[], sourceLabel: string | null) => Promise<void>;
  setPrimaryYear: (year: number) => void;
  setView: (view: ViewId) => void;
  updateSettings: (settings: Settings) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Hydrate persisted settings once on mount.
  useEffect(() => {
    dispatch({ type: "setSettings", settings: loadSettings() });
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      async loadFiles(files, sourceLabel) {
        dispatch({ type: "loadStart", sourceLabel });
        try {
          const { store, skipped, unresolved } = await loadStoreFromFiles(files);
          if (store.size === 0) {
            dispatch({
              type: "loadError",
              error:
                "No NAPLAN files could be loaded from that folder. Make sure it contains " +
                "SSSR Extract .xlsx files inside a year folder (e.g. “Naplan 2026”).",
            });
            return;
          }
          dispatch({ type: "loadSuccess", store, skipped, unresolved });
        } catch (e) {
          dispatch({ type: "loadError", error: e instanceof Error ? e.message : String(e) });
        }
      },
      setPrimaryYear: (year) => dispatch({ type: "setPrimaryYear", year }),
      setView: (view) => dispatch({ type: "setView", view }),
      updateSettings: (settings) => {
        saveSettings(settings);
        dispatch({ type: "setSettings", settings });
      },
    }),
    [state],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppStateProvider");
  return ctx;
}
