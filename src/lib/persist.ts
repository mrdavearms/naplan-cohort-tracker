/**
 * Settings persistence adapter. Reads/writes the settings blob to the WebView's
 * localStorage — which the Tauri shell persists to the app's data directory, so
 * it survives restarts and stays local-only. The pure schema + `migrate()` live
 * in core/; this layer only serialises the blob.
 */
import { migrate, type Settings } from "@naplan-cohort-tracker/core";

const KEY = "naplan-cohort-tracker.settings";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return migrate(raw == null ? null : JSON.parse(raw));
  } catch {
    return migrate(null);
  }
}

/** Returns false when storage is unavailable or full — the caller MUST surface
 *  that, or the school identity silently vanishes on the next launch. */
export function saveSettings(settings: Settings): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
