/**
 * Tauri-only tools shown in Settings: local diagnostics export (no student data)
 * and a manual "Check for updates" against the baked-in release feed. Renders
 * nothing in the browser dev build.
 */
import { useState } from "react";
import { ArrowDownTrayIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { useApp } from "../state/AppState";
import { isTauri } from "../lib/dataSource";
import { appInfo, saveDiagnostics } from "../lib/tauriFs";
import { buildDiagnosticsText } from "../lib/diagnostics";
import { checkForUpdate, installAndRelaunch } from "../lib/updater";
import { Card } from "./ui";

export function TauriTools() {
  const { state } = useApp();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<"diag" | "update" | null>(null);

  if (!isTauri()) return null;

  async function exportDiagnostics() {
    setBusy("diag");
    setMsg(null);
    try {
      const info = await appInfo();
      const text = buildDiagnosticsText({
        appVersion: info.version,
        os: info.os,
        arch: info.arch,
        userAgent: navigator.userAgent,
        schoolName: state.settings.schoolName,
        primaryYear: state.primaryYear,
        store: state.store,
        skipped: state.skipped,
        unresolved: state.unresolved,
      });
      const path = await saveDiagnostics(text, "naplan-cohort-tracker-diagnostics.txt");
      setMsg(path ? `Saved diagnostics to ${path}` : "Cancelled.");
    } catch (e) {
      setMsg(`Could not export diagnostics: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  async function checkForUpdates() {
    setBusy("update");
    setMsg(null);
    try {
      const update = await checkForUpdate();
      if (!update) {
        setMsg("You're up to date.");
        return;
      }
      setMsg(`Update available: ${update.version}. Downloading & installing…`);
      await installAndRelaunch(update); // restarts the app on success
      setMsg("Update installed — restarting…");
    } catch (e) {
      setMsg(`Could not check for updates. Details: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-graphite">Diagnostics &amp; updates</h2>
        <p className="text-xs text-graphite/60">
          Diagnostics contain app version, OS and the ID match-rate only — never student data.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={exportDiagnostics}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-xl border border-alabaster bg-white px-4 py-2 text-sm text-graphite shadow-sm transition hover:border-coral/40 disabled:opacity-60"
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
          {busy === "diag" ? "Exporting…" : "Export diagnostics"}
        </button>
        <button
          type="button"
          onClick={checkForUpdates}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-xl border border-alabaster bg-white px-4 py-2 text-sm text-graphite shadow-sm transition hover:border-coral/40 disabled:opacity-60"
        >
          <ArrowPathIcon className="h-4 w-4" />
          {busy === "update" ? "Checking…" : "Check for updates"}
        </button>
      </div>
      {msg && <p className="text-sm text-graphite/70">{msg}</p>}
    </Card>
  );
}
