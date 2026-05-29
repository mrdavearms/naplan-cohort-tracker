/**
 * App-level facts shown in the UI (import on-ramp + About) so they stay
 * consistent in one place. Plain content only — no logic.
 */

export const APP_NAME = "NAPLAN Cohort Tracker";

/** Public download & info page (GitHub Pages). The source repo is private. */
export const GITHUB_URL = "https://mrdavearms.github.io/naplan-cohort-tracker-releases/";

export const DEVELOPER = "Dave Armstrong, a Victorian school Principal";

/** Address for problems, issues and feature requests. */
export const CONTACT_EMAIL = "dave.armstrong@education.vic.gov.au";

/** Strong disclaimer — shown on the front page and in About. */
export const DISCLAIMER =
  "This app has been produced with care, but it is a support tool — not an official " +
  "source of truth. Every figure, chart and report it produces should be checked " +
  "carefully by an experienced staff member before it is relied on or shared.";

/* Early-release ("beta") status. v1.x is shipped but still under active testing,
   so the app says so up front: a pill in the top bar, a one-line strip under it,
   and a fuller explanation on the import on-ramp. Copy lives here so it stays
   consistent across all three. */

/** Short label for the top-bar pill. */
export const BETA_LABEL = "Beta";

/** Strip body — follows a bold "Early release —" in the banner under the top bar. */
export const BETA_STRIP_BODY =
  "this app may not work perfectly yet. Feedback is very welcome:";

/** Heading for the fuller explanation card on the import screen. */
export const BETA_HEADING = "Early release — may not work properly";

export const BETA_BODY_1 =
  `${APP_NAME} is an early release. It is still being tested, so some figures or ` +
  "screens may not work as expected. Please check anything important against the " +
  "source spreadsheets before you rely on it.";

/** Card's second paragraph — followed by the contact email as a link. */
export const BETA_BODY_2_PREFIX =
  "Your feedback is genuinely welcome — if something looks wrong, confusing, or could " +
  "be better, please email";
