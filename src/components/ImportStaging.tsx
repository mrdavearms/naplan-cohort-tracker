/**
 * Import staging screen — the on-ramp. The user adds one or more sources (a
 * folder, or loose .xlsx files), each file is inspected on add (recognised /
 * not recognised), the year of test is confirmed where it can't be auto-detected,
 * then "Load" builds the analysis from the whole staged set in one go.
 *
 * Files from different locations combine here (two years in two folders), and the
 * list survives navigation, so "Edit imported files" can return and fix mistakes.
 */
import { useRef, useState } from "react";
import {
  ArrowUpTrayIcon,
  CheckCircleIcon,
  DocumentPlusIcon,
  ExclamationTriangleIcon,
  FolderOpenIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  inspectWorkbook,
  resolveYearOfTest,
  type RawWorkbookFile,
} from "@naplan-throughline/core";
import {
  effectiveYear,
  useApp,
  type StagedFile,
  type StagedSource,
} from "../state/AppState";
import { filesFromFileList, isTauri } from "../lib/dataSource";
import { loadFilesViaTauri, loadFolderViaTauri } from "../lib/tauriFs";
import { PrivacyNote } from "./ui";
import { DISCLAIMER } from "../appMeta";

const YEAR_OPTIONS = [2024, 2025, 2026, 2027];

let counter = 0;
const nextId = (): string => {
  counter += 1;
  return `stg-${Date.now().toString(36)}-${counter.toString(36)}`;
};

/** Is the staged set able to track one cohort Year 7 → Year 9 (same students, two
 *  years apart)? Returns an advisory message when not — never blocks Load. */
function readiness(staged: StagedSource[]): string | null {
  const present: { year: number; level: number }[] = [];
  for (const s of staged) {
    for (const f of s.files) {
      if (f.inspection.status !== "ok") continue;
      const y = effectiveYear(f);
      if (y != null) present.push({ year: y, level: f.inspection.yearLevel });
    }
  }
  if (present.length === 0) return null;
  const hasPair = present.some(
    (p) => p.level === 7 && present.some((q) => q.level === 9 && q.year === p.year + 2),
  );
  if (hasPair) return null;
  const labels = [...new Set(present.map((p) => `Year ${p.level} ${p.year}`))].sort();
  return (
    `So far you've added ${labels.join(", ")}. To track the same cohort from Year 7 ` +
    `to Year 9, also add a Year 7 file from two years before a Year 9 file ` +
    `(for example Year 7 2024 with Year 9 2026). You can still load now for ` +
    `single-year analysis (Sections 1–9).`
  );
}

