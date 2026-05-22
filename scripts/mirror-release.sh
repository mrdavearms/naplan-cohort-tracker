#!/usr/bin/env bash
# Mirror a built release from the PRIVATE source repo to the PUBLIC releases repo
# so the auto-updater (which reads the public feed) can see it.
#
# Why this exists: GitHub Actions' built-in token can't write to another repo,
# and we keep the source private, so cross-repo publishing would need a Personal
# Access Token. This script does it locally with your normal `gh` login instead
# — no PAT required.
#
# Usage:
#   1. Bump "version" in src-tauri/tauri.conf.json, commit.
#   2. git tag vX.Y.Z && git push origin vX.Y.Z      # CI builds installers in the private repo
#   3. Wait for the Release workflow to finish, then:
#        ./scripts/mirror-release.sh vX.Y.Z
#
# Requires: gh (logged in as a user with access to both repos), python3.
set -euo pipefail

TAG="${1:-}"
if [ -z "$TAG" ]; then echo "usage: $0 <tag e.g. v0.1.0>"; exit 1; fi

SRC="mrdavearms/naplan-throughline"
PUB="mrdavearms/naplan-throughline-releases"
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

# Replace any existing public release for this tag, then publish.
if gh release view "$TAG" --repo "$PUB" >/dev/null 2>&1; then
  echo "Removing existing $TAG release in $PUB ..."
  gh release delete "$TAG" --repo "$PUB" --yes --cleanup-tag
fi

echo "Publishing $TAG to $PUB ..."
gh release create "$TAG" \
  --repo "$PUB" \
  --title "Naplan Throughline $TAG" \
  --notes "On-device NAPLAN cohort analysis. Unsigned build — macOS: right-click → Open; Windows: More info → Run anyway." \
  --latest \
  "$WORK"/*

echo "Done. Auto-update feed: https://github.com/$PUB/releases/latest/download/latest.json"
