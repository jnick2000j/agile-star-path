#!/usr/bin/env bash
# Build a signed, versioned TaskMaster on-prem release bundle.
#
# Output: dist/taskmaster-vX.Y.Z.tar.gz  + .sig  + manifest.json
#
# Usage:
#   ./build-bundle.sh                    # uses ./VERSION
#   VERSION=1.4.0 ./build-bundle.sh      # override
#   SKIP_IMAGES=1 ./build-bundle.sh      # skip docker (faster local test builds)
#
# Inputs (env or CI secrets):
#   RELEASE_PRIVATE_KEY     PEM contents of release signing key (CI path)
#   RELEASE_PRIVATE_KEY_FILE Path to PEM key (local path)
#   IMAGE_REGISTRY          e.g. ghcr.io/taskmaster (default: ghcr.io/taskmaster)
#   MIN_PREVIOUS_VERSION    e.g. 1.2.0 (default: read from ./MIN_PREVIOUS_VERSION)
set -euo pipefail

cd "$(dirname "$0")"
RELEASE_DIR="$(pwd)"
ROOT="$(cd ../.. && pwd)"

VERSION="${VERSION:-$(cat ./VERSION | tr -d '[:space:]')}"
[ -n "$VERSION" ] || { echo "VERSION not set" >&2; exit 1; }
TAG="v${VERSION#v}"
VERSION="${TAG#v}"

REGISTRY="${IMAGE_REGISTRY:-ghcr.io/taskmaster}"
MIN_PREV="${MIN_PREVIOUS_VERSION:-$(cat ./MIN_PREVIOUS_VERSION 2>/dev/null | tr -d '[:space:]' || echo '')}"

DIST="$RELEASE_DIR/dist"
STAGE="$DIST/stage/$TAG"
rm -rf "$STAGE" && mkdir -p "$STAGE/images" "$STAGE/migrations" "$STAGE/web" "$STAGE/scripts" "$STAGE/docs"

log() { printf "\033[1;34m[release %s]\033[0m %s\n" "$TAG" "$*"; }

# --- 1. Stamp version into source --------------------------------------------
log "Stamping version $VERSION into docs and scripts..."
"$RELEASE_DIR/update-docs.sh" "$VERSION"

# --- 2. Build web bundle -----------------------------------------------------
log "Building web bundle..."
( cd "$ROOT" && npm ci && VITE_APP_VERSION="$VERSION" VITE_DEPLOYMENT_MODE=on_prem npm run build )
cp -r "$ROOT/dist/." "$STAGE/web/"

# --- 3. Copy migrations ------------------------------------------------------
log "Copying migrations..."
if [ -d "$ROOT/supabase/migrations" ]; then
  cp "$ROOT/supabase/migrations"/*.sql "$STAGE/migrations/" 2>/dev/null || true
fi
ls "$STAGE/migrations" | sort > "$STAGE/migrations.index"

# --- 4. Copy onprem scripts + docs + seed ------------------------------------
log "Copying onprem scripts and docs..."
cp -r "$ROOT/onprem/scripts/." "$STAGE/scripts/"
cp -r "$ROOT/onprem/docs/."    "$STAGE/docs/"
cp -r "$ROOT/onprem/seed"      "$STAGE/seed"
cp    "$ROOT/onprem/docker-compose.yml" "$STAGE/"
cp    "$ROOT/onprem/.env.example"       "$STAGE/"
chmod +x "$STAGE/scripts/"*.sh "$STAGE/scripts/pimp-cli" 2>/dev/null || true

# --- 5. Pull + export images -------------------------------------------------
IMAGES=(
  "$REGISTRY/edge:$TAG"
  "$REGISTRY/web:$TAG"
  "$REGISTRY/kong:$TAG"
)
IMAGE_DIGESTS="{}"
if [ -z "${SKIP_IMAGES:-}" ]; then
  log "Pulling and exporting images..."
  for img in "${IMAGES[@]}"; do
    docker pull "$img"
    fname=$(echo "$img" | tr '/:' '__')
    docker save "$img" -o "$STAGE/images/${fname}.tar"
  done
  # Capture digests for manifest
  IMAGE_DIGESTS=$(
    for img in "${IMAGES[@]}"; do
      digest=$(docker inspect --format='{{index .RepoDigests 0}}' "$img" 2>/dev/null || echo "$img")
      printf '%s\n' "$digest"
    done | jq -R . | jq -s '.'
  )
else
  log "SKIP_IMAGES=1 — skipping docker image export"
fi

# --- 6. Generate manifest ----------------------------------------------------
log "Generating manifest..."
"$RELEASE_DIR/generate-manifest.sh" "$STAGE" "$VERSION" "$MIN_PREV" "$IMAGE_DIGESTS"

# --- 7. Generate changelog ---------------------------------------------------
log "Generating changelog..."
"$RELEASE_DIR/generate-changelog.sh" "$VERSION" > "$STAGE/CHANGELOG.md" || true
cp "$STAGE/CHANGELOG.md" "$DIST/CHANGELOG-${TAG}.md" 2>/dev/null || true

# --- 8. Tar + checksum -------------------------------------------------------
TARBALL="$DIST/taskmaster-${TAG}.tar.gz"
log "Creating $TARBALL..."
tar -czf "$TARBALL" -C "$DIST/stage" "$TAG"
CHECKSUM=$(sha256sum "$TARBALL" | awk '{print $1}')
echo "$CHECKSUM  $(basename "$TARBALL")" > "$TARBALL.sha256"

# Patch checksum back into manifest (so verify can compare)
jq --arg c "$CHECKSUM" '.checksum = $c' "$STAGE/manifest.json" > "$STAGE/manifest.json.tmp"
mv "$STAGE/manifest.json.tmp" "$STAGE/manifest.json"
cp "$STAGE/manifest.json" "$DIST/manifest-${TAG}.json"

# Re-tar with patched manifest
tar -czf "$TARBALL" -C "$DIST/stage" "$TAG"
sha256sum "$TARBALL" | awk '{print $1}' > "$TARBALL.sha256"

# --- 9. Sign -----------------------------------------------------------------
log "Signing bundle..."
"$RELEASE_DIR/sign-bundle.sh" "$TARBALL"

log "✓ Built $TARBALL"
log "✓ Signature: $TARBALL.sig"
log "✓ Manifest:  $DIST/manifest-${TAG}.json"
log "✓ Checksum:  $(cat "$TARBALL.sha256")"
