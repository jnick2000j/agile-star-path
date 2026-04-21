#!/usr/bin/env bash
# Bundle diagnostics for support — logs, versions, schema state, health.
# Secrets in .env are redacted before inclusion.
set -euo pipefail

cd "$(dirname "$0")/.."
STAMP=$(date +%Y%m%d-%H%M%S)
OUT_DIR="diag-$STAMP"
mkdir -p "$OUT_DIR"

echo "[diag] versions"
docker version > "$OUT_DIR/docker-version.txt" 2>&1 || true
docker compose version > "$OUT_DIR/compose-version.txt" 2>&1 || true
docker compose ps > "$OUT_DIR/compose-ps.txt" 2>&1 || true

echo "[diag] logs"
for svc in db auth realtime storage edge kong web ollama; do
  docker compose logs --tail=1000 "$svc" > "$OUT_DIR/log-$svc.txt" 2>&1 || true
done

echo "[diag] redacted env"
sed -E 's/(PASSWORD|KEY|SECRET)=.*/\1=***REDACTED***/' .env > "$OUT_DIR/env.redacted"

echo "[diag] schema"
set -a; . ./.env; set +a
docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "SELECT filename, applied_at FROM public.schema_version ORDER BY applied_at" \
  > "$OUT_DIR/schema-version.txt" 2>&1 || true

echo "[diag] health"
./scripts/healthcheck.sh > "$OUT_DIR/healthcheck.txt" 2>&1 || true

tar -czf "diagnostics-$STAMP.tar.gz" "$OUT_DIR"
rm -rf "$OUT_DIR"
echo "[diag] wrote diagnostics-$STAMP.tar.gz"
