/**
 * About — what the app does, the files it needs, who made it, how to get help,
 * and the disclaimer. Static content (shares appMeta with the import screen);
 * the version is read from the native shell when running under Tauri.
 */
import { useEffect, useState } from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Card, SectionHeading } from "../components/ui";
import { isTauri } from "../lib/dataSource";
import { appInfo } from "../lib/tauriFs";
import { APP_NAME, CONTACT_EMAIL, DEVELOPER, DISCLAIMER, GITHUB_URL } from "../appMeta";

export function AboutView() {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri()) return; // appInfo() is a native command; skip in browser dev
    appInfo()
      .then((i) => setVersion(i.version))
      .catch(() => setVersion(null));
  }, []);

  return (
    <div className="space-y-6">
      <SectionHeading title={`About ${APP_NAME}`} blurb={version ? `Version ${version}` : undefined} />

      <Card>
        <h2 className="text-lg font-semibold text-graphite">What this app does</h2>
        <p className="mt-2 text-sm text-graphite/80">
          {APP_NAME} analyses your school’s NAPLAN <strong>Preliminary</strong> results. Each
          year ACARA (the Australian Curriculum, Assessment and Reporting Authority) releases a
          preliminary Student and School Summary Report (SSSR), usually during Term 2. The
          preliminary SSSR gives schools the School (IDA) Report, Class Summary Report, Class
          Test Report, Student Reports and proficiency-standard information. This app reads those
          files and surfaces participation, proficiency, equity and skill gaps — and, as the
          headline, tracks the same students from Year 7 to Year 9 (your school’s value-add).
          Everything runs on your device; no student data leaves the machine.
        </p>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-graphite">Which files you need</h2>
        <p className="mt-2 text-sm text-graphite/80">
          Add all the files from the <strong>SSSR Preliminary reports</strong> — for your current
          Year 9s, and the same students’ Year 7 files from two years earlier — across every
          domain (Reading, Numeracy, Spelling, Grammar and Punctuation) and both year levels. The
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
            <dt className="font-medium text-graphite">Project on GitHub:</dt>
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
