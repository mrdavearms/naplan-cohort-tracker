/**
 * Settings persistence adapter. Browser dev uses localStorage; the Tauri shell
 * swaps in a file-backed store (added in the shell phase). The pure schema +
 * `migrate()` live in core/ — this layer only reads/writes the blob.
 */
import { migrate, type Settings } from "@naplan-throughline/core";

const KEY = "naplan-throughline.settings";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return migrate(raw == null ? null : JSON.parse(raw));
  } catch {
    return migrate(null);
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable — settings stay in-memory for this session */
  }
}
