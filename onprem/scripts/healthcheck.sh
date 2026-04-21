#!/usr/bin/env bash
# Probes the running stack. Exits 0 if everything is healthy, non-zero otherwise.
set -euo pipefail

cd "$(dirname "$0")/.."
set -a; . ./.env; set +a

URL="${PUBLIC_URL%/}"
ok() { printf "  \033[1;32m✓\033[0m %s\n" "$*"; }
ko() { printf "  \033[1;31m✗\033[0m %s\n" "$*"; FAIL=1; }

FAIL=0
echo "[health] checking $URL"

curl -fsS "$URL/functions/v1/health" >/dev/null 2>&1 \
  && ok "edge runtime" || ko "edge runtime"

curl -fsS "$URL/auth/v1/health" >/dev/null 2>&1 \
  && ok "auth"        || ko "auth"

docker compose exec -T db pg_isready -U "$POSTGRES_USER" >/dev/null 2>&1 \
  && ok "postgres"    || ko "postgres"

curl -fsS "$URL/" >/dev/null 2>&1 \
  && ok "web"         || ko "web"

exit $FAIL
