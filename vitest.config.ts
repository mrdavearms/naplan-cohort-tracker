import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Two projects: the pure analysis core (node) and the React UI (jsdom). The UI
// project aliases the heavy Plotly packages to lightweight stubs (jsdom has no
// canvas/WebGL) and resolves the workspace core from source.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "core",
          include: ["core/tests/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        plugins: [react()],
        resolve: {
          alias: {
            "plotly.js-dist-min": path.resolve(__dirname, "src/test/stubs/plotly-dist.ts"),
            "react-plotly.js/factory": path.resolve(__dirname, "src/test/stubs/react-plotly-factory.tsx"),
            "@naplan-cohort-tracker/core": path.resolve(__dirname, "core/src/index.ts"),
            "@": path.resolve(__dirname, "src"),
          },
        },
        test: {
          name: "ui",
          include: ["src/**/*.test.{ts,tsx}"],
          environment: "jsdom",
          globals: true,
          setupFiles: ["./src/test/setup.ts"],
        },
      },
    ],
  },
});
