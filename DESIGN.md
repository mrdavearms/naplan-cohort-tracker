# NAPLAN Cohort Tracker — design system

The UI follows the **Curriculum Planner design system** (Dave's existing app), so
NAPLAN Cohort Tracker feels like part of the same family. Tokens below are lifted
verbatim from `Curriculum-Planner/apps/frontend/src/index.css` (Tailwind v4
`@theme`), confirmed against the shared design template.

Stack: **Tailwind CSS v4** (`@import "tailwindcss"` + `@theme`). Charts: Plotly.js.
Icons: **Heroicons** (outline, 1.5px stroke).

## Fonts

| Role | Family |
|---|---|
| Body (`--font-sans`) | **Inter** (system fallback stack) |
| Headings (`--font-serif`, h1–h3) | **Roboto Slab** |
| Display (`--font-display`) | **Syne** (800, used with the shimmer effect) |

> Phase 5 PDF: bundle these TTFs and set Plotly `font.family` to Inter for
> cross-engine consistency (WebView2 vs WebKit). For v1 dev they load from Google Fonts.

## Colour tokens

| Token | Hex | Use |
|---|---|---|
| `linen` | `#e8eddf` | page background |
| `alabaster` | `#cfdbd5` | secondary surface |
| `graphite` | `#333533` | primary text |
| `graphite-light` | `#444644` | secondary text |
| `coral` | `#ff7247` | primary accent / CTA |
| `coral-dark` | `#e5623d` | CTA hover |
| `coral-text` | `#c4502b` | accent text on light |
| `tuscan` | `#f5cb5c` | highlight / marks |
| `tuscan-dark` | `#e0b84e` | highlight hover |
| `sage` | `#8aa67a` | success/positive |
| `sage-bg` | `#eaefdf` | success surface |
| `sage-text` | `#4f6b46` | success text |

Base: `body { background: linen; color: graphite; }`, antialiased.

### Status / proficiency note
Charts keep the **proficiency palette** from the analysis core
(`core/src/charts/palette.ts`: NAS `#D62728`, Developing `#FF9F1C`,
Strong `#7FB069`, Exceeding `#2E7D32`) — those are data-encoding colours and are
intentionally distinct from the brand palette above.

## Effects / brand

- **Hero shimmer**: gradient text `graphite → coral → tuscan → graphite`, 300%
  background, 8s ease-in-out loop (`.hero-shimmer`). Used on the display heading.
- **fade-in**: `opacity 0→1` + `translateY(10px→0)`, 0.5s ease-out.
- **Hero texture**: dot-grid, 28px, ~8% opacity.
- **Spinner**: coral ring, transparent top, 1s linear spin.
- **Logo**: "AI" monogram lockup (graphite circle + coral ring + slab serif).
  NAPLAN Cohort Tracker can reuse the monogram or get its own neutral mark.

## Components (patterns to mirror, from the design template)

- **Buttons**: primary (coral), secondary, ghost, disabled.
- **Cards**: resting + hover ("step card") states; rounded-2xl; soft elevation.
- **Form inputs**: label, input, select, error state.
- **Pills/badges**: new, quota, code, tuscan mark.
- **Radii**: sm → 2xl + pill. **Spacing**: 4px base scale (1–16).
- **Ink opacity ladder**: graphite at 100/80/60/50/30%.

## Component approach

Curriculum Planner uses **hand-rolled Tailwind components** (not shadcn/ui).
Phase 4 mirrors that — bespoke Tailwind v4 components in this palette — rather
than pulling in shadcn, so the look matches exactly. (Revisit if we want shadcn
primitives later.)