export function ImportStaging() {
  const { state, stageAdd, stageRemoveFile, stageSetYear, stageClear, loadStaged, setView } =
    useApp();
  const folderInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  const staged = state.staged;
  const loading = state.status === "loading";
  const editing = state.status === "loaded"; // reached via "Edit imported files"

  const okFiles = staged.flatMap((s) => s.files).filter((f) => f.inspection.status === "ok");
  const missingYear = okFiles.some((f) => effectiveYear(f) == null);
  const loadableCount = new Set(
    okFiles.filter((f) => effectiveYear(f) != null).map((f) => f.relativePath),
  ).size;
  const canLoad = loadableCount > 0 && !missingYear && !loading;
  const readinessMsg = readiness(staged);

  /** Inspect picked files, dedupe against what's already staged, and stage them. */
  async function addSource(
    kind: "folder" | "files",
    label: string,
    raw: RawWorkbookFile[],
  ): Promise<void> {
    if (raw.length === 0) {
      setLocalErr("No .xlsx files were found there.");
      return;
    }
    const existing = new Set(staged.flatMap((s) => s.files.map((f) => f.relativePath)));
    const fresh = raw.filter((r) => !existing.has(r.relativePath));
    if (fresh.length === 0) {
      setLocalErr("Those files are already added.");
      return;
    }
    const bytes = new Map<string, ArrayBuffer | Uint8Array>();
    const files: StagedFile[] = [];
    for (const r of fresh) {
      const id = nextId();
      bytes.set(id, r.bytes);
      files.push({
        id,
        name: r.name,
        relativePath: r.relativePath,
        detectedYear: resolveYearOfTest(r.relativePath, r.name),
        assignedYear: null,
        inspection: await inspectWorkbook(r.bytes),
      });
    }
    stageAdd({ id: nextId(), kind, label, files }, bytes);
  }

  async function pickFolder(): Promise<void> {
    setLocalErr(null);
    if (!isTauri()) {
      folderInputRef.current?.click();
      return;
    }
    setBusy(true);
    try {
      const picked = await loadFolderViaTauri();
      if (picked) await addSource("folder", picked.label ?? "Folder", picked.files);
    } catch (e) {
      setLocalErr(`Could not read that folder: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function pickFiles(): Promise<void> {
    setLocalErr(null);
    if (!isTauri()) {
      filesInputRef.current?.click();
      return;
    }
    setBusy(true);
    try {
      const picked = await loadFilesViaTauri();
      if (picked) await addSource("files", picked.label ?? "Files", picked.files);
    } catch (e) {
      setLocalErr(`Could not read those files: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function onFolderInput(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    setBusy(true);
    setLocalErr(null);
    try {
      const raw = await filesFromFileList(list);
      const label = raw[0]?.relativePath.split(/[/\\]/)[0] ?? "Folder";
      await addSource("folder", label, raw);
    } catch (e) {
      setLocalErr(`Could not read that folder: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
      if (folderInputRef.current) folderInputRef.current.value = "";
    }
  }

  async function onFilesInput(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    setBusy(true);
    setLocalErr(null);
    try {
      const raw = await filesFromFileList(list);
      const label = raw.length === 1 ? raw[0]!.name : `${raw.length} files`;
      await addSource("files", label, raw);
    } catch (e) {
      setLocalErr(`Could not read those files: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
      if (filesInputRef.current) filesInputRef.current.value = "";
    }
  }

  const error = localErr ?? (state.status === "error" ? state.error : null);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-alabaster bg-white/60">
      <div className="dot-grid pointer-events-none absolute inset-0 opacity-[0.08]" />
      <div className="relative px-8 py-10">
        <div className="text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">
            <span className="hero-shimmer">Naplan Throughline</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-graphite/70">
            This app analyses your school’s NAPLAN <strong>Preliminary</strong> results. Each
            year ACARA (the Australian Curriculum, Assessment and Reporting Authority) releases
            a preliminary Student and School Summary Report (SSSR), usually during Term 2. Point
            Naplan&nbsp;Throughline at those files and it surfaces participation, proficiency,
            equity and skill gaps — and, as the headline, tracks the same students from Year 7
            to Year 9. Nothing leaves your machine.
          </p>
        </div>

        <details className="mx-auto mt-6 max-w-2xl rounded-xl border border-alabaster bg-white/70 p-4 text-left text-sm text-graphite/80">
          <summary className="cursor-pointer font-medium text-graphite">
            Which files do I need, and where do I get them?
          </summary>
          <div className="mt-3 space-y-3">
            <p>
              <strong>What to add:</strong> all the files from the <strong>SSSR Preliminary
              reports</strong> for your current Year 9s, <em>and</em> the same students’ Year 7
              files from two years earlier. The preliminary SSSR includes the School (IDA)
              Report, Class Summary Report, Class Test Report, Student Reports and
              proficiency-standard information — add the full set, across every domain (Reading,
              Numeracy, Spelling, Grammar and Punctuation) and both year levels, so every section
              can be calculated.
            </p>
            <p>
              The files for each year can sit in <strong>different folders</strong> — add each
              folder, or pick the files directly, using the buttons below.
            </p>
            <p>
              <strong>Where to get them:</strong> Principals download the data from the national
              assessment platform (Assessform). Log in to the NAPLAN portal for the year you
              need, using the same credentials your school used for the March test, then download
              the SSSR Preliminary report files.
            </p>
          </div>
        </details>

        {/* Hidden inputs for browser dev (Tauri uses native dialogs instead). */}
        <input
          ref={folderInputRef}
          type="file"
          multiple
          // @ts-expect-error non-standard but widely supported directory attributes
          webkitdirectory=""
          directory=""
          className="hidden"
          onChange={onFolderInput}
        />
        <input
          ref={filesInputRef}
          type="file"
          multiple
          accept=".xlsx"
          className="hidden"
          onChange={onFilesInput}
        />

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={pickFolder}
            disabled={busy || loading}
            className="inline-flex items-center gap-2 rounded-xl bg-coral px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-coral-dark focus:outline-none focus:ring-2 focus:ring-coral focus:ring-offset-2 disabled:opacity-60"
          >
            <FolderOpenIcon className="h-5 w-5" />
            Add folder
          </button>
          <button
            type="button"
            onClick={pickFiles}
            disabled={busy || loading}
            className="inline-flex items-center gap-2 rounded-xl border border-coral bg-white px-6 py-3 text-sm font-medium text-coral-text shadow-sm transition hover:bg-coral/5 focus:outline-none focus:ring-2 focus:ring-coral focus:ring-offset-2 disabled:opacity-60"
          >
            <DocumentPlusIcon className="h-5 w-5" />
            Add files
          </button>
        </div>

        {busy && <p className="mt-4 text-center text-sm text-graphite/60">Reading files…</p>}

        {error && (
          <div className="mx-auto mt-6 flex max-w-xl items-start gap-2 rounded-xl border border-coral/40 bg-coral/5 p-3 text-sm text-coral-text">
            <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {staged.length > 0 && (
          <div className="mx-auto mt-8 max-w-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-graphite/50">
                Staged files
              </h2>
              <button
                type="button"
                onClick={stageClear}
                disabled={loading}
                className="inline-flex items-center gap-1 text-xs font-medium text-graphite/50 hover:text-coral-text disabled:opacity-50"
              >
                <TrashIcon className="h-4 w-4" />
                Clear all
              </button>
            </div>

            {staged.map((source) => {
              const needsYear = source.files.some((f) => f.detectedYear == null);
              const assigned = source.files.find((f) => f.detectedYear == null)?.assignedYear ?? "";
              return (
                <div key={source.id} className="rounded-xl border border-alabaster bg-white/70 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium text-graphite">
                      {source.kind === "folder" ? "📁 " : "📄 "}
                      {source.label}
                    </span>
                    {needsYear && (
                      <label className="flex shrink-0 items-center gap-2 text-xs text-graphite/70">
                        Year sat
                        <select
                          value={assigned}
                          onChange={(e) => stageSetYear(source.id, Number(e.target.value))}
                          className="rounded-lg border border-alabaster bg-white px-2 py-1 text-xs text-graphite shadow-sm focus:border-coral focus:ring-coral"
                        >
                          <option value="" disabled>
                            Pick…
                          </option>
                          {YEAR_OPTIONS.map((y) => (
                            <option key={y} value={y}>
                              {y}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>

                  <ul className="space-y-1.5">
                    {source.files.map((f) => (
                      <li key={f.id} className="flex items-start gap-2 text-sm">
                        {f.inspection.status === "ok" ? (
                          <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-sage-text" />
                        ) : (
                          <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-coral-text" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="truncate text-graphite">{f.name}</span>
                          <span className="block text-xs text-graphite/60">
                            {f.inspection.status === "ok"
                              ? `${effectiveYear(f) ?? "year?"} · Year ${f.inspection.yearLevel} · ${f.inspection.domain}` +
                                (f.inspection.sheets === "reports"
                                  ? " (results table still needed)"
                                  : f.inspection.sheets === "results"
                                    ? " (reports still needed)"
                                    : "")
                              : f.inspection.reason}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => stageRemoveFile(source.id, f.id)}
                          disabled={loading}
                          aria-label={`Remove ${f.name}`}
                          className="shrink-0 rounded-md p-1 text-graphite/40 hover:bg-coral/10 hover:text-coral-text disabled:opacity-50"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}

            {readinessMsg && (
              <div className="flex items-start gap-2 rounded-xl border border-tuscan/50 bg-tuscan/10 p-3 text-sm text-graphite/80">
                <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-tuscan-dark" />
                <span>{readinessMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              {editing ? (
                <button
                  type="button"
                  onClick={() => setView("home")}
                  className="text-sm font-medium text-graphite/60 hover:text-graphite"
                >
                  Cancel
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={loadStaged}
                disabled={!canLoad}
                className="inline-flex items-center gap-2 rounded-xl bg-coral px-8 py-3 text-base font-medium text-white shadow-lg transition hover:bg-coral-dark focus:outline-none focus:ring-2 focus:ring-coral focus:ring-offset-2 disabled:opacity-50"
              >
                <ArrowUpTrayIcon className="h-5 w-5" />
                {loading
                  ? "Loading…"
                  : missingYear
                    ? "Confirm the year above"
                    : `Load ${loadableCount} spreadsheet${loadableCount === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        )}

        <div className="mx-auto mt-6 flex max-w-2xl items-start gap-2 rounded-xl border border-tuscan/60 bg-tuscan/10 p-3 text-left text-sm text-graphite/80">
          <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-tuscan-dark" />
          <span>
            <strong>Please read:</strong> {DISCLAIMER}
          </span>
        </div>

        <PrivacyNote>
          Local-only · no network calls · no student names in any chart, table, or export.
        </PrivacyNote>
      </div>
    </div>
  );
}
