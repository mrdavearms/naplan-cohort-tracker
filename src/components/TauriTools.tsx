/**
 * Tauri-only tools shown in Settings: local diagnostics export (no student data)
 * and a manual "Check for updates" against the baked-in release feed. Renders
 * nothing in the browser dev build.
 */
import { useState } from "react";
import { ArrowDownTrayIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { useApp } from "../state/AppState";
import { isTauri } from "../lib/dataSource";
import { appInfo, logDir, saveDiagnostics } from "../lib/tauriFs";
import { buildDiagnosticsText } from "../lib/diagnostics";
import { checkForUpdate, installAndRelaunch } from "../lib/updater";
import { Card } from "./ui";

export function TauriTools() {
  const { state } = useApp();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<"diag" | "update" | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<Awaited<ReturnType<typeof checkForUpdate>>>(null);

  if (!isTauri()) return null;

  async function exportDiagnostics() {
    setBusy("diag");
    setMsg(null);
    try {
      const info = await appInfo();
      const logPath = await logDir();
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
        logPath,
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
    setPendingUpdate(null);
    try {
      const update = await checkForUpdate();
      if (!update) {
        setMsg("You're up to date.");
        return;
      }
      setPendingUpdate(update);
      setMsg(null);
    } catch (e) {
      setMsg(`Could not check for updates. Details: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  async function installPendingUpdate() {
    if (!pendingUpdate) return;
    setBusy("update");
    setMsg("Downloading and installing…");
    try {
      await installAndRelaunch(pendingUpdate); // restarts the app on success
      setMsg("Update installed — restarting…");
    } catch (e) {
      setMsg(
        `Could not install the update: ${e instanceof Error ? e.message : String(e)}. ` +
          "You can also download the latest version from the download page.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-graphite">Diagnostics &amp; updates</h2>
        <p className="text-xs text-graphite/60">
          Diagnostics contain app version, OS and the ID match-rate only — never student data. The
          file also tells you where the app's log folder is, in case a problem needs reporting.
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
      {pendingUpdate && (
        <div className="rounded-xl border border-coral/40 bg-coral/5 px-4 py-3">
          <p className="text-sm text-graphite">
            Version {pendingUpdate.version} is available. Installing it restarts the app — any data
            you have loaded will need to be imported again, so finish what you're doing first.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={installPendingUpdate}
              disabled={busy !== null}
              className="inline-flex items-center gap-2 rounded-xl bg-coral px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-coral-dark disabled:opacity-60"
            >
              {busy === "update" ? "Installing…" : "Install & restart"}
            </button>
            <button
              type="button"
              onClick={() => setPendingUpdate(null)}
              disabled={busy !== null}
              className="inline-flex items-center gap-2 rounded-xl border border-alabaster bg-white px-4 py-2 text-sm text-graphite shadow-sm transition disabled:opacity-60"
            >
              Not now
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
