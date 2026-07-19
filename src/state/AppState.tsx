/**
 * Global app state — React Context + useReducer (mirrors the Curriculum Planner
 * pattern; no router). Holds the loaded analysis store, the selected primary
 * year, school-identity settings, and the active view.
 */
import { createContext, useContext, useMemo, useRef, useReducer, type ReactNode } from "react";
import {
  availableYears,
  defaultSettings,
  loadStoreFromFiles,
  type RawWorkbookFile,
  type Settings,
  type SkippedFile,
  type Store,
  type WorkbookInspection,
} from "@naplan-cohort-tracker/core";
import { loadSettings, saveSettings } from "../lib/persist";

export type ViewId =
  | "import"
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
  | "settings"
  | "about";

export type LoadStatus = "empty" | "loading" | "loaded" | "error";

/** One file staged on the import screen. Metadata only — the raw bytes live in a
 *  ref in the provider (keyed by `id`), never in reducer state, so they can't be
 *  accidentally serialised and don't bloat dispatched state. */
export interface StagedFile {
  id: string;
  name: string;
  relativePath: string;
  /** Year of test inferred from the path/name (`Naplan YYYY`), or null. */
  detectedYear: number | null;
  /** Year of test the user assigned (used when `detectedYear` is null). */
  assignedYear: number | null;
  inspection: WorkbookInspection;
}

/** One "Add" action on the import screen — a folder pick or a loose-file pick. */
export interface StagedSource {
  id: string;
  kind: "folder" | "files";
  label: string;
  files: StagedFile[];
}

/** The year of test a staged file will load under (assigned wins over detected). */
export function effectiveYear(f: StagedFile): number | null {
  return f.assignedYear ?? f.detectedYear;
}

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
  /** Files staged on the import screen (metadata only; bytes live in a ref). */
  staged: StagedSource[];
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
  | { type: "setSettings"; settings: Settings }
  | { type: "stageAdd"; source: StagedSource }
  | { type: "stageRemove"; sourceId: string }
  | { type: "stageRemoveFile"; sourceId: string; fileId: string }
  | { type: "stageSetYear"; sourceId: string; year: number }
  | { type: "stageClear" };

export const initialState: AppState = {
  status: "empty",
  store: new Map(),
  skipped: [],
  unresolved: [],
  error: null,
  sourceLabel: null,
  primaryYear: null,
  settings: defaultSettings(),
  activeView: "import",
  staged: [],
};

export function reducer(state: AppState, action: Action): AppState {
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
        // default to the most recent year loaded (availableYears is sorted desc)
        primaryYear: years[0] ?? null,
        // leave the import screen, but KEEP `staged` so "Edit imported files"
        // can reopen the list intact.
        activeView: state.activeView === "import" ? "home" : state.activeView,
      };
    }
    case "loadError":
      // A failed RE-load must not discard a working analysis. The store is
      // still in memory; dropping to "error" would render the pre-load on-ramp
      // and read to the user as "the app lost my data". Keep them where they
      // are and surface the message instead.
      return state.status === "loaded" && state.store.size > 0
        ? { ...state, error: action.error }
        : { ...state, status: "error", error: action.error };
    case "setPrimaryYear":
      return { ...state, primaryYear: action.year };
    case "setView":
      return { ...state, activeView: action.view };
    case "setSettings":
      return { ...state, settings: action.settings };
    case "stageAdd":
      return { ...state, staged: [...state.staged, action.source] };
    case "stageRemove":
      return { ...state, staged: state.staged.filter((s) => s.id !== action.sourceId) };
    case "stageRemoveFile":
      return {
        ...state,
        staged: state.staged
          .map((s) =>
            s.id !== action.sourceId
              ? s
              : { ...s, files: s.files.filter((f) => f.id !== action.fileId) },
          )
          .filter((s) => s.files.length > 0), // drop a source once its last file goes
      };
    case "stageSetYear":
      return {
        ...state,
        staged: state.staged.map((s) =>
          s.id !== action.sourceId
            ? s
            : {
                ...s,
                // Apply the picked year only to files that couldn't auto-detect one;
                // files with a folder-derived year keep it.
                files: s.files.map((f) =>
                  f.detectedYear == null ? { ...f, assignedYear: action.year } : f,
                ),
              },
        ),
      };
    case "stageClear":
      return { ...state, staged: [] };
    default:
      return state;
  }
}

