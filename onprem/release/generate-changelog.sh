#!/usr/bin/env bash
# Generate a CHANGELOG section from conventional-commits since the last tag.
# Usage: ./generate-changelog.sh <new_version>
#
# Output (stdout): markdown section grouped by Features / Fixes / Other.
set -euo pipefail
VERSION="${1:?version}"
TAG="v${VERSION#v}"
PREV_TAG=$(git describe --tags --abbrev=0 --match 'v*' 2>/dev/null || echo "")
RANGE="${PREV_TAG:+$PREV_TAG..}HEAD"

DATE=$(date -u +"%Y-%m-%d")
echo "# $TAG — $DATE"
echo
[ -n "$PREV_TAG" ] && echo "_Changes since $PREV_TAG._" || echo "_Initial release._"
echo

emit_section() {
  local heading="$1" pattern="$2"
  local lines
  lines=$(git log --no-merges --pretty=format:'%s|%h' "$RANGE" 2>/dev/null \
    | awk -F'|' -v p="$pattern" '$1 ~ p { print "- " $1 " (" $2 ")" }' \
    | sed -E 's/^- (feat|fix|chore|docs|refactor|test|perf|build|ci)(\([^)]*\))?: /- /')
  if [ -n "$lines" ]; then
    echo "## $heading"
    echo
    echo "$lines"
    echo
  fi
}

emit_section "Features" '^feat(\(|:)'
emit_section "Fixes"    '^fix(\(|:)'
emit_section "Performance" '^perf(\(|:)'
emit_section "Docs"     '^docs(\(|:)'
emit_section "Other"    '^(chore|refactor|build|ci|test)(\(|:)'

# Catch-all for non-conventional commits
OTHER=$(git log --no-merges --pretty=format:'%s|%h' "$RANGE" 2>/dev/null \
  | awk -F'|' '$1 !~ /^(feat|fix|chore|docs|refactor|test|perf|build|ci)(\(|:)/ { print "- " $1 " (" $2 ")" }')
if [ -n "$OTHER" ]; then
  echo "## Uncategorised"
  echo
  echo "$OTHER"
  echo
fi
