# Changelog

All notable changes to NAPLAN Cohort Tracker. Dates are when the version was
tagged for release. The app is on-device only — every version keeps student data
on your machine and shows Local Student IDs, never names.

## 1.2.0 — Counts and follow-up clarity

Section 10 (cohort tracking) is easier to read and act on. Nothing about your
data handling changes — these are clearer numbers and new follow-up views.

- **Student counts beside every percentage.** Each NAS / Meeting+ percentage and
  every change now shows the students behind it, e.g. *"−8.5 pp · 6 fewer at
  Needs additional support"* — so a figure on a small cohort is never read in
  isolation.
- **Baseline-composition note under attrition.** A plain-English line says how the
  tracked (stayers) group's entry-year make-up compares with the full entry
  cohort. It describes composition only — it is explicitly *not* a "corrected"
  headline, because the students who left have no Year 9 result to know.
- **Detectability note.** Beside the significance test, a line states the honest
  floor: for your cohort size, the smallest change that could *possibly* be
  statistically significant — small cohorts can't reach it even in the best case,
  and the app says so rather than implying false certainty.
- **"Students who improved" list.** A recognition list (with classes) mirroring
  the follow-up list — for celebrating gains and spotting which classes or
  interventions the improvers shared.
- **Follow-up across domains.** One table gathers students who declined or stalled
  in two or more subjects — flagged as the clearest intervention priority.
- **Joiners analysis.** Shows where students who joined after the entry year stand
  at exit, compared with the stayers — the mirror of the leavers view.

Items 1-2, 1-3 and 1-5 also appear in the exported cohort PDF.

## 1.1.x — 1.0.0

- 1.0.0 (May 2026) — first public release: macOS + Windows installers on the
  auto-update feed, Sections 1–10, primary (Year 3 → 5), secondary (Year 7 → 9)
  and combined P–12 (incl. Year 5 → 7) cohort tracking, on-device PDF reports.
- 1.0.1 – 1.1.1 — primary-analysis polish, download-page and in-app early-release
  wording, version/build-stamp fixes.
