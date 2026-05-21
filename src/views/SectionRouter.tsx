/**
 * Routes the active section id to its view. Sections are filled in
 * incrementally; not-yet-built ones render a neutral placeholder.
 */
import { useApp } from "../state/AppState";
import { SECTION_BY_ID } from "./sections";
import { SectionHeading, EmptyState } from "../components/ui";

export function SectionRouter() {
  const { state } = useApp();
  const meta = SECTION_BY_ID[state.activeView];
  if (!meta) return null;

  return (
    <div>
      <SectionHeading number={meta.number} title={meta.title} blurb={meta.blurb} />
      <EmptyState title="This section is being built">
        The analysis for “{meta.title}” is ported and tested in the core library; its on-screen view
        is coming next.
      </EmptyState>
    </div>
  );
}
