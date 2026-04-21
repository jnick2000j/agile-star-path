#!/usr/bin/env bash
# Derives Supabase ANON_KEY and SERVICE_ROLE_KEY (signed JWTs) from a JWT_SECRET.
# Output is two `KEY=value` lines on stdout, suitable for appending to .env.
set -euo pipefail

JWT_SECRET="${1:?usage: derive-keys.sh <jwt_secret>}"

b64() { openssl base64 -A | tr -- '+/' '-_' | tr -d '='; }
hmac() {
  printf '%s' "$1" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | b64
}

mk_jwt() {
  local role="$1"
  local header payload sig
  header=$(printf '{"alg":"HS256","typ":"JWT"}' | b64)
  payload=$(printf '{"iss":"taskmaster-onprem","role":"%s","iat":%d,"exp":%d}' \
    "$role" "$(date +%s)" $(( $(date +%s) + 60*60*24*365*10 )) | b64)
  sig=$(hmac "$header.$payload")
  printf '%s.%s.%s\n' "$header" "$payload" "$sig"
}

echo "ANON_KEY=$(mk_jwt anon)"
echo "SERVICE_ROLE_KEY=$(mk_jwt service_role)"
