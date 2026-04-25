#!/usr/bin/env bash
# Provision TLS certificates for TaskMaster on-prem and wire them into
# the docker-compose stack (web container reads ./tls/{fullchain,privkey}.pem).
#
# Modes:
#   --mode letsencrypt   Use certbot to obtain a real cert from Let's Encrypt.
#                        VM must be reachable on port 80 from the internet.
#   --mode self-signed   Generate a local CA + leaf cert. For air-gapped
#                        installs, dev, or internal-only deployments.
#                        The CA cert is written to ./tls/ca.crt — distribute
#                        it to clients (browsers, OS trust stores) so the
#                        cert is trusted.
#   --mode byo           "Bring your own" — copy an existing fullchain.pem
#                        and privkey.pem into ./tls/ from --cert / --key paths.
#
# Common flags:
#   --domain <fqdn>      REQUIRED. Primary FQDN (e.g. taskmaster.example.com)
#   --san    <fqdn>      Optional extra SANs (repeatable). For multi-host,
#                        pass each app node's hostname here.
#   --email  <addr>      Required for letsencrypt mode (renewal notices).
#   --cert   <path>      Required for byo mode — path to fullchain PEM.
#   --key    <path>      Required for byo mode — path to private key PEM.
#   --renew              letsencrypt only: install a daily systemd timer
#                        (or cron job) that runs `certbot renew` and restarts
#                        the web container.
#   --out <dir>          Output directory (default: ./tls relative to repo).
#
# Examples:
#   # Public single-host with Let's Encrypt + auto-renew
#   sudo ./scripts/provision-tls.sh --mode letsencrypt \
#        --domain taskmaster.example.com --email ops@example.com --renew
#
#   # Air-gapped self-signed, with extra SANs for two app nodes
#   sudo ./scripts/provision-tls.sh --mode self-signed \
#        --domain taskmaster.internal \
#        --san app1.internal --san app2.internal
#
#   # Bring your own enterprise PKI cert
#   sudo ./scripts/provision-tls.sh --mode byo \
#        --domain taskmaster.example.com \
#        --cert /tmp/wildcard.example.com.pem \
#        --key  /tmp/wildcard.example.com.key

set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

# ---------- pretty logging --------------------------------------------------
c_blue=$'\033[1;34m'; c_red=$'\033[1;31m'; c_yel=$'\033[1;33m'
c_grn=$'\033[1;32m'; c_off=$'\033[0m'
log()  { printf "%s[tls]%s %s\n"  "$c_blue" "$c_off" "$*"; }
ok()   { printf "%s[ ok ]%s %s\n" "$c_grn"  "$c_off" "$*"; }
warn() { printf "%s[warn]%s %s\n" "$c_yel"  "$c_off" "$*"; }
fail() { printf "%s[fail]%s %s\n" "$c_red"  "$c_off" "$*" >&2; exit 1; }

require_root() {
  [ "$(id -u)" -eq 0 ] || fail "Run as root (or via sudo)."
}

# ---------- parse args ------------------------------------------------------
MODE=""
DOMAIN=""
EMAIL=""
SANS=()
CERT_IN=""
KEY_IN=""
RENEW=0
OUT="$ROOT/tls"

while [ $# -gt 0 ]; do
  case "$1" in
    --mode)   MODE="$2"; shift 2 ;;
    --domain) DOMAIN="$2"; shift 2 ;;
    --san)    SANS+=("$2"); shift 2 ;;
    --email)  EMAIL="$2"; shift 2 ;;
    --cert)   CERT_IN="$2"; shift 2 ;;
    --key)    KEY_IN="$2"; shift 2 ;;
    --renew)  RENEW=1; shift ;;
    --out)    OUT="$2"; shift 2 ;;
    -h|--help) sed -n '2,40p' "$0"; exit 0 ;;
    *) fail "Unknown arg: $1 (try --help)" ;;
  esac
done

[ -n "$MODE" ]   || fail "Missing --mode (letsencrypt | self-signed | byo)"
[ -n "$DOMAIN" ] || fail "Missing --domain"

require_root
mkdir -p "$OUT"
chmod 750 "$OUT"

# detect package manager (lazy — only needed for letsencrypt mode)
detect_pkg() {
  if   command -v apt-get >/dev/null 2>&1; then PKG=apt
  elif command -v dnf     >/dev/null 2>&1; then PKG=dnf
  else fail "Unsupported package manager"
  fi
}

