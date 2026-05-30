#!/usr/bin/env bash
# Mirror a built release from the PRIVATE source repo to the PUBLIC releases repo
# so the auto-updater (which reads the public feed) can see it — AND regenerate
# the teacher-facing download page (GitHub Pages index.html + README) so the
# Mac/Windows download links and the "first-time open" warnings are always
# current for this version. Run after the Release workflow finishes building.
#
# Why this exists: GitHub Actions' built-in token can't write to another repo,
# and we keep the source private, so cross-repo publishing would need a PAT.
# This script does it locally with your normal `gh` login — no PAT required.
#
# Usage:
#   1. Bump "version" in src-tauri/tauri.conf.json, commit, merge to main.
#   2. git tag vX.Y.Z && git push origin vX.Y.Z   # CI builds installers
#   3. After the Release workflow finishes:  ./scripts/mirror-release.sh vX.Y.Z
#
# Requires: gh (logged in with access to both repos), python3, git.
set -euo pipefail

TAG="${1:-}"
if [ -z "$TAG" ]; then echo "usage: $0 <tag e.g. v0.1.3>"; exit 1; fi
VERSION="${TAG#v}"

SRC="mrdavearms/naplan-cohort-tracker"
PUB="mrdavearms/naplan-cohort-tracker-releases"
PAGES_URL="https://mrdavearms.github.io/naplan-cohort-tracker-releases/"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "Downloading $TAG assets from $SRC ..."
gh release download "$TAG" --repo "$SRC" --dir "$WORK"

if [ -f "$WORK/latest.json" ]; then
  echo "Rewriting latest.json URLs -> $PUB ..."
  python3 - "$WORK/latest.json" "$SRC" "$PUB" <<'PY'
import sys, json
path, src, pub = sys.argv[1], sys.argv[2], sys.argv[3]
d = json.load(open(path))
for p in d.get("platforms", {}).values():
    if "url" in p:
        p["url"] = p["url"].replace(f"/{src}/releases/", f"/{pub}/releases/")
json.dump(d, open(path, "w"), indent=2)
print("  rewrote", len(d.get("platforms", {})), "platform URLs")
PY
fi

# Friendly release notes (open-warning instructions baked in).
NOTES="$WORK/NOTES.md"
cat > "$NOTES" <<EOF
**NAPLAN Cohort Tracker $VERSION** — on-device NAPLAN cohort analysis.

> **Early release — may not work properly.** This is an early release and is still being tested, so some figures or screens may not work as expected. **Please check anything important against your source spreadsheets before you rely on it.** Feedback is very welcome — what works, what doesn't, anything that looks off: **dave.armstrong@education.vic.gov.au**. (The Year 3 → Year 5 primary analysis is the newest part and the least validated, so treat primary figures as especially provisional.)

### Which file do I download?
👉 **Easiest:** use the **[download page]($PAGES_URL)** — one clear button for your computer.

