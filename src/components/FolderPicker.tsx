/**
 * Folder picker. In the browser (dev) it uses a directory <input>; in the Tauri
 * shell it calls the native folder dialog + fs walk (wired in the shell phase).
 * Either way it hands the host's files to the app state as RawWorkbookFiles.
 */
import { useRef, useState } from "react";
import { FolderOpenIcon } from "@heroicons/react/24/outline";
import { useApp } from "../state/AppState";
import { filesFromFileList, isTauri } from "../lib/dataSource";
import { loadFolderViaTauri } from "../lib/tauriFs";

export function FolderPicker({ compact = false }: { compact?: boolean }) {
  const { loadFiles } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handlePick() {
    if (!isTauri()) {
      inputRef.current?.click();
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const picked = await loadFolderViaTauri();
      if (picked) await loadFiles(picked.files, picked.label);
    } catch (e) {
      // Native dialog / folder-read failure — surface it instead of failing silently.
      setErr(`Could not read that folder: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    setBusy(true);
    setErr(null);
    try {
      const files = await filesFromFileList(list);
      const label = files[0]?.relativePath.split(/[/\\]/)[0] ?? null;
      await loadFiles(files, label);
    } catch (e2) {
      setErr(`Could not read that folder: ${e2 instanceof Error ? e2.message : String(e2)}`);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={compact ? "inline-flex flex-col items-end gap-1" : "flex flex-col items-center gap-2"}>
      {/* webkitdirectory lets the browser pick a whole folder; ignored in Tauri. */}
      <input
        ref={inputRef}
        type="file"
        multiple
        // @ts-expect-error non-standard but widely supported directory attributes
        webkitdirectory=""
        directory=""
        className="hidden"
        onChange={handleInput}
      />
      <button
        type="button"
        onClick={handlePick}
        disabled={busy}
        className={
          compact
            ? "inline-flex items-center gap-2 rounded-xl bg-coral px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-coral-dark focus:outline-none focus:ring-2 focus:ring-coral focus:ring-offset-2 disabled:opacity-60"
            : "inline-flex items-center gap-3 rounded-xl bg-coral px-8 py-4 text-base font-medium text-white shadow-lg transition hover:bg-coral-dark focus:outline-none focus:ring-2 focus:ring-coral focus:ring-offset-2 disabled:opacity-60"
        }
      >
        <FolderOpenIcon className={compact ? "h-5 w-5" : "h-6 w-6"} />
        {busy ? "Loading…" : compact ? "Change folder" : "Choose your NAPLAN folder"}
      </button>
      {err && <p className="max-w-xs text-xs text-coral-text">{err}</p>}
    </div>
  );
}
