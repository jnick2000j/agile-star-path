#!/usr/bin/env bash
# Restore from a pair of backup files produced by backup.sh.
# Usage: ./restore.sh <db.sql.gz> <uploads.tar.gz>
set -euo pipefail

DB_FILE="${1:-}"
FILES_TAR="${2:-}"
[ -f "$DB_FILE" ] && [ -f "$FILES_TAR" ] || { echo "Usage: $0 <db.sql.gz> <uploads.tar.gz>" >&2; exit 1; }

cd "$(dirname "$0")/.."
set -a; . ./.env; set +a

echo "[restore] Stopping services (DB stays up)..."
docker compose stop web edge kong auth realtime storage

echo "[restore] Restoring DB from $DB_FILE..."
gunzip -c "$DB_FILE" | docker compose exec -T db psql -U "$POSTGRES_USER" "$POSTGRES_DB"

echo "[restore] Restoring uploads from $FILES_TAR..."
docker run --rm -v taskmaster_storage-data:/data -v "$(pwd)/$(dirname "$FILES_TAR")":/in alpine \
  sh -c "rm -rf /data/* && tar -xzf /in/$(basename "$FILES_TAR") -C /data"

echo "[restore] Restarting services..."
docker compose up -d
echo "[restore] Done."
