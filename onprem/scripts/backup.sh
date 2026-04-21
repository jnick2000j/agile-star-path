#!/usr/bin/env bash
# Manual backup: pg_dump + uploads tarball. Run from cron for routine backups.
set -euo pipefail

cd "$(dirname "$0")/.."
set -a; . ./.env; set +a

STAMP=$(date +%Y%m%d-%H%M%S)
OUT_DIR="./backups"
mkdir -p "$OUT_DIR"

DB_FILE="$OUT_DIR/db-$STAMP.sql.gz"
FILES_TAR="$OUT_DIR/uploads-$STAMP.tar.gz"

echo "[backup] DB → $DB_FILE"
docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$DB_FILE"

echo "[backup] uploads → $FILES_TAR"
docker run --rm -v taskmaster_storage-data:/data -v "$(pwd)/$OUT_DIR":/out alpine \
  tar -czf "/out/$(basename "$FILES_TAR")" -C /data .

# Keep last 14 backups
ls -1t "$OUT_DIR"/db-*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm
ls -1t "$OUT_DIR"/uploads-*.tar.gz 2>/dev/null | tail -n +15 | xargs -r rm

echo "[backup] done."
