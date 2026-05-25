/**
 * Auto-update helpers (Tauri only). Checks the baked-in public release feed,
 * throttled to roughly once a day, and installs + relaunches on request. The
 * single outbound request is "is there a newer version?" — no student data.
 */
import type { Update } from "@tauri-apps/plugin-updater";
import { isTauri } from "./dataSource";

const LAST_CHECK_KEY = "naplan-throughline.lastUpdateCheck";
const DAY_MS = 24 * 60 * 60 * 1000;

/** True if we haven't checked in the last 24h (or never). */
export function dueForDailyCheck(now: number = Date.now()): boolean {
  try {
    const raw = localStorage.getItem(LAST_CHECK_KEY);
    if (!raw) return true;
    const last = Number(raw);
    return Number.isNaN(last) || now - last >= DAY_MS;
  } catch {
    return true; // storage unavailable — err on the side of checking
  }
}

/** Record that a check just happened (resets the daily throttle). */
export function markChecked(now: number = Date.now()): void {
  try {
    localStorage.setItem(LAST_CHECK_KEY, String(now));
  } catch {
    /* storage unavailable — no-op */
  }
}

/** Ask the release feed whether a newer version exists. Null in the browser
 *  build or when already up to date. */
export async function checkForUpdate(): Promise<Update | null> {
  if (!isTauri()) return null;
  const { check } = await import("@tauri-apps/plugin-updater");
  return check();
}

/** Download + install the update, then relaunch so it takes effect. */
export async function installAndRelaunch(update: Update): Promise<void> {
  await update.downloadAndInstall();
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}
