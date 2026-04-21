#!/usr/bin/env bash
# Sign a release tarball with the release private key.
# Usage: ./sign-bundle.sh <tarball>
#
# Reads key from (in order):
#   $RELEASE_PRIVATE_KEY      PEM contents (CI path — write to temp file)
#   $RELEASE_PRIVATE_KEY_FILE path to PEM
#   ./keys/release.priv.pem   default local path
set -euo pipefail
TARBALL="${1:?usage: $0 <tarball>}"
[ -f "$TARBALL" ] || { echo "Tarball not found: $TARBALL" >&2; exit 1; }

KEY_FILE=""
CLEANUP=""
if [ -n "${RELEASE_PRIVATE_KEY:-}" ]; then
  KEY_FILE=$(mktemp)
  CLEANUP="$KEY_FILE"
  printf '%s' "$RELEASE_PRIVATE_KEY" > "$KEY_FILE"
  chmod 600 "$KEY_FILE"
elif [ -n "${RELEASE_PRIVATE_KEY_FILE:-}" ]; then
  KEY_FILE="$RELEASE_PRIVATE_KEY_FILE"
elif [ -f "./keys/release.priv.pem" ]; then
  KEY_FILE="./keys/release.priv.pem"
else
  echo "No release private key found (set RELEASE_PRIVATE_KEY or RELEASE_PRIVATE_KEY_FILE)" >&2
  exit 1
fi

openssl dgst -sha256 -sign "$KEY_FILE" -out "${TARBALL}.sig" "$TARBALL"
[ -n "$CLEANUP" ] && rm -f "$CLEANUP"
echo "Signed: ${TARBALL}.sig"
