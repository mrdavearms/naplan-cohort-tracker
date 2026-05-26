/**
 * Data-source boundary. `core/` is filesystem-free: the host layer discovers
 * files + reads bytes, then injects `RawWorkbookFile[]`. Two hosts:
 *   - Tauri shell: native folder dialog + recursive fs read (added in the shell phase).
 *   - Browser dev: a <input type="file" webkitdirectory> directory picker.
 */
import type { RawWorkbookFile } from "@naplan-cohort-tracker/core";

/** True when running inside the Tauri webview (native shell available). */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const isXlsx = (name: string): boolean =>
  name.toLowerCase().endsWith(".xlsx") && !name.startsWith("~$");

/** Convert a browser FileList (from a webkitdirectory input) to RawWorkbookFiles. */
export async function filesFromFileList(list: FileList | File[]): Promise<RawWorkbookFile[]> {
  const files = Array.from(list).filter((f) => isXlsx(f.name));
  return Promise.all(
    files.map(async (f) => ({
      name: f.name,
      // webkitRelativePath includes the chosen folder + any subfolders.
      relativePath: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
      bytes: await f.arrayBuffer(),
    })),
  );
}
