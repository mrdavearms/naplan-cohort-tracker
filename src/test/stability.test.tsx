/**
 * Stability regressions: a failed re-load must never throw the user out of a
 * working analysis, and a failed settings save must never claim success.
 */
import { describe, expect, it } from "vitest";
import { reducer, initialState, type AppState } from "../state/AppState";
import { buildSyntheticStore } from "./fixtures";
import { saveSettings } from "../lib/persist";
import { migrate } from "@naplan-cohort-tracker/core";
import { buildDiagnosticsText } from "../lib/diagnostics";

describe("loadError while data is already loaded", () => {
  it("keeps the loaded store and status so the analysis stays on screen", async () => {
    const store = await buildSyntheticStore();
    const loaded: AppState = {
      ...initialState,
      status: "loaded",
      store,
      primaryYear: 2026,
      activeView: "home",
    };

    const next = reducer(loaded, { type: "loadError", error: "No NAPLAN data could be loaded." });

    expect(next.status).toBe("loaded");
    expect(next.store).toBe(store);
    expect(next.error).toBe("No NAPLAN data could be loaded.");
  });

  it("still shows the error screen when nothing was loaded yet", () => {
    const next = reducer(initialState, { type: "loadError", error: "boom" });
    expect(next.status).toBe("error");
    expect(next.error).toBe("boom");
  });
});

describe("buildDiagnosticsText", () => {
  it("names the log folder and still contains no student data", async () => {
    const store = await buildSyntheticStore();
    const text = buildDiagnosticsText({
      appVersion: "1.3.0",
      os: "macos",
      arch: "aarch64",
      userAgent: "test",
      schoolName: "Test School",
      primaryYear: 2026,
      store,
      skipped: [],
      unresolved: [],
      logPath: "/Users/x/Library/Logs/naplan",
    });
    expect(text).toContain("/Users/x/Library/Logs/naplan");
    // No two-capitalised-word patterns (e.g. a student name) outside the known
    // non-student labels (app title, school name).
    const withoutKnownLabels = text.replace(/NAPLAN Cohort Tracker/g, "").replace(/Test School/g, "");
    expect(withoutKnownLabels).not.toMatch(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/);
  });
});

describe("saveSettings", () => {
  it("returns true when storage works", () => {
    expect(saveSettings(migrate(null))).toBe(true);
  });

  it("returns false when storage throws", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    try {
      expect(saveSettings(migrate(null))).toBe(false);
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
