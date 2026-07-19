# Changelog

All notable changes to NAPLAN Cohort Tracker. Dates are when the version was
tagged for release. The app is on-device only — every version keeps student data
on your machine and shows Local Student IDs, never names.

## 1.3.0 — 2026-07-19

### Fixed
- Blank Local Student IDs are now treated as missing rather than as a join key, so
  students without a school ID can no longer be incorrectly matched to each other.
- Files with unrecognised proficiency wording are rejected with a clear message
  instead of silently reporting zero students needing support.
- Duplicate spreadsheets covering the same year, year level and domain are now
  reported instead of silently overwriting one another.
- Every equity subgroup below 5 students is suppressed, not just the Aboriginal
  and Torres Strait Islander count.
- A failed re-import no longer clears the analysis you already had loaded.
- PDF export now fails with a message instead of hanging on "Generating…".
- Settings that could not be saved now say so instead of reporting success.
- "Check for updates" in Settings now asks before restarting the app.
- Year 7 results at combined P–12 schools are no longer described as feeder-school
  intake.
- The improvement-plan target suggestion is now derived from the cohort's own
  result rather than a fixed range, and names the correct planning year.
- Class-group commentary no longer assumes classes are streamed.

### Added
- Save the Section 8 targeted-support list as a CSV.
- The targeted-support list now appears in the overview PDF.
- Copy the Section 9 narrative as plain text for planning documents.
- Sections 1, 2, 6 and 7 open with a plain-English takeaway sentence.
- Progress is shown while importing files and while generating a PDF.
- The diagnostics export names the app's log folder for reporting problems.

### Changed
- The app starts faster: charts and the PDF engine now load only when needed.
- Statistical language in Section 10 is glossed in plain English.

## 1.2.1 — Readable chart labels

A display fix, in response to user feedback. Nothing about your data or analysis
changes.

- **Left-hand chart labels are no longer cut off.** On the proficiency charts the
  row labels down the left (class group names and similar) were being clipped to
  just the last character or two. Every horizontal chart now resizes its left
  margin to fit its labels in full — on screen and in the exported PDF. This also
  covers the Section 10 confidence-interval plot and the transition heatmap, where
  longer labels (e.g. "Needs additional support") could clip.

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
