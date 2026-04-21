#!/usr/bin/env bash
# Bump version, update docs, commit, and tag.
# Usage: ./bump-version.sh patch|minor|major
#        ./bump-version.sh 1.4.0          # explicit
set -euo pipefail
cd "$(dirname "$0")"

ARG="${1:?usage: $0 patch|minor|major|<x.y.z>}"
CURRENT=$(cat ./VERSION | tr -d '[:space:]')
IFS='.' read -r MA MI PA <<<"$CURRENT"

case "$ARG" in
  patch) NEW="$MA.$MI.$((PA+1))" ;;
  minor) NEW="$MA.$((MI+1)).0" ;;
  major) NEW="$((MA+1)).0.0" ;;
  *)
    echo "$ARG" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || { echo "Invalid version: $ARG" >&2; exit 1; }
    NEW="$ARG" ;;
esac

echo "$CURRENT → $NEW"
echo "$NEW" > ./VERSION
./update-docs.sh "$NEW"

# Update root package.json version (best-effort)
if [ -f ../../package.json ]; then
  jq --arg v "$NEW" '.version = $v' ../../package.json > ../../package.json.tmp \
    && mv ../../package.json.tmp ../../package.json
fi

echo "✓ Bumped to $NEW. Next steps:"
echo "    git add -A && git commit -m \"chore: release v$NEW\""
echo "    git tag v$NEW && git push --tags"
echo "  CI will build, sign, and publish to GitHub Releases."
