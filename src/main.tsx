import React from "react";
import ReactDOM from "react-dom/client";

// Self-hosted fonts (no network calls — privacy invariant). Weights match the
// Curriculum Planner design system: Inter 400/500/700, Roboto Slab 700, Syne 700/800.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/700.css";
import "@fontsource/roboto-slab/700.css";
import "@fontsource/syne/700.css";
import "@fontsource/syne/800.css";

import "./index.css";
import { App } from "./App";
import { AppStateProvider } from "./state/AppState";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found");

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <AppStateProvider>
      <App />
    </AppStateProvider>
  </React.StrictMode>,
);
