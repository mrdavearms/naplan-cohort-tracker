/**
 * Section 9 — Narrative. A rules-based leadership narrative for the primary
 * year, generated from the loaded data plus the school's settings (identity +
 * improvement-plan references). This is whole-school prose, not a single year
 * level, so there are no Year 7 / Year 9 scope tabs here. The draft is a
 * starting point to support — never replace — professional judgement; NAPLAN
 * is diagnostic evidence, not a target-measurement instrument.
 */
import {
  buildSchoolNarrative,
  storeEntries,
  type NarrativeContext,
} from "@naplan-cohort-tracker/core";
import { useApp } from "../../state/AppState";
import { Card, SectionHeading } from "../../components/ui";

/** A titled card holding a bullet list. Rendered only when items are present. */
function NarrativeCard({
  title,
  items,
  accent,
  note,
}: {
  title: string;
  items: string[];
  accent: "sage" | "coral" | "neutral";
  note?: string;
}) {
  if (items.length === 0) return null;
  const bar =
    accent === "sage" ? "bg-sage" : accent === "coral" ? "bg-coral" : "bg-alabaster";
  return (
    <Card>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-graphite">
        <span className={`inline-block h-3 w-1 rounded-full ${bar}`} aria-hidden />
        {title}
      </h2>
      {note && <p className="mt-1 text-xs text-graphite/60">{note}</p>}
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-graphite/80">
        {items.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </Card>
  );
}

export function S9Narrative() {
  const { state, setView } = useApp();
  const store = state.store;
  const primaryYear = state.primaryYear!;
  const settings = state.settings;

  const ctx: NarrativeContext = {
    schoolName: settings.schoolName || "This school",
    schoolNumber: settings.schoolNumber,
    primaryYear,
    planLabel: settings.planLabel,
    planReferences: settings.improvementPlanRefs,
    trackedDomains: settings.trackedDomains,
  };

  const narrative = buildSchoolNarrative(storeEntries(store), ctx);

  return (
    <div>
      <SectionHeading
        number={9}
        title="Narrative"
        blurb={`A rules-based leadership narrative — ${primaryYear}, whole school.`}
      />

      {!settings.schoolName && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-alabaster bg-linen/50 px-4 py-3 text-sm text-graphite/70">
          <span>Set your school name in Settings to personalise this narrative.</span>
          <button
            type="button"
            onClick={() => setView("settings")}
            className="rounded-lg border border-alabaster bg-white px-3 py-1.5 text-sm font-medium text-graphite hover:border-coral/40"
          >
            Open Settings
          </button>
        </div>
      )}

      <p className="mb-6 rounded-lg border border-alabaster bg-linen/50 px-3 py-2 text-xs text-graphite/70">
        This is an automatically drafted, rules-based summary to support — not replace —
        professional judgement. NAPLAN is diagnostic evidence to inform improvement
        planning, not a target-measurement instrument.
      </p>

      <div className="space-y-6">
        <Card>
          <h1 className="text-xl font-bold text-graphite">{narrative.heading}</h1>
          <p className="mt-3 text-sm leading-relaxed text-graphite/80">{narrative.overall}</p>
        </Card>

        <NarrativeCard title="Strengths" items={narrative.strengths} accent="sage" />
        <NarrativeCard title="Concerns" items={narrative.concerns} accent="coral" />
        <NarrativeCard
          title="Year-on-year"
          items={narrative.yearOnYear}
          accent="neutral"
          note="Year 7 lines reflect different feeder cohorts each year (primary-school output, not this school's teaching); Year 9 lines reflect the secondary school's contribution."
        />
        <NarrativeCard
          title="Recommendations"
          items={narrative.recommendations}
          accent="neutral"
        />
      </div>
    </div>
  );
}
