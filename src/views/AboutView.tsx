/**
 * About — what the app does, the files it needs, who made it, how to get help,
 * and the disclaimer. Static content (shares appMeta with the import screen).
 * The version/build stamp is baked in at build time (see src/buildInfo.ts).
 */
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Card, SectionHeading } from "../components/ui";
import { BUILD_INFO, BUILD_STAMP } from "../buildInfo";
import { APP_NAME, CONTACT_EMAIL, DEVELOPER, DISCLAIMER, GITHUB_URL } from "../appMeta";

export function AboutView() {
  return (
    <div className="space-y-6">
      <SectionHeading title={`About ${APP_NAME}`} blurb={`Version ${BUILD_INFO.version}`} />

      <Card>
        <h2 className="text-lg font-semibold text-graphite">Version</h2>
        <p className="mt-1 select-all font-mono text-base text-graphite">{BUILD_STAMP}</p>
        <p className="mt-1 text-xs text-graphite/55">
          Version {BUILD_INFO.version}, build {BUILD_INFO.commit}, built {BUILD_INFO.builtAt}. Quote
          this when reporting a problem.
        </p>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-graphite">What this app does</h2>
        <p className="mt-2 text-sm text-graphite/80">
          {APP_NAME} analyses your school’s NAPLAN <strong>Preliminary</strong> results. Each
          year ACARA (the Australian Curriculum, Assessment and Reporting Authority) releases a
          preliminary Student and School Summary Report (SSSR), usually during Term 2. The
          preliminary SSSR gives schools the School (IDA) Report, Class Summary Report, Class
          Test Report, Student Reports and proficiency-standard information. This app reads those
          files and surfaces participation, proficiency, equity and skill gaps — and, as the
          headline, tracks the same students across two years (Year 3 to Year 5 for a primary
          school, Year 7 to Year 9 for a secondary school, or Year 5 to Year 7 in a combined
          P–12 school — your school’s value-add).
          Everything runs on your device; no student data leaves the machine.
        </p>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-graphite">Which files you need</h2>
        <p className="mt-2 text-sm text-graphite/80">
          Add all the files from the <strong>SSSR Preliminary reports</strong> — for your current
          exit year (Year 5 or Year 9), and the same students’ entry-year files (Year 3 or Year 7)
          from two years earlier — across every domain (Reading, Numeracy, Spelling, Grammar and
          Punctuation) and both year levels. The
          files for each year can sit in different folders; add each folder, or pick the files
          directly, on the home screen.
        </p>
        <p className="mt-3 text-sm text-graphite/80">
          <strong>Where to get them:</strong> Principals download the data from the national
          assessment platform (Assessform). Log in to the NAPLAN portal for the year you need,
          using the same credentials your school used for the March test, then download the SSSR
          Preliminary report files.
        </p>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-graphite">Who made it &amp; getting help</h2>
        <p className="mt-2 text-sm text-graphite/80">
          Developed by {DEVELOPER}.
        </p>
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-medium text-graphite">Report problems, issues or feature requests:</dt>
            <dd>
              <a className="text-coral-text underline" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-medium text-graphite">Downloads &amp; project page:</dt>
            <dd>
              <a className="text-coral-text underline" href={GITHUB_URL} target="_blank" rel="noreferrer">
                {GITHUB_URL}
              </a>
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="border-tuscan/60 bg-tuscan/10">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-graphite">
          <ExclamationTriangleIcon className="h-5 w-5 text-tuscan-dark" />
          Important — please read
        </h2>
        <p className="mt-2 text-sm text-graphite/80">{DISCLAIMER}</p>
      </Card>
    </div>
  );
}
