#!/usr/bin/env bash
# First-time install for TaskMaster on-prem.
# Idempotent — safe to re-run; will skip steps that have already completed.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

log()  { printf "\033[1;34m[install]\033[0m %s\n" "$*"; }
fail() { printf "\033[1;31m[install]\033[0m %s\n" "$*" >&2; exit 1; }

# --- 1. Prerequisites -------------------------------------------------------
log "Checking prerequisites..."
command -v docker >/dev/null  || fail "docker not found"
docker compose version >/dev/null 2>&1 || fail "docker compose v2 not found"
RAM_MB=$(free -m 2>/dev/null | awk '/^Mem:/{print $2}' || echo 4096)
[ "$RAM_MB" -ge 3500 ] || log "warning: <4GB RAM detected ($RAM_MB MB) — proceed at your own risk"
DISK_GB=$(df -BG --output=avail "$ROOT" | tail -1 | tr -dc 0-9)
[ "$DISK_GB" -ge 20 ] || fail "need at least 20GB free at $ROOT (found ${DISK_GB}GB)"

# --- 2. Config --------------------------------------------------------------
[ -f .env ] || fail ".env not found — copy .env.example to .env and fill it in"
set -a; . ./.env; set +a
[ -n "${DOMAIN:-}" ]            || fail "DOMAIN not set in .env"
[ -n "${POSTGRES_PASSWORD:-}" ] || fail "POSTGRES_PASSWORD not set in .env"
[ -n "${LICENSE_KEY:-}" ]       || fail "LICENSE_KEY not set in .env"

# Auto-generate JWT_SECRET / keys if blank.
if [ -z "${JWT_SECRET:-}" ]; then
  JWT_SECRET=$(openssl rand -hex 64)
  echo "JWT_SECRET=$JWT_SECRET" >> .env
  log "Generated JWT_SECRET"
fi
if [ -z "${ANON_KEY:-}" ] || [ -z "${SERVICE_ROLE_KEY:-}" ]; then
  log "Deriving ANON_KEY and SERVICE_ROLE_KEY from JWT_SECRET..."
  ./scripts/derive-keys.sh "$JWT_SECRET" >> .env
  set -a; . ./.env; set +a
fi

# --- 3. Verify license ------------------------------------------------------
log "Verifying license..."
docker run --rm -v "$ROOT":/work ghcr.io/taskmaster/onprem-license-verify:latest \
  --license "$LICENSE_KEY" --pubkey /work/keys/license.pub.pem \
  || fail "License verification failed — contact your account team."

# --- 4. Load bundled images (air-gapped path) -------------------------------
if [ -d "./bundles/current/images" ]; then
  log "Loading bundled images..."
  for img in ./bundles/current/images/*.tar; do
    docker load < "$img"
  done
fi

# --- 5. Boot DB only, run migrations ----------------------------------------
log "Starting Postgres..."
docker compose up -d db
until docker compose exec -T db pg_isready -U "$POSTGRES_USER" >/dev/null 2>&1; do
  sleep 2
done

log "Applying migrations..."
for f in ./migrations/*.sql; do
  fname=$(basename "$f")
  applied=$(docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
    "SELECT 1 FROM public.schema_version WHERE filename='$fname' LIMIT 1" 2>/dev/null || echo "")
  if [ -z "$applied" ]; then
    log "  applying $fname"
    docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$f"
    docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
      "INSERT INTO public.schema_version(filename, applied_at) VALUES ('$fname', now()) ON CONFLICT DO NOTHING"
  fi
done

# --- 6. Bring up the rest of the stack --------------------------------------
log "Starting services..."
PROFILES="--profile ollama"
[ "${AI_PROVIDER:-ollama}" != "ollama" ] && PROFILES=""
docker compose $PROFILES up -d

# --- 7. Health check --------------------------------------------------------
log "Waiting for stack to become healthy..."
for i in $(seq 1 30); do
  if ./scripts/healthcheck.sh >/dev/null 2>&1; then
    log "Install complete. Open ${PROTOCOL}://${DOMAIN}"
    exit 0
  fi
  sleep 5
done
fail "Stack did not become healthy in time. Check: docker compose logs"
