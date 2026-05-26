/**
 * Native folder loading for the Tauri shell. The native dialog picks a folder;
 * a Rust command (`read_workbook_folder`) walks it and returns workbook bytes.
 * core/ stays filesystem-free — it only ever sees the injected bytes.
 */
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { RawWorkbookFile } from "@naplan-cohort-tracker/core";

export interface PickedFolder {
  label: string | null;
  files: RawWorkbookFile[];
}

/** Shape returned by the Rust `read_workbook_folder` command. */
interface NativeRawFile {
  name: string;
  relativePath: string;
  bytes: number[];
}

export async function loadFolderViaTauri(): Promise<PickedFolder | null> {
  const dir = await open({ directory: true, multiple: false, title: "Choose your NAPLAN folder" });
  if (typeof dir !== "string") return null; // cancelled

  const native = await invoke<NativeRawFile[]>("read_workbook_folder", { dir });
  const files: RawWorkbookFile[] = native.map((f) => ({
    name: f.name,
    relativePath: f.relativePath,
    bytes: Uint8Array.from(f.bytes),
  }));

  const label = dir.split(/[/\\]/).filter(Boolean).at(-1) ?? null;
  return { label, files };
}

/** Pick individual `.xlsx` files via a native multi-select dialog. There is no
 *  containing folder, so each file's `relativePath` is just its name and the
 *  user assigns the year of test on the import screen. Returns null if cancelled. */
export async function loadFilesViaTauri(): Promise<PickedFolder | null> {
  const picked = await open({
    directory: false,
    multiple: true,
    title: "Choose NAPLAN .xlsx files",
    filters: [{ name: "Excel", extensions: ["xlsx"] }],
  });
  if (picked == null) return null; // cancelled
  const paths = Array.isArray(picked) ? picked : [picked];
  if (paths.length === 0) return null;

  const native = await invoke<NativeRawFile[]>("read_workbook_files", { paths });
  const files: RawWorkbookFile[] = native.map((f) => ({
    name: f.name,
    relativePath: f.relativePath,
    bytes: Uint8Array.from(f.bytes),
  }));

  const label = files.length === 1 ? files[0]!.name : `${files.length} files`;
  return { label, files };
}

/** Read app version + OS/arch for the diagnostics export (no student data). */
export async function appInfo(): Promise<{ version: string; os: string; arch: string }> {
  return invoke("app_info");
}

/** Persist a plain-text diagnostics file via a native save dialog. Returns the
 *  saved path, or null if cancelled. Contents must contain no student data. */
export async function saveDiagnostics(contents: string, suggestedName: string): Promise<string | null> {
  const { save } = await import("@tauri-apps/plugin-dialog");
  const path = await save({
    title: "Export diagnostics",
    defaultPath: suggestedName,
    filters: [{ name: "Text", extensions: ["txt"] }],
  });
  if (typeof path !== "string") return null;
  await invoke("save_text_file", { path, contents });
  return path;
}
