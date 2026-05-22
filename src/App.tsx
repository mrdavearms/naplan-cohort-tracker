/**
 * App shell composition: sidebar + (top bar + active view). Before any data is
 * loaded the home view owns the full window (the on-ramp); once loaded the
 * sidebar + top bar appear.
 */
import { useApp } from "./state/AppState";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { HomeView } from "./views/HomeView";
import { SettingsView } from "./views/SettingsView";
import { SectionRouter } from "./views/SectionRouter";

function ActiveView() {
  const { state } = useApp();
  switch (state.activeView) {
    case "home":
      return <HomeView />;
    case "settings":
      return <SettingsView />;
    default:
      // sections require loaded data; fall back home otherwise
      return state.status === "loaded" ? <SectionRouter /> : <HomeView />;
  }
}

export function App() {
  const { state } = useApp();

  // Pre-load: a single centered on-ramp, no chrome.
  if (state.status !== "loaded") {
    return (
      <div className="min-h-screen">
        <div className="mx-auto max-w-3xl px-6 py-16">
          {state.activeView === "settings" ? <SettingsView /> : <HomeView />}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-8 py-6">
          <div className="mx-auto max-w-5xl animate-[fadeIn_0.4s_ease-out]">
            {/* Keyed so a section crash clears when you navigate elsewhere. */}
            <ErrorBoundary key={state.activeView}>
              <ActiveView />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
