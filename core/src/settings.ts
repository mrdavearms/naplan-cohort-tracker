/**
 * App settings — versioned from the first write so a future update can never
 * silently wipe a principal's saved school identity (early-foundations #8).
 *
 * This module is pure: the `migrate()` + defaults live here in `core/` and are
 * unit-tested; the persistence adapter (localStorage in browser dev, Tauri
 * store/fs in the shell) lives in the UI layer and calls `migrate()` on read.
 *
 * SCHOOL IDENTITY IS DATA, NEVER CODE. No school name/number/plan reference is
 * hard-coded anywhere — it all lives in this settings object.
 */

export const SETTINGS_SCHEMA_VERSION = 1 as const;

/** One improvement-plan reference (AIP/KIS) the narrative can cite. */
export interface ImprovementPlanRef {
  /** Where the narrative cites this, e.g. "data-inquiry" or "at-risk-students". */
  role: string;
  /** The school's own code/label, e.g. "KIS 1.b". */
  code: string;
  /** Optional human description. */
  description?: string;
}

/** Settings schema v1. All fields optional except the version + name (which
 *  defaults to "" so a blank install renders neutral, non-WHS branding). */
export interface SettingsV1 {
  schemaVersion: 1;
  schoolName: string;
  schoolNumber?: string;
  /** Framework label used in prose, e.g. "AIP". Defaults to "improvement plan". */
  planLabel?: string;
  improvementPlanRefs: ImprovementPlanRef[];
  /** Domains the year-on-year + recommendation focus tracks. */
  trackedDomains: string[];
}

/** The current settings shape (alias bumped when the schema version bumps). */
export type Settings = SettingsV1;

/** Neutral defaults — a fresh, blank-settings install shows no school identity. */
export function defaultSettings(): Settings {
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    schoolName: "",
    schoolNumber: undefined,
    planLabel: undefined,
    improvementPlanRefs: [],
    trackedDomains: ["Reading", "Numeracy"],
  };
}

/**
 * Coerce arbitrary persisted data into the current Settings shape. Unknown or
 * missing fields fall back to defaults; future schema versions add cases here.
 * Never throws — bad data degrades to defaults rather than wiping the app.
 */
export function migrate(raw: unknown): Settings {
  const d = defaultSettings();
  if (raw == null || typeof raw !== "object") return d;
  const r = raw as Record<string, unknown>;

  // schemaVersion 1 (and unversioned legacy blobs) map onto v1 directly.
  const schoolName = typeof r["schoolName"] === "string" ? r["schoolName"] : d.schoolName;
  const schoolNumber = typeof r["schoolNumber"] === "string" ? r["schoolNumber"] : undefined;
  const planLabel = typeof r["planLabel"] === "string" ? r["planLabel"] : undefined;

  const refs = Array.isArray(r["improvementPlanRefs"])
    ? r["improvementPlanRefs"].flatMap((x): ImprovementPlanRef[] => {
        if (x == null || typeof x !== "object") return [];
        const o = x as Record<string, unknown>;
        if (typeof o["role"] !== "string" || typeof o["code"] !== "string") return [];
        const ref: ImprovementPlanRef = { role: o["role"], code: o["code"] };
        if (typeof o["description"] === "string") ref.description = o["description"];
        return [ref];
      })
    : d.improvementPlanRefs;

  const trackedDomains =
    Array.isArray(r["trackedDomains"]) && r["trackedDomains"].every((x) => typeof x === "string")
      ? (r["trackedDomains"] as string[])
      : d.trackedDomains;

  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    schoolName,
    schoolNumber,
    planLabel,
    improvementPlanRefs: refs,
    trackedDomains,
  };
}
