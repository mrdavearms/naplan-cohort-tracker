import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The React app lives at the repo root (src/). `core/` stays a workspace
// library, consumed as source via the alias below so Vite/esbuild transpiles
// its TypeScript directly (no separate build step). Per PLAN.md layout note.
//
// Tauri-aware bits: the dev server runs on a fixed port and `clearScreen` is
// off so Rust build output stays visible when running `tauri dev`.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  resolve: {
    alias: {
      "@naplan-throughline/core": path.resolve(__dirname, "core/src/index.ts"),
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  // exceljs is CJS and used by core's loader; pre-bundle it for the dev server.
  optimizeDeps: {
    include: ["exceljs", "plotly.js-dist-min", "react-plotly.js"],
  },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1200,
  },
});