# ---------- mode: letsencrypt ----------------------------------------------
do_letsencrypt() {
  [ -n "$EMAIL" ] || fail "--email is required for letsencrypt mode"
  detect_pkg
  log "Installing certbot…"
  case "$PKG" in
    apt) apt-get update -q && DEBIAN_FRONTEND=noninteractive apt-get install -y -q certbot ;;
    dnf) dnf install -y -q certbot ;;
  esac

  # Check port 80 is reachable; warn if web is bound to it
  if ss -tlnp 2>/dev/null | grep -q ':80 '; then
    warn "Port 80 is already in use — stopping any compose web container so certbot --standalone can bind it"
    (cd "$ROOT" && docker compose stop web 2>/dev/null) || true
  fi

  local san_args=()
  for s in "${SANS[@]:-}"; do
    [ -n "$s" ] && san_args+=("-d" "$s")
  done

  log "Requesting cert for $DOMAIN ${SANS[*]:+and ${SANS[*]}}…"
  certbot certonly --standalone --non-interactive --agree-tos \
    --email "$EMAIL" \
    -d "$DOMAIN" "${san_args[@]}" \
    --keep-until-expiring

  local live="/etc/letsencrypt/live/$DOMAIN"
  [ -f "$live/fullchain.pem" ] || fail "certbot did not produce $live/fullchain.pem"

  cp "$live/fullchain.pem" "$OUT/fullchain.pem"
  cp "$live/privkey.pem"   "$OUT/privkey.pem"
  chmod 644 "$OUT/fullchain.pem"
  chmod 600 "$OUT/privkey.pem"
  ok "Installed Let's Encrypt cert into $OUT/"

  if [ "$RENEW" -eq 1 ]; then
    install_renewal_hook
  fi

  # bring web back up if we stopped it
  (cd "$ROOT" && docker compose up -d web 2>/dev/null) || true
}

install_renewal_hook() {
  log "Installing certbot renewal hook + daily timer…"
  mkdir -p /etc/letsencrypt/renewal-hooks/deploy
  cat > /etc/letsencrypt/renewal-hooks/deploy/taskmaster.sh <<EOF
#!/usr/bin/env bash
# Auto-installed by provision-tls.sh — copies renewed certs into the
# TaskMaster on-prem repo and reloads the web container.
set -e
LIVE="/etc/letsencrypt/live/$DOMAIN"
OUT="$OUT"
cp "\$LIVE/fullchain.pem" "\$OUT/fullchain.pem"
cp "\$LIVE/privkey.pem"   "\$OUT/privkey.pem"
chmod 600 "\$OUT/privkey.pem"
cd "$ROOT" && docker compose kill -s HUP web 2>/dev/null || \
              docker compose restart web
EOF
  chmod +x /etc/letsencrypt/renewal-hooks/deploy/taskmaster.sh

  # Most distros ship a certbot.timer already; enable it.
  if systemctl list-unit-files | grep -q '^certbot.timer'; then
    systemctl enable --now certbot.timer
    ok "Enabled systemd certbot.timer (runs twice daily)"
  else
    # Fallback to cron
    cat > /etc/cron.d/taskmaster-certbot <<'EOF'
0 3 * * * root certbot renew --quiet
EOF
    ok "Installed daily cron job /etc/cron.d/taskmaster-certbot"
  fi
}

# ---------- mode: self-signed ----------------------------------------------
do_self_signed() {
  log "Generating local CA + leaf cert for $DOMAIN…"

  local ca_key="$OUT/ca.key"
  local ca_crt="$OUT/ca.crt"
  local leaf_key="$OUT/privkey.pem"
  local leaf_csr="$OUT/leaf.csr"
  local leaf_crt="$OUT/fullchain.pem"
  local ext="$OUT/leaf.ext"

  # 1) CA (re-use if it already exists so re-runs don't break trust)
  if [ ! -f "$ca_key" ] || [ ! -f "$ca_crt" ]; then
    openssl genrsa -out "$ca_key" 4096 2>/dev/null
    openssl req -x509 -new -nodes -key "$ca_key" -sha256 -days 3650 \
      -subj "/CN=TaskMaster On-Prem CA/O=TaskMaster" \
      -out "$ca_crt"
    ok "Generated new CA: $ca_crt (10 years)"
  else
    ok "Re-using existing CA at $ca_crt"
  fi

  # 2) Leaf key + CSR
  openssl genrsa -out "$leaf_key" 2048 2>/dev/null
  openssl req -new -key "$leaf_key" -out "$leaf_csr" \
    -subj "/CN=$DOMAIN/O=TaskMaster"

  # 3) SAN extension
  {
    echo "authorityKeyIdentifier=keyid,issuer"
    echo "basicConstraints=CA:FALSE"
    echo "keyUsage = digitalSignature, keyEncipherment"
    echo "extendedKeyUsage = serverAuth"
    echo "subjectAltName = @alt_names"
    echo "[alt_names]"
    echo "DNS.1 = $DOMAIN"
    local i=2
    for s in "${SANS[@]:-}"; do
      [ -n "$s" ] && echo "DNS.$i = $s" && i=$((i+1))
    done
  } > "$ext"

  # 4) Sign leaf cert (825 days = browser max)
  openssl x509 -req -in "$leaf_csr" -CA "$ca_crt" -CAkey "$ca_key" \
    -CAcreateserial -out "$leaf_crt" -days 825 -sha256 -extfile "$ext" \
    2>/dev/null

  # Concatenate CA into the chain so clients that don't trust the CA
  # at the OS level can still validate via the bundled chain.
  cat "$ca_crt" >> "$leaf_crt"

  rm -f "$leaf_csr" "$ext" "$OUT/.srl" "$OUT/ca.srl" 2>/dev/null || true
  chmod 644 "$leaf_crt" "$ca_crt"
  chmod 600 "$leaf_key" "$ca_key"

  ok "Self-signed cert ready: $leaf_crt (825 days)"
  cat <<EOF

  ${c_yel}IMPORTANT — distribute the CA to clients:${c_off}
    $ca_crt

  Browsers/OS will show "untrusted" until you import this CA into:
    • Linux:   sudo cp $ca_crt /usr/local/share/ca-certificates/taskmaster.crt && sudo update-ca-certificates
    • macOS:   sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain $ca_crt
    • Windows: certutil -addstore -f "ROOT" $(basename "$ca_crt")
    • Browser: import as an Authority in Settings → Privacy → Certificates

  For an air-gapped fleet, push the CA via your MDM / GPO.
EOF
}