Or take just **one** file from the list below:
- **Mac:** the \`.dmg\`
- **Windows:** the \`...-setup.exe\`

Everything else here (\`.sig\`, \`.app.tar.gz\`, \`latest.json\`, \`.msi\`) is signatures and update data — **you can safely ignore it.**

### First time you open it (please read)
These builds aren't paid code-signed, so your computer shows a one-time warning. It's expected and safe.
- **Mac:** open the \`.dmg\`, drag the app into **Applications**, then right-click it -> **Open** -> **Open**. If it's still blocked, go to **System Settings -> Privacy & Security** and click **Open Anyway**.
- **Windows:** if you see "Windows protected your PC", click **More info** -> **Run anyway**.

You only need to do this once. The app is local-only -- no student data ever leaves your computer.
EOF

# Replace any existing public release for this tag, then publish with the notes.
if gh release view "$TAG" --repo "$PUB" >/dev/null 2>&1; then
  echo "Removing existing $TAG release in $PUB ..."
  gh release delete "$TAG" --repo "$PUB" --yes --cleanup-tag
fi

echo "Publishing $TAG to $PUB ..."
gh release create "$TAG" \
  --repo "$PUB" \
  --title "NAPLAN Cohort Tracker $TAG" \
  --notes-file "$NOTES" \
  --latest \
  "$WORK"/*

# ── Regenerate the teacher-facing download page (Pages index.html + README) ──
echo "Regenerating the public download page for $TAG ..."
DMG="$(cd "$WORK" && ls -- *.dmg 2>/dev/null | head -1 || true)"
EXE="$(cd "$WORK" && ls -- *-setup.exe 2>/dev/null | head -1 || true)"
MSI="$(cd "$WORK" && ls -- *.msi 2>/dev/null | head -1 || true)"
BASE="https://github.com/$PUB/releases/download/$TAG"

SITE="$WORK/site"
git clone --depth 1 "https://github.com/$PUB.git" "$SITE" >/dev/null 2>&1
python3 - "$SITE" "$VERSION" "$BASE" "$DMG" "$EXE" "$MSI" "$PAGES_URL" <<'PY'
import sys, datetime
site, version, base, dmg, exe, msi, pages_url = sys.argv[1:8]
dmg_url = f"{base}/{dmg}" if dmg else ""
exe_url = f"{base}/{exe}" if exe else ""
msi_url = f"{base}/{msi}" if msi else ""
date = datetime.date.today().strftime("%d %B %Y")

mac_btn = f'<a class="btn" href="{dmg_url}">Download (.dmg)</a>' if dmg_url else '<span class="os">unavailable</span>'
win_btn = f'<a class="btn" href="{exe_url}">Download (.exe)</a>' if exe_url else '<span class="os">unavailable</span>'
msi_li = f'<li><a href="{msi_url}">Windows .msi installer</a> — for IT-managed / silent installs.</li>' if msi_url else ''
releases_url = base.replace("/releases/download/", "/releases/tag/")

index = f"""<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>NAPLAN Cohort Tracker — download</title>
<meta name="description" content="On-device NAPLAN cohort analysis for schools. Download for macOS or Windows."/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Roboto+Slab:wght@700&family=Syne:wght@800&display=swap" rel="stylesheet"/>
<style>
  :root {{ --linen:#e8eddf; --graphite:#333533; --coral:#ff7247; --coral-dark:#e5623d; --sage:#8aa67a; --alabaster:#cfdbd5; }}
  * {{ box-sizing:border-box; }}
  body {{ margin:0; font-family:'Inter',system-ui,sans-serif; color:var(--graphite); background:var(--linen); line-height:1.55; }}
  .wrap {{ max-width:860px; margin:0 auto; padding:0 24px; }}
  header {{ text-align:center; padding:64px 24px 36px; background:radial-gradient(circle at 50% -20%, #fff 0%, var(--linen) 60%); }}
  .logo {{ width:84px; height:84px; border-radius:50%; background:var(--graphite); border:5px solid var(--coral); color:var(--linen); font-family:'Roboto Slab',serif; font-weight:700; font-size:34px; display:flex; align-items:center; justify-content:center; margin:0 auto 20px; }}
  h1 {{ font-family:'Syne',sans-serif; font-weight:800; font-size:44px; margin:0 0 8px; letter-spacing:-0.5px; }}
  .tagline {{ font-size:19px; color:#555; max-width:560px; margin:0 auto; }}
  .downloads {{ display:flex; flex-wrap:wrap; gap:18px; justify-content:center; margin:36px 0 12px; }}
  .dl {{ flex:1 1 280px; max-width:340px; background:#fff; border:1px solid var(--alabaster); border-radius:18px; padding:28px 24px; text-align:center; box-shadow:0 6px 24px rgba(51,53,51,.06); }}
  .dl.highlight {{ border-color:var(--coral); box-shadow:0 10px 30px rgba(255,114,71,.18); }}
  .dl h2 {{ font-family:'Roboto Slab',serif; font-size:22px; margin:0 0 4px; }}
  .dl .os {{ color:#777; font-size:14px; margin-bottom:18px; }}
  .btn {{ display:inline-block; background:var(--coral); color:#fff; text-decoration:none; font-weight:600; font-size:17px; padding:14px 28px; border-radius:12px; }}
  .btn:hover {{ background:var(--coral-dark); }}
  .btn.secondary {{ background:transparent; color:var(--coral-dark); font-size:14px; padding:6px 0; }}
  .yourtag {{ display:block; font-size:12px; font-weight:600; color:var(--sage); margin-bottom:10px; min-height:16px; }}
  .card {{ background:#fff; border:1px solid var(--alabaster); border-radius:18px; padding:24px 28px; margin:18px 0; }}
  .card h3 {{ font-family:'Roboto Slab',serif; margin:0 0 10px; font-size:19px; }}
  .warn {{ border-left:4px solid var(--coral); }}
  .warn ol {{ margin:8px 0 0; padding-left:20px; }}
  .pill {{ display:inline-block; background:var(--sage); color:#fff; font-size:12px; font-weight:600; padding:3px 10px; border-radius:999px; }}
  footer {{ text-align:center; color:#888; font-size:13px; padding:40px 24px 60px; }}
  a {{ color:var(--coral-dark); }}
  details.more {{ max-width:560px; margin:0 auto 28px; }}
  details.more summary {{ cursor:pointer; color:var(--coral-dark); font-weight:600; text-align:center; font-size:14px; list-style:none; }}
  details.more summary::-webkit-details-marker {{ display:none; }}
  details.more ul {{ margin:12px auto 0; padding-left:18px; font-size:14px; color:#666; max-width:480px; }}
  details.more li {{ margin:6px 0; }}
</style>
</head>
<body>
<header>
  <div class="logo">NCT</div>
  <h1>NAPLAN Cohort Tracker</h1>
  <p class="tagline">See how the same students grew over two years — Year&nbsp;3 to Year&nbsp;5, or Year&nbsp;7 to Year&nbsp;9 — clearly, on your own computer. No spreadsheets, no logins, nothing leaves your machine.</p>
</header>
<div class="wrap">
  <div class="downloads">
    <div class="dl" id="mac">
      <span class="yourtag" id="mac-tag"></span>
      <h2>Download for Mac</h2>
      <div class="os">macOS · Apple Silicon &amp; Intel</div>
      {mac_btn}
    </div>
    <div class="dl" id="win">
      <span class="yourtag" id="win-tag"></span>
      <h2>Download for Windows</h2>
      <div class="os">Windows 10 &amp; 11</div>
      {win_btn}
    </div>
  </div>
  <p style="text-align:center;color:#888;font-size:13px;margin:0 0 6px">Version {version} · released {date}</p>
  <details class="more">
    <summary>Other download options ▾</summary>
    <ul>
      {msi_li}
      <li><a href="{releases_url}">All files for this version on GitHub</a> — includes signatures and update data that most people can ignore.</li>
    </ul>
  </details>

  <div class="card warn">
    <h3>Opening it the first time — one quick step</h3>
    <p>This app is free and isn't paid Apple/Microsoft code-signed, so the very first time you open it your computer asks you to confirm. <strong>This is normal and expected</strong> — you only do it once, then it opens like any other app.</p>
    <p style="margin:16px 0 4px"><strong>On a Mac</strong></p>
    <ol>
      <li>Open the downloaded <strong>.dmg</strong> and drag <strong>NAPLAN Cohort Tracker</strong> into your <strong>Applications</strong> folder.</li>
      <li>Open your <strong>Applications</strong> folder and <strong>double-click</strong> the app. macOS will say it “<strong>could not verify</strong>” the app — that's expected. Click <strong>Done</strong> (do <em>not</em> click Move to Trash).</li>
      <li>Go to <strong>System Settings → Privacy &amp; Security</strong>, scroll down to the <strong>Security</strong> section, and next to “NAPLAN Cohort Tracker was blocked” click <strong>Open Anyway</strong>. Confirm with your fingerprint or Mac password.</li>
      <li>On older Macs you can instead skip steps 2–3 and just <strong>right-click</strong> (or Control-click) the app → <strong>Open</strong> → <strong>Open</strong>.</li>
    </ol>
    <p style="margin:6px 0 0;color:#666;font-size:14px">After this first time, open it normally from Applications, the Dock or Launchpad.</p>
    <p style="margin:16px 0 4px"><strong>On Windows</strong></p>
    <ol>
      <li>Run the downloaded <strong>setup .exe</strong>.</li>
      <li>If you see a blue “<strong>Windows protected your PC</strong>” box, click <strong>More info</strong> → <strong>Run anyway</strong>.</li>
    </ol>
  </div>

  <div class="card warn">
    <h3><span class="pill">Early release</span> &nbsp;May not work properly</h3>
    <p>This is an <strong>early release</strong> and is still being tested, so some figures or screens may not work as expected — please <strong>check anything important against your source spreadsheets before you rely on it</strong>. The <span style="white-space:nowrap">Year&nbsp;3 → Year&nbsp;5</span> (primary) and new <span style="white-space:nowrap">Year&nbsp;5 → Year&nbsp;7</span> (P–12) cohort tracking are the <strong>newest parts</strong> and the least validated, so treat those figures as especially provisional.</p>
    <p>Your feedback is genuinely welcome — tell me what works, what doesn't, and anything that looks off: <a href="mailto:dave.armstrong@education.vic.gov.au">dave.armstrong@education.vic.gov.au</a>.</p>
  </div>

  <div class="card">
    <h3>What it does</h3>
    <p>Point it at a folder of your NAPLAN SSSR files and it shows participation, proficiency, equity and skill gaps — and tracks the <strong>same students across two years (Year 3 to Year 5, Year 7 to Year 9, or Year 5 to Year 7 in a combined P–12 school)</strong>, the closest thing to a true measure of your school's contribution. It builds tidy PDF reports for your leadership and faculty conversations.</p>
    <p><span class="pill">Private by design</span> &nbsp;Everything runs on your computer. No student names appear anywhere, and no data is ever uploaded.</p>
  </div>

  <div class="card">
    <h3>Updating later</h3>
    <p>Once installed, the app checks for new versions itself — you'll be told when an update is ready. You can always come back to this page for the latest installer too.</p>
  </div>
</div>
<footer>NAPLAN Cohort Tracker · made for schools · <a href="{pages_url}">always get the newest version here</a></footer>
<script>
  (function() {{
    var p = ((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent).toLowerCase();
    if (p.indexOf('mac') > -1) {{ document.getElementById('mac').classList.add('highlight'); document.getElementById('mac-tag').textContent = '✓ recommended for your computer'; }}
    if (p.indexOf('win') > -1) {{ document.getElementById('win').classList.add('highlight'); document.getElementById('win-tag').textContent = '✓ recommended for your computer'; }}
  }})();
</script>
</body>
</html>
"""

readme = f"""# NAPLAN Cohort Tracker — download

**On-device NAPLAN cohort analysis for schools.** See how the *same students* grew
over two years — Year 3 to Year 5, or Year 7 to Year 9 — clearly, on your own computer.
No spreadsheets, no logins, and no student data ever leaves your machine.

## Download the app — version {version}

> **Easiest:** open the **[download page]({pages_url})** and click the big button for your computer.

| Computer | Download |
|---|---|
| **Mac** (Apple Silicon & Intel) | **[Download the .dmg]({dmg_url})** |
| **Windows** (10 & 11) | **[Download the .exe]({exe_url})** |

> **Early release — may not work properly.** This is an early release and is still being tested, so some figures or screens may not work as expected. Please check anything important against your source spreadsheets before you rely on it. (The Year 3 → Year 5 primary analysis is the newest and least-validated part, so treat primary figures as especially provisional.) Feedback is very welcome — **dave.armstrong@education.vic.gov.au**.

### The first time you open it — please read

This app is free and isn't paid Apple/Microsoft code-signed, so the first time you open it your computer asks you to confirm. **This is normal** — you only do it once.

- **Mac:** drag the app into **Applications**, then double-click it. macOS will say it "could not verify" the app (expected) — click **Done**. Then go to **System Settings -> Privacy & Security**, scroll down, and click **Open Anyway** next to the NAPLAN Cohort Tracker message; confirm with your fingerprint or Mac password. (On older Macs you can instead right-click the app -> **Open** -> **Open**.)
- **Windows:** if you see "Windows protected your PC", click **More info** -> **Run anyway**.

You only need to do this once; after that it opens normally.

## What it does

Point it at a folder of your NAPLAN SSSR files. It shows participation, proficiency,
equity and skill gaps, and tracks the **matched cohort across two years (Year 3 -> Year 5,
Year 7 -> Year 9, or Year 5 -> Year 7 in a combined P-12 school)** -- the closest thing to a
true measure of your school's contribution -- then builds tidy PDF reports.

**Private by design:** everything runs on your computer; no student names appear anywhere
and nothing is uploaded.

## Updates

The app checks for new versions itself once installed. You can always return here for the
newest installer.

---

_This repository holds the installers only. Older versions are under [Releases](../../releases)._
"""

open(f"{site}/index.html", "w").write(index)
open(f"{site}/README.md", "w").write(readme)
print("  wrote index.html + README.md")
PY

( cd "$SITE"
  git add index.html README.md
  if ! git diff --cached --quiet; then
    git -c user.email="noreply@anthropic.com" -c user.name="NAPLAN Cohort Tracker" \
      commit -q -m "Download page for $TAG"
    git push -q origin HEAD
    echo "  pushed updated download page"
  else
    echo "  download page unchanged"
  fi
)

echo ""
echo "Done."
echo "  Auto-update feed: https://github.com/$PUB/releases/latest/download/latest.json"
echo "  Download page:    $PAGES_URL"
echo "  Releases:         https://github.com/$PUB/releases/latest"
