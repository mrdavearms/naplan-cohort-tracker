# NAPLAN Cohort Tracker — user guide

A one-page guide for school leaders. No technical knowledge needed.

## What it does

NAPLAN Cohort Tracker reads your school's NAPLAN SSSR Extract files and shows you,
on your own computer, what they mean: who sat the tests, the proficiency mix,
where the gaps are, equity, and — most importantly — how the **same students**
progressed from Year 7 to Year 9 (the school's value-add).

**Everything stays on your machine.** No student data is ever sent anywhere.
No student names appear on screen or in any report — only Local Student IDs.

## Getting your data ready

1. Put your NAPLAN files in a folder, with one sub-folder per year named like
   **`Naplan 2024`**, **`Naplan 2025`**, **`Naplan 2026`**.
2. Inside each year folder, drop the **SSSR Extract** spreadsheets (`.xlsx`).
   The app uses the *Student Reports* and *Student Results Table* sheets and
   ignores the rest (the *School Item Report* and *Writing* files are skipped
   automatically — that's normal).

> Tracking the same students from Year 7 to Year 9 needs **both** a Year 7 file
> from two years earlier **and** a Year 9 file. For example, a 2026 Year 9
> cohort is matched against the 2024 Year 7 file.

## Using the app

1. Open **NAPLAN Cohort Tracker**.
2. Click **Choose your NAPLAN folder** and select the folder from step 1.
3. The app loads everything and shows an **Overview**. The coloured banner tells
   you how many students it matched across Year 7 → Year 9, for example
   *"Matched 73 of 92 Year 9 students back to their Year 7 record (79%)"*.
   - A **low** match rate (banner turns orange) usually means the Local Student
     IDs don't line up across the two files — check you've got the right
     cohort's files.
4. Use the left sidebar to move through **Sections 1–10**:
   - **1 Participation, 2 Proficiency, 3 Year-on-year, 4 Cross-domain,
     5 Skill gaps, 6 Equity, 7 Class groups, 8 Targeted support, 9 Narrative.**
   - **10 Cohort tracking** is the headline — the same students, Year 7 → Year 9.
5. Use the **Latest year** selector (top right) to choose which exit-year cohort
   to analyse (e.g. your most recent Year 9 group).

### What Section 10 shows you

Section 10 follows the *same students* across two years, so it's the closest
thing to a measure of your school's own contribution. Reading it:

- **Every percentage shows the number of students behind it** — so a change reads
  as *"−8.5 pp · 6 fewer students at 'Needs additional support'"*, not just a
  percentage that can look dramatic on a small group.
- **A plain-English "detectability" line** tells you whether a change is even
  large enough to be statistically meaningful for your cohort size — small
  cohorts simply can't reach significance, and the app says so honestly rather
  than implying a result is solid when it isn't.
- **A "students who improved" list** (Local Student IDs, never names) sits
  alongside the follow-up list — for recognising gains and spotting which
  classes or supports the improvers shared.
- **A "follow-up across domains" table** gathers the students who slipped or
  stalled in *more than one* subject — your clearest intervention priority.
- **Who left and who joined** the cohort is laid out plainly, including a note on
  how the students who left shaped the headline (it describes the make-up of the
  tracked group; it is never presented as a "corrected" result).

### A note on Year 7 vs Year 9

NAPLAN is sat in Term 1. **Year 7 results reflect primary-school learning**, not
your school's teaching — treat them as intake. **Year 9 reflects your school's
contribution.** The app labels this throughout so the numbers aren't misread.

## Saving reports

- On the **Overview** screen, click **Export overview PDF** (Sections 1–9).
- On **Section 10**, click **Export cohort PDF** (the Year 7 → Year 9 deep-dive).

Reports contain no student names — Local Student IDs only.

## Settings

Open **Settings** (bottom of the sidebar) to enter your **school name**, school
number, and any improvement-plan references (e.g. AIP / KIS codes). These appear
in the narrative sections and reports. Nothing here is built into the app — a
fresh install is blank and neutral until you fill it in.

## If something looks wrong

- **"No NAPLAN files could be loaded"** — check the folder has `.xlsx` files
  inside year sub-folders named `Naplan YYYY`.
- **Files listed as "not loaded"** — the *School Item Report* and *Writing*
  files are skipped on purpose; anything else with a reason is shown so you can
  check it.
- **Low match rate** — the two years' files may be for different cohorts, or the
  Local Student IDs differ.
- Still stuck? In **Settings → Diagnostics & updates**, click **Export
  diagnostics** and send that file (it contains no student data) for support.
