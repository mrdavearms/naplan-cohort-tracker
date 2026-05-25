/**
 * App-level auto-update banner (Tauri only). Checks the release feed on launch
 * (throttled to once a day) and again every 24h while the app stays open. When a
 * newer version is found it shows a clear banner with one-click "Install &
 * restart" — never a silent restart. Renders nothing in the browser build.
 */
import { useEffect, useState } from "react";
import { ArrowPathIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type { Update } from "@tauri-apps/plugin-updater";
import { isTauri } from "../lib/dataSource";
import { checkForUpdate, dueForDailyCheck, installAndRelaunch, markChecked } from "../lib/updater";

const DAY_MS = 24 * 60 * 60 * 1000;

export function UpdateNotice() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;

    async function run(force: boolean) {
      if (!force && !dueForDailyCheck()) return;
      try {
        const found = await checkForUpdate();
        markChecked();
        if (!cancelled && found) setUpdate(found);
      } catch {
        // Stay silent on the auto path — the manual check in Settings surfaces
        // any feed/network errors. A failed daily check shouldn't nag the user.
      }
    }

    run(false); // on launch, at most once per day
    const id = setInterval(() => run(true), DAY_MS); // and once a day while open
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!update || dismissed) return null;

  async function install() {
    setInstalling(true);
    setError(null);
    try {
      await installAndRelaunch(update!); // app relaunches on success
    } catch (e) {
      setError(`Couldn’t install the update: ${e instanceof Error ? e.message : String(e)}`);
      setInstalling(false);
    }
  }

  return (
    <div className="fixed inset-x-0 top-0 z-50 border-b border-coral/40 bg-coral/10 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-6 py-2.5 text-sm">
        <ArrowPathIcon className="h-5 w-5 shrink-0 text-coral-text" />
        <span className="min-w-0 flex-1 text-graphite">
          {error ? (
            <span className="text-coral-text">{error}</span>
          ) : (
            <>
              <strong>Update available:</strong> Naplan Throughline {update.version} is ready to
              install.
            </>
          )}
        </span>
        <button
          type="button"
          onClick={install}
          disabled={installing}
          className="inline-flex items-center gap-2 rounded-lg bg-coral px-4 py-1.5 font-medium text-white shadow-sm transition hover:bg-coral-dark disabled:opacity-60"
        >
          {installing ? "Installing…" : "Install & restart"}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          disabled={installing}
          aria-label="Dismiss update notice"
          className="rounded-md p-1 text-graphite/50 hover:bg-coral/10 hover:text-coral-text disabled:opacity-50"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
