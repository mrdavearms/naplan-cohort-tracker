/**
 * Folder-load pipeline — pure and filesystem-free. The Tauri layer (or the
 * browser dir-input in dev) discovers files and reads their bytes, then injects
 * them here as `RawWorkbookFile[]`. This module resolves the year of test from
 * the containing `Naplan YYYY` folder (mirrors the legacy `LocalBackend`),
 * parses each workbook, and assembles the keyed store.
 *
 * core/ never touches the filesystem — only bytes handed to it.
 */
import {
  buildStore,
  detectYearOfTestFromName,
  parseWorkbook,
  type BuildStoreResult,
  type SkippedFile,
  type WorkbookInput,
} from "./loader";

/** A file discovered + read by the host layer (Tauri / browser). */
export interface RawWorkbookFile {
  /** Base file name, e.g. "SSSR Extract Reading Y9.xlsx". */
  name: string;
  /** Path relative to the chosen folder, e.g. "Naplan 2026/SSSR Extract ….xlsx".
   *  Used to resolve the year of test from a `Naplan YYYY` parent folder. */
  relativePath: string;
  /** Raw workbook bytes. */
  bytes: ArrayBuffer | Uint8Array;
}

/**
 * Resolve the year of test for a file: prefer a 20xx in any path segment
 * (the `Naplan YYYY` folder), else fall back to the file name. Returns null
 * when no year can be found.
 */
export function resolveYearOfTest(relativePath: string, name: string): number | null {
  const segments = relativePath.split(/[/\\]/).filter(Boolean);
  // Walk parent segments first (the folder year wins over any year in the file name).
  for (const seg of segments.slice(0, -1)) {
    const y = detectYearOfTestFromName(seg);
    if (y != null) return y;
  }
  return detectYearOfTestFromName(name);
}

export interface LoadStoreResult extends BuildStoreResult {
  /** Files whose year of test could not be resolved (not parsed). */
  unresolved: SkippedFile[];
}

/** Parse + assemble a store from injected workbook bytes. Never throws on a
 *  single bad file — failures land in `skipped` / `unresolved`. */
export async function loadStoreFromFiles(
  files: readonly RawWorkbookFile[],
): Promise<LoadStoreResult> {
  const inputs: WorkbookInput[] = [];
  const unresolved: SkippedFile[] = [];
  const parseSkipped: SkippedFile[] = [];

  for (const f of files) {
    const yearOfTest = resolveYearOfTest(f.relativePath, f.name);
    if (yearOfTest == null) {
      unresolved.push({ filename: f.name, reason: "could not determine year of test from path/name" });
      continue;
    }
    try {
      const workbook = await parseWorkbook(f.bytes);
      inputs.push({ filename: f.name, yearOfTest, workbook });
    } catch (e) {
      parseSkipped.push({ filename: f.name, reason: e instanceof Error ? e.message : String(e) });
    }
  }

  const { store, skipped } = buildStore(inputs);
  return { store, skipped: [...parseSkipped, ...skipped], unresolved };
}
