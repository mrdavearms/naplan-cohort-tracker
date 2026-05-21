/**
 * Small shared UI primitives in the Curriculum Planner design language
 * (hand-rolled Tailwind, not shadcn). rounded-2xl cards, coral CTAs, the ink
 * opacity ladder for hierarchy.
 */
import type { ReactNode } from "react";
import clsx from "clsx";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-alabaster bg-white/70 p-6 shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  number,
  title,
  blurb,
}: {
  number?: number | null;
  title: string;
  blurb?: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-graphite">
        {number != null && <span className="text-coral-text">Section {number}. </span>}
        {title}
      </h1>
      {blurb && <p className="mt-1 text-sm text-graphite/60">{blurb}</p>}
    </div>
  );
}

export function StatTile({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl border border-alabaster bg-linen/60 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-graphite/50">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-graphite">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-graphite/60">{sub}</div>}
    </div>
  );
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "coral" | "sage" | "tuscan" }) {
  const tones: Record<string, string> = {
    neutral: "bg-alabaster/60 text-graphite/70",
    coral: "bg-coral/10 text-coral-text",
    sage: "bg-sage-bg text-sage-text",
    tuscan: "bg-tuscan/30 text-graphite",
  };
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Card className="text-center">
      <h2 className="text-lg font-semibold text-graphite">{title}</h2>
      {children && <div className="mt-2 text-sm text-graphite/60">{children}</div>}
    </Card>
  );
}

export function PrivacyNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 rounded-lg bg-tuscan/15 px-3 py-2 text-xs text-graphite/70">{children}</p>
  );
}
