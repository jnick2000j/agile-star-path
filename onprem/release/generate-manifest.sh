#!/usr/bin/env bash
# Generate manifest.json for a staged bundle.
# Usage: ./generate-manifest.sh <stage_dir> <version> <min_previous_version> <image_digests_json>
set -euo pipefail
STAGE="${1:?stage dir}"
VERSION="${2:?version}"
MIN_PREV="${3:-}"
IMAGE_DIGESTS="${4:-[]}"

MIGRATIONS=$(ls "$STAGE/migrations" 2>/dev/null | sort | jq -R . | jq -s '.')
IMAGES=$(ls "$STAGE/images" 2>/dev/null | jq -R . | jq -s '.' || echo '[]')
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
GIT_SHA=$(git -C "$STAGE/../../../.." rev-parse --short HEAD 2>/dev/null || echo "unknown")

cat > "$STAGE/manifest.json" <<EOF
{
  "schema_version": 1,
  "version": "$VERSION",
  "build_time": "$BUILD_TIME",
  "git_sha": "$GIT_SHA",
  "min_previous_version": "$MIN_PREV",
  "checksum": "",
  "migrations": $MIGRATIONS,
  "image_files": $IMAGES,
  "image_digests": $IMAGE_DIGESTS
}
EOF
echo "Manifest written: $STAGE/manifest.json"
