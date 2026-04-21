#!/usr/bin/env bash
# Atomic upgrade for TaskMaster on-prem (Option 2: versioned signed bundles).
# Usage: ./upgrade.sh <version>   e.g. ./upgrade.sh v1.4.0
set -euo pipefail

VERSION="${1:-}"
[ -n "$VERSION" ] || { echo "Usage: $0 <version>" >&2; exit 1; }

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
BUNDLE_DIR="./bundles/$VERSION"
CURRENT_LINK="./bundles/current"

log()  { printf "\033[1;34m[upgrade %s]\033[0m %s\n" "$VERSION" "$*"; }
fail() { printf "\033[1;31m[upgrade %s]\033[0m %s\n" "$VERSION" "$*" >&2; exit 1; }

[ -d "$BUNDLE_DIR" ] || fail "Bundle not found at $BUNDLE_DIR — run pimp-cli download $VERSION first."
[ -f "$BUNDLE_DIR/manifest.json" ] || fail "Missing manifest.json in $BUNDLE_DIR"

set -a; . ./.env; set +a

# --- 1. Verify manifest signature & chain -----------------------------------
log "Verifying bundle signature..."
./scripts/pimp-cli verify "$VERSION" || fail "Signature verification failed."

PREV_VERSION="$(readlink "$CURRENT_LINK" 2>/dev/null | xargs -r basename || echo "none")"
MIN_PREV=$(jq -r '.min_previous_version // ""' "$BUNDLE_DIR/manifest.json")
if [ -n "$MIN_PREV" ] && [ "$PREV_VERSION" != "none" ]; then
  log "Current: $PREV_VERSION; bundle requires >= $MIN_PREV"
  # naive lexical check; release tooling guarantees semver-sortable tags
  [ "$(printf '%s\n%s' "$MIN_PREV" "$PREV_VERSION" | sort -V | head -1)" = "$MIN_PREV" ] \
    || fail "Current version $PREV_VERSION is older than min_previous_version $MIN_PREV. Upgrade incrementally."
fi

# --- 2. Pre-flight ---------------------------------------------------------
log "Pre-flight checks..."
DISK_GB=$(df -BG --output=avail "$ROOT" | tail -1 | tr -dc 0-9)
[ "$DISK_GB" -ge 10 ] || fail "Need at least 10GB free for upgrade (found ${DISK_GB}GB)."
docker compose exec -T db pg_isready -U "$POSTGRES_USER" >/dev/null || fail "Postgres not reachable."

# --- 3. Backup -------------------------------------------------------------
BACKUP_FILE="./backups/pre-${VERSION}-$(date +%Y%m%d-%H%M%S).sql.gz"
log "Backing up DB to $BACKUP_FILE..."
mkdir -p ./backups
docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$BACKUP_FILE"
echo "$BACKUP_FILE" > ./bundles/.last-backup

# --- 4. Load new images ----------------------------------------------------
log "Loading new images..."
for img in "$BUNDLE_DIR"/images/*.tar; do
  docker load < "$img"
done

# --- 5. Run pending migrations --------------------------------------------
log "Applying new migrations..."
for f in "$BUNDLE_DIR"/migrations/*.sql; do
  fname=$(basename "$f")
  applied=$(docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
    "SELECT 1 FROM public.schema_version WHERE filename='$fname' LIMIT 1" 2>/dev/null || echo "")
  if [ -z "$applied" ]; then
    log "  applying $fname"
    docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$f"
    docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
      "INSERT INTO public.schema_version(filename, applied_at) VALUES ('$fname', now())"
  fi
done

# --- 6. Swap web bundle ----------------------------------------------------
log "Swapping web bundle..."
rm -rf ./web-current
cp -r "$BUNDLE_DIR/web" ./web-current

# --- 7. Restart edge + web with new IMAGE_TAG ------------------------------
log "Restarting services with IMAGE_TAG=$VERSION..."
echo "IMAGE_TAG=$VERSION" > ./.env.tag
docker compose --env-file .env --env-file .env.tag up -d edge web kong

# --- 8. Health gate --------------------------------------------------------
log "Health checks..."
for i in $(seq 1 24); do
  if ./scripts/healthcheck.sh >/dev/null 2>&1; then
    ln -sfn "$VERSION" "$CURRENT_LINK"
    log "Upgrade to $VERSION complete."
    exit 0
  fi
  sleep 5
done

log "Health check failed — rolling back."
./scripts/rollback.sh
fail "Upgrade aborted; previous version restored."
