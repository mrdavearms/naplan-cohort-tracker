/**
 * Native folder loading for the Tauri shell. Stub for now — the real
 * implementation (native dialog via @tauri-apps/plugin-dialog + recursive read
 * via @tauri-apps/plugin-fs) is wired in the shell phase, once those plugins are
 * installed. Keeping it behind this seam lets the browser dev build stay free of
 * Tauri JS deps.
 */
import type { RawWorkbookFile } from "@naplan-throughline/core";

export interface PickedFolder {
  label: string | null;
  files: RawWorkbookFile[];
}

export async function loadFolderViaTauri(): Promise<PickedFolder | null> {
  // Replaced in the Tauri shell phase.
  console.warn("loadFolderViaTauri called outside a wired Tauri build");
  return null;
}
