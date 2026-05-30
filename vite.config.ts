import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Build-time stamp (shown on the About screen). Baked in here so it is present
// synchronously on every screen and in the browser dev preview, not only via the
// native Tauri command. Version comes from package.json (kept in sync with
// tauri.conf.json + Cargo.toml at release); commit + time are captured at build.
const pkgVersion = (
  JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf8")) as { version: string }
).version;

function gitShortHash(): string {
  try {
    // Fixed args, no shell — execFileSync avoids any command-injection surface.
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

const buildTime = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Melbourne",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZoneName: "short",
}).format(new Date());

// The React app lives at the repo root (src/). `core/` stays a workspace
// library, consumed as source via the alias below so Vite/esbuild transpiles
// its TypeScript directly (no separate build step). Per PLAN.md layout note.
//
// Tauri-aware bits: the dev server runs on a fixed port and `clearScreen` is
// off so Rust build output stays visible when running `tauri dev`.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  define: {
    __APP_VERSION__: JSON.stringify(pkgVersion),
    __GIT_COMMIT__: JSON.stringify(gitShortHash()),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
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
