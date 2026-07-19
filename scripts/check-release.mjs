#!/usr/bin/env node
// Release preflight: catch the version-drift footgun before it ships.
//
// The app version lives in FOUR places that must always agree, or the
// auto-updater ships a build whose advertised version doesn't match its
// installer — a silent, hard-to-diagnose break for users:
//   1. src-tauri/tauri.conf.json   (authoritative — drives the bundle + updater)
//   2. src-tauri/Cargo.toml        ([package] version)
//   3. package.json
//   4. src-tauri/Cargo.lock        (the `app` package entry; synced by `cargo check`)
//
// Two modes:
//   node scripts/check-release.mjs            -> assert the four fields agree
//                                                (+ warn if no CHANGELOG entry).
//                                                CI-safe; runs on every push.
//   node scripts/check-release.mjs v1.3.0     -> additionally assert the tag
//                                                matches, and REQUIRE a CHANGELOG
//                                                entry. Used as the mirror-release
//                                                preflight.
//
// Exit code is non-zero on any error so it can gate CI and the mirror script.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const errors = [];
const warnings = [];

// ── Gather the four version fields ───────────────────────────────────────────
function packageJsonVersion() {
  return JSON.parse(read("package.json")).version ?? null;
}
function tauriConfVersion() {
  return JSON.parse(read("src-tauri/tauri.conf.json")).version ?? null;
}
function cargoTomlVersion() {
  // First `version = "..."` after the [package] header (before any deps table).
  const m = read("src-tauri/Cargo.toml").match(
    /\[package\][\s\S]*?\nversion\s*=\s*"([^"]+)"/,
  );
  return m ? m[1] : null;
}
function cargoLockAppVersion() {
  // The `app` package block: name = "app" immediately followed by version.
  const m = read("src-tauri/Cargo.lock").match(
    /name\s*=\s*"app"\s*\nversion\s*=\s*"([^"]+)"/,
  );
  return m ? m[1] : null;
}

const fields = [
  ["package.json", packageJsonVersion],
  ["src-tauri/tauri.conf.json", tauriConfVersion],
  ["src-tauri/Cargo.toml", cargoTomlVersion],
  ["src-tauri/Cargo.lock (app)", cargoLockAppVersion],
];

const found = fields.map(([label, fn]) => {
  try {
    return [label, fn()];
  } catch (e) {
    errors.push(`Could not read ${label}: ${e.message}`);
    return [label, null];
  }
});

console.log("NAPLAN Cohort Tracker — release preflight\n");
console.log("Version fields:");
const pad = Math.max(...found.map(([l]) => l.length));
for (const [label, value] of found) {
  console.log(`  ${label.padEnd(pad)}  ${value ?? "(not found)"}`);
}

const values = found.map(([, v]) => v);
const missing = found.filter(([, v]) => v == null).map(([l]) => l);
const unique = [...new Set(values.filter((v) => v != null))];

if (missing.length) {
  errors.push(`Version not found in: ${missing.join(", ")}`);
}
if (unique.length > 1) {
  errors.push(
    `Version fields disagree (${unique.join(" vs ")}).\n` +
      "       Set all four to the same version (tauri.conf.json is authoritative),\n" +
      "       then run `cd src-tauri && cargo check` to sync Cargo.lock.",
  );
}

const version = unique.length === 1 ? unique[0] : null;
if (version) console.log(`  -> all four match: ${version}`);

// ── CHANGELOG entry ──────────────────────────────────────────────────────────
const tagArg = process.argv[2];
const releaseMode = Boolean(tagArg);

if (version) {
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hasEntry = new RegExp(`^##\\s+${escaped}\\b`, "m").test(
    read("CHANGELOG.md"),
  );
  if (hasEntry) {
    console.log(`\nCHANGELOG.md: entry for ${version} found.`);
  } else {
    const msg = `CHANGELOG.md has no "## ${version}" entry — add the release notes.`;
    if (releaseMode) errors.push(msg);
    else warnings.push(msg);
  }
}

// ── Tag match (release mode only) ────────────────────────────────────────────
if (releaseMode) {
  const tagVersion = tagArg.replace(/^v/, "");
  console.log(`\nTag check: ${tagArg} -> ${tagVersion}`);
  if (version && tagVersion !== version) {
    errors.push(
      `Tag version ${tagVersion} does not match the committed version ${version}.\n` +
        "       Bump the version fields (or fix the tag) so they agree before mirroring.",
    );
  }

  // The teacher-facing "What's new in X" copy is hardcoded in THREE places in
  // mirror-release.sh (release NOTES, the HTML download page, the README).
  // Mirroring without updating it publishes the previous release's copy under
  // the new version number — invisible to every other check.
  const mirror = read("scripts/mirror-release.sh");
  const whatsNewCount = (mirror.match(/What's new in/g) ?? []).length;
  if (whatsNewCount !== 3) {
    warnings.push(
      `scripts/mirror-release.sh has ${whatsNewCount} "What's new in" blocks, expected 3 ` +
        `(release NOTES, HTML download page, README). If the script was restructured, update ` +
        `this check in scripts/check-release.mjs.`,
    );
  }
  if (!mirror.includes(`RELEASE_COPY_VERSION=${tagVersion}`)) {
    errors.push(
      `scripts/mirror-release.sh has not been updated for ${tagVersion}. Rewrite all three ` +
        `"What's new in $VERSION" blocks to describe THIS release, then set the marker line ` +
        `RELEASE_COPY_VERSION=${tagVersion} near the top of the script to confirm.`,
    );
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
for (const w of warnings) console.log(`\nWARNING: ${w}`);
for (const e of errors) console.log(`\nERROR: ${e}`);

if (errors.length) {
  console.log(`\nPreflight FAILED with ${errors.length} error(s).`);
  process.exit(1);
}
console.log("\nAll release checks passed.");