export interface AppContextValue {
  state: AppState;
  loadFiles: (files: RawWorkbookFile[], sourceLabel: string | null) => Promise<void>;
  setPrimaryYear: (year: number) => void;
  setView: (view: ViewId) => void;
  updateSettings: (settings: Settings) => boolean;
  /** Add a picked source (folder or loose files) to the import staging list. The
   *  bytes Map is keyed by `StagedFile.id`; it is merged into the provider's ref. */
  stageAdd: (source: StagedSource, bytes: Map<string, ArrayBuffer | Uint8Array>) => void;
  stageRemove: (sourceId: string) => void;
  stageRemoveFile: (sourceId: string, fileId: string) => void;
  /** Assign the year of test to a source's files that couldn't auto-detect one. */
  stageSetYear: (sourceId: string, year: number) => void;
  stageClear: () => void;
  /** Build the analysis from the current staged set (recognised files with a year). */
  loadStaged: () => Promise<void>;
}

/** Composite label for the loaded source(s), shown in the top bar. */
function stagedLabel(sources: StagedSource[]): string | null {
  if (sources.length === 0) return null;
  if (sources.length === 1) return sources[0]!.label;
  return `${sources.length} sources`;
}

// Exported so tests can inject a fabricated loaded state without the async
// file-load machinery. Production code uses the provider + useApp() below.
export const AppContext = createContext<AppContextValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  // Hydrate persisted settings synchronously via lazy init so a SettingsView
  // mounted on first paint never captures blank defaults (which a Save would
  // then persist over the real settings).
  const [state, dispatch] = useReducer(reducer, initialState, (s) => ({
    ...s,
    settings: loadSettings(),
  }));

  // Raw workbook bytes for staged files, keyed by StagedFile.id. Kept OUT of
  // reducer state (a ref) so bytes are never dispatched/serialised and don't
  // bloat state. Survives re-renders and navigation, so "Edit imported files"
  // can rebuild from the same bytes.
  const bytesRef = useRef<Map<string, ArrayBuffer | Uint8Array>>(new Map());

  const value = useMemo<AppContextValue>(() => {
    async function runLoad(files: RawWorkbookFile[], sourceLabel: string | null) {
      dispatch({ type: "loadStart", sourceLabel });
      try {
        const { store, skipped, unresolved } = await loadStoreFromFiles(files);
        if (store.size === 0) {
          dispatch({
            type: "loadError",
            error:
              "No NAPLAN data could be loaded. Make sure you've added SSSR Extract .xlsx " +
              "files and confirmed the year for any that couldn't be detected.",
          });
          return;
        }
        dispatch({ type: "loadSuccess", store, skipped, unresolved });
      } catch (e) {
        dispatch({ type: "loadError", error: e instanceof Error ? e.message : String(e) });
      }
    }

    return {
      state,
      loadFiles: runLoad,
      setPrimaryYear: (year) => dispatch({ type: "setPrimaryYear", year }),
      setView: (view) => dispatch({ type: "setView", view }),
      updateSettings: (settings) => {
        const persisted = saveSettings(settings);
        dispatch({ type: "setSettings", settings });
        return persisted;
      },
      stageAdd: (source, bytes) => {
        for (const [id, b] of bytes) bytesRef.current.set(id, b);
        dispatch({ type: "stageAdd", source });
      },
      stageRemove: (sourceId) => {
        const src = state.staged.find((s) => s.id === sourceId);
        if (src) for (const f of src.files) bytesRef.current.delete(f.id);
        dispatch({ type: "stageRemove", sourceId });
      },
      stageRemoveFile: (sourceId, fileId) => {
        bytesRef.current.delete(fileId);
        dispatch({ type: "stageRemoveFile", sourceId, fileId });
      },
      stageSetYear: (sourceId, year) => dispatch({ type: "stageSetYear", sourceId, year }),
      stageClear: () => {
        bytesRef.current.clear();
        dispatch({ type: "stageClear" });
      },
      async loadStaged() {
        const seen = new Set<string>();
        const files: RawWorkbookFile[] = [];
        for (const src of state.staged) {
          for (const f of src.files) {
            if (f.inspection.status !== "ok") continue;
            const year = effectiveYear(f);
            if (year == null) continue;
            if (seen.has(f.relativePath)) continue; // dedupe across sources
            seen.add(f.relativePath);
            const bytes = bytesRef.current.get(f.id);
            if (!bytes) continue;
            files.push({ name: f.name, relativePath: f.relativePath, bytes, yearOfTest: year });
          }
        }
        await runLoad(files, stagedLabel(state.staged));
      },
    };
  }, [state]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppStateProvider");
  return ctx;
}
