#!/usr/bin/env bash
# Roll back to the previous bundle. Restores the most recent pre-upgrade DB
# snapshot and re-points IMAGE_TAG at the previous version.
set -euo pipefail

cd "$(dirname "$0")/.."
log()  { printf "\033[1;34m[rollback]\033[0m %s\n" "$*"; }
fail() { printf "\033[1;31m[rollback]\033[0m %s\n" "$*" >&2; exit 1; }

PREV_BACKUP=$(cat ./bundles/.last-backup 2>/dev/null || true)
[ -n "$PREV_BACKUP" ] && [ -f "$PREV_BACKUP" ] || fail "No pre-upgrade backup found."

PREV_TAG=$(grep PREVIOUS_IMAGE_TAG ./.env.tag 2>/dev/null | cut -d= -f2 || true)
[ -n "$PREV_TAG" ] || fail "PREVIOUS_IMAGE_TAG not recorded — manual rollback required."

log "Stopping services..."
docker compose stop web edge kong

log "Restoring DB from $PREV_BACKUP..."
gunzip -c "$PREV_BACKUP" | docker compose exec -T db psql -U "${POSTGRES_USER:-postgres}" "${POSTGRES_DB:-postgres}"

log "Re-pinning IMAGE_TAG=$PREV_TAG..."
echo "IMAGE_TAG=$PREV_TAG" > ./.env.tag
docker compose --env-file .env --env-file .env.tag up -d

log "Rollback complete."
