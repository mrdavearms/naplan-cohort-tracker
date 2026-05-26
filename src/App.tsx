/**
 * App shell composition: a global top bar (brand + Settings + About, always
 * present) sits above the body. Before any data is loaded the body is the
 * centred on-ramp; once loaded it becomes the section sidebar + active view.
 */
import { useApp } from "./state/AppState";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { HomeView } from "./views/HomeView";
import { SettingsView } from "./views/SettingsView";
import { SectionRouter } from "./views/SectionRouter";
import { ImportStaging } from "./components/ImportStaging";
import { AboutView } from "./views/AboutView";
import { UpdateNotice } from "./components/UpdateNotice";

function ActiveView() {
  const { state } = useApp();
  switch (state.activeView) {
    case "import":
      return <ImportStaging />;
    case "home":
      return <HomeView />;
    case "about":
      return <AboutView />;
    case "settings":
      return <SettingsView />;
    default:
      // sections require loaded data; fall back home otherwise
      return state.status === "loaded" ? <SectionRouter /> : <ImportStaging />;
  }
}

export function App() {
  const { state } = useApp();

  // The top bar is always present, so Settings + About are reachable from the
  // very first screen. Pre-load: a centred on-ramp (Import / About / Settings).
  // Loaded: the section sidebar + the active view.
  const body =
    state.status !== "loaded" ? (
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-12">
          {state.activeView === "settings" ? (
            <SettingsView />
          ) : state.activeView === "about" ? (
            <AboutView />
          ) : (
            <ImportStaging />
          )}
        </div>
      </div>
    ) : (
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto px-8 py-6">
          <div className="mx-auto max-w-5xl animate-[fadeIn_0.4s_ease-out]">
            {/* Keyed so a section crash clears when you navigate elsewhere. */}
            <ErrorBoundary key={state.activeView}>
              <ActiveView />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    );

  // Auto-update banner sits above everything (Tauri only; renders nothing in dev).
  return (
    <>
      <UpdateNotice />
      <div className="flex h-screen flex-col overflow-hidden">
        <TopBar />
        {body}
      </div>
    </>
  );
}
