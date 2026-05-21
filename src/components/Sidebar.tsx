/**
 * Left sidebar: brand mark + Sections 1–10 nav + Settings. Section 10 (cohort
 * tracking — the headline value-add) is visually separated and marked.
 */
import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useApp, type ViewId } from "../state/AppState";
import { SECTIONS } from "../views/sections";

function NavButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition",
        active
          ? "bg-coral/10 font-medium text-coral-text"
          : "text-graphite/70 hover:bg-alabaster/50 hover:text-graphite",
      )}
    >
      {children}
    </button>
  );
}

export function Sidebar() {
  const { state, setView } = useApp();
  const active = state.activeView;
  const loaded = state.status === "loaded";

  const go = (id: ViewId) => setView(id);

  return (
    <nav className="flex h-full w-64 shrink-0 flex-col border-r border-alabaster bg-white/50 backdrop-blur-sm">
      <button
        type="button"
        onClick={() => go("home")}
        className="flex items-center gap-3 px-5 py-5 text-left"
      >
        <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-coral bg-graphite font-serif text-sm font-bold text-linen">
          NT
        </span>
        <span className="font-display text-lg font-extrabold leading-tight text-graphite">
          Naplan
          <br />
          Throughline
        </span>
      </button>

      <div className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        <NavButton active={active === "home"} onClick={() => go("home")}>
          <span className="w-5 text-center text-xs text-graphite/40">⌂</span>
          Home
        </NavButton>

        <div className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-graphite/40">
          Sections
        </div>
        {SECTIONS.filter((s) => s.number !== 10).map((s) => (
          <NavButton
            key={s.id}
            active={active === s.id}
            onClick={() => loaded && go(s.id)}
          >
            <span className="w-5 text-center text-xs font-semibold text-graphite/40">{s.number}</span>
            <span className={clsx(!loaded && "opacity-40")}>{s.title}</span>
          </NavButton>
        ))}

        <div className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-graphite/40">
          Value-add
        </div>
        <NavButton active={active === "s10"} onClick={() => loaded && go("s10")}>
          <span className="w-5 text-center text-xs font-semibold text-coral-text">10</span>
          <span className={clsx(!loaded && "opacity-40")}>Cohort tracking</span>
        </NavButton>
      </div>

      <div className="border-t border-alabaster px-3 py-3">
        <NavButton active={active === "settings"} onClick={() => go("settings")}>
          <Cog6ToothIcon className="h-5 w-5 text-graphite/50" />
          Settings
        </NavButton>
      </div>
    </nav>
  );
}
