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
      "@naplan-cohort-tracker/core": path.resolve(__dirname, "core/src/index.ts"),
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
    // Plotly (~4.8 MB) is inherently large; this is a bundled desktop app, so
    // chunk size isn't a network concern. Raise the warning threshold.
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: {
        // Split the heavy vendors into their own chunks (better caching, no
        // single oversized bundle). Plotly, pdfmake and exceljs are the big ones.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("plotly")) return "vendor-plotly";
          if (id.includes("pdfmake")) return "vendor-pdf";
          if (id.includes("exceljs")) return "vendor-xlsx";
          if (id.includes("react")) return "vendor-react";
          return undefined;
        },
      },
    },
  },
});
