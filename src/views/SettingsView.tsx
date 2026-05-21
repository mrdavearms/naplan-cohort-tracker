/**
 * Settings — school identity as DATA, never code. A blank install is neutral;
 * what's entered here (name, number, improvement-plan references) propagates
 * into the narrative sections. Persisted via the versioned settings schema.
 */
import { useState } from "react";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import {
  VALID_DOMAINS,
  type ImprovementPlanRef,
  type Settings,
} from "@naplan-throughline/core";
import { useApp } from "../state/AppState";
import { Card, SectionHeading } from "../components/ui";

const inputCls =
  "w-full rounded-lg border border-alabaster bg-white px-3 py-2 text-sm text-graphite shadow-sm focus:border-coral focus:ring-coral";
const labelCls = "block text-sm font-medium text-graphite";

export function SettingsView() {
  const { state, updateSettings } = useApp();
  const [draft, setDraft] = useState<Settings>(state.settings);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  function setRef(i: number, patch: Partial<ImprovementPlanRef>) {
    setDraft((d) => ({
      ...d,
      improvementPlanRefs: d.improvementPlanRefs.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    }));
    setSaved(false);
  }

  function addRef() {
    set("improvementPlanRefs", [...draft.improvementPlanRefs, { role: "", code: "" }]);
  }
  function removeRef(i: number) {
    set(
      "improvementPlanRefs",
      draft.improvementPlanRefs.filter((_, j) => j !== i),
    );
  }

  function toggleDomain(dom: string) {
    const has = draft.trackedDomains.includes(dom);
    set(
      "trackedDomains",
      has ? draft.trackedDomains.filter((d) => d !== dom) : [...draft.trackedDomains, dom],
    );
  }

  function save() {
    const clean: Settings = {
      ...draft,
      improvementPlanRefs: draft.improvementPlanRefs.filter((r) => r.role.trim() && r.code.trim()),
    };
    updateSettings(clean);
    setDraft(clean);
    setSaved(true);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <SectionHeading
        title="Settings"
        blurb="School identity and improvement-plan references. Stored on this device only."
      />

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-graphite">School identity</h2>
        <div>
          <label className={labelCls} htmlFor="schoolName">
            School name
          </label>
          <input
            id="schoolName"
            className={inputCls}
            value={draft.schoolName}
            placeholder="e.g. Example Secondary College"
            onChange={(e) => set("schoolName", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls} htmlFor="schoolNumber">
              School number (optional)
            </label>
            <input
              id="schoolNumber"
              className={inputCls}
              value={draft.schoolNumber ?? ""}
              onChange={(e) => set("schoolNumber", e.target.value || undefined)}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="planLabel">
              Plan label (optional)
            </label>
            <input
              id="planLabel"
              className={inputCls}
              value={draft.planLabel ?? ""}
              placeholder="e.g. AIP"
              onChange={(e) => set("planLabel", e.target.value || undefined)}
            />
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-graphite">Tracked domains</h2>
          <p className="text-xs text-graphite/60">
            Domains the year-on-year and recommendation focus tracks.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {VALID_DOMAINS.map((dom) => {
            const on = draft.trackedDomains.includes(dom);
            return (
              <button
                key={dom}
                type="button"
                onClick={() => toggleDomain(dom)}
                className={
                  "rounded-full px-3 py-1 text-sm transition " +
                  (on
                    ? "bg-coral text-white"
                    : "border border-alabaster bg-white text-graphite/70 hover:border-coral/40")
                }
              >
                {dom}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-graphite">Improvement-plan references</h2>
            <p className="text-xs text-graphite/60">
              Cited in the narrative, e.g. role “data-inquiry”, code “KIS 1.b”.
            </p>
          </div>
          <button
            type="button"
            onClick={addRef}
            className="inline-flex items-center gap-1 rounded-lg border border-alabaster bg-white px-3 py-1.5 text-sm text-graphite hover:border-coral/40"
          >
            <PlusIcon className="h-4 w-4" /> Add
          </button>
        </div>
        {draft.improvementPlanRefs.length === 0 && (
          <p className="text-sm text-graphite/50">None yet.</p>
        )}
        <div className="space-y-3">
          {draft.improvementPlanRefs.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1.4fr_auto] items-end gap-2">
              <div>
                <label className="text-xs text-graphite/60">Role</label>
                <input
                  className={inputCls}
                  value={r.role}
                  placeholder="data-inquiry"
                  onChange={(e) => setRef(i, { role: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-graphite/60">Code</label>
                <input
                  className={inputCls}
                  value={r.code}
                  placeholder="KIS 1.b"
                  onChange={(e) => setRef(i, { code: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-graphite/60">Description (optional)</label>
                <input
                  className={inputCls}
                  value={r.description ?? ""}
                  onChange={(e) => setRef(i, { description: e.target.value || undefined })}
                />
              </div>
              <button
                type="button"
                onClick={() => removeRef(i)}
                className="mb-1 rounded-lg p-2 text-graphite/40 hover:bg-coral/10 hover:text-coral-text"
                aria-label="Remove reference"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          className="rounded-xl bg-coral px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-coral-dark"
        >
          Save settings
        </button>
        {saved && <span className="text-sm text-sage-text">Saved.</span>}
      </div>
    </div>
  );
}