# ---------- mode: byo (bring your own) -------------------------------------
do_byo() {
  [ -n "$CERT_IN" ] || fail "--cert is required for byo mode"
  [ -n "$KEY_IN"  ] || fail "--key is required for byo mode"
  [ -f "$CERT_IN" ] || fail "Cert file not found: $CERT_IN"
  [ -f "$KEY_IN"  ] || fail "Key file not found: $KEY_IN"

  # Sanity-check: key matches cert
  local cert_mod key_mod
  cert_mod=$(openssl x509 -noout -modulus -in "$CERT_IN" | openssl md5)
  key_mod=$(openssl rsa  -noout -modulus -in "$KEY_IN"  2>/dev/null | openssl md5) \
    || key_mod=$(openssl pkey -in "$KEY_IN" -pubout 2>/dev/null | openssl md5)
  if [ "$cert_mod" != "$key_mod" ]; then
    warn "Cert and key moduli do not match — they may not be a pair. Continuing anyway."
  fi

  # Sanity-check: cert covers the domain
  if ! openssl x509 -in "$CERT_IN" -noout -text \
       | grep -E "DNS:|CN ?=" | grep -q "$DOMAIN"; then
    warn "Cert does not appear to cover $DOMAIN (no matching CN/SAN)."
  fi

  cp "$CERT_IN" "$OUT/fullchain.pem"
  cp "$KEY_IN"  "$OUT/privkey.pem"
  chmod 644 "$OUT/fullchain.pem"
  chmod 600 "$OUT/privkey.pem"
  ok "Installed BYO cert into $OUT/"
}

# ---------- run -------------------------------------------------------------
case "$MODE" in
  letsencrypt) do_letsencrypt ;;
  self-signed) do_self_signed ;;
  byo)         do_byo ;;
  *) fail "Unknown --mode '$MODE' (letsencrypt | self-signed | byo)" ;;
esac

# ---------- wire into .env --------------------------------------------------
ENV_FILE="$ROOT/.env"
if [ -f "$ENV_FILE" ]; then
  log "Updating $ENV_FILE: DOMAIN, PUBLIC_URL, TLS_*"
  # Helper: upsert a KEY=VALUE in .env
  upsert() {
    local k="$1" v="$2"
    if grep -q "^${k}=" "$ENV_FILE"; then
      sed -i "s|^${k}=.*|${k}=${v}|" "$ENV_FILE"
    else
      echo "${k}=${v}" >> "$ENV_FILE"
    fi
  }
  upsert DOMAIN          "$DOMAIN"
  upsert PUBLIC_URL      "https://$DOMAIN"
  upsert TLS_CERT_PATH   "/etc/nginx/tls/fullchain.pem"
  upsert TLS_KEY_PATH    "/etc/nginx/tls/privkey.pem"
  ok ".env updated"
else
  warn "$ENV_FILE not found — skipping .env wiring. Run install.sh after copying .env.example."
fi

# ---------- verify ----------------------------------------------------------
log "Cert summary:"
openssl x509 -in "$OUT/fullchain.pem" -noout -subject -issuer -dates \
  | sed 's/^/  /'

# Reload web container if it's running
if (cd "$ROOT" && docker compose ps web 2>/dev/null | grep -q running); then
  log "Reloading web container to pick up new cert…"
  (cd "$ROOT" && docker compose kill -s HUP web 2>/dev/null) || \
    (cd "$ROOT" && docker compose restart web)
  ok "Web container reloaded"
fi

ok "TLS provisioning complete."
