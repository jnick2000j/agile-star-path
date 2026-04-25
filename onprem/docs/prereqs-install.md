# Prerequisites Installation Guide

Step-by-step directions for provisioning the OS, Docker, kernel tuning,
firewall rules, and storage paths that TaskMaster on-prem needs **before**
you run `./scripts/install.sh`.

Two paths:

- [**Path A — Single-host**](#path-a--single-host-evalsmallmediumlarge-a1) (one VM runs everything: Eval, Small, Medium, Large-A1)
- [**Path B — Multi-host**](#path-b--multi-host-large-a2--xlxxlha) (separate VMs for web / db / storage: Large-A2 and beyond)

> Want the full sizing matrix and topology diagrams first?
> See [prerequisites.md](./prerequisites.md) and [scaling-ha.md](./scaling-ha.md).

---

## What the scripts actually do

Whichever path you pick, the prereq script will:

1. Detect your OS (Ubuntu 22.04+, Debian 12+, RHEL/Rocky/Alma 9+) and
   refuse to continue if it's unsupported.
2. Install base packages (`curl`, `openssl`, `jq`, `ca-certificates`,
   `ufw` or `firewalld`, `cron`, `rsync`).
3. Install **Docker Engine 24+** and the **Compose v2** plugin from
   Docker's official repo (skipped if already present).
4. Tune the kernel (`/etc/sysctl.d/99-taskmaster.conf`) and ulimits
   (`/etc/security/limits.d/99-taskmaster.conf`) for Postgres + uploads.
5. Install and enable **chrony** for time sync (critical for JWT and TLS).
6. Create a non-root `taskmaster` (or per-role) Unix user and add it to
   the `docker` group.
7. Configure the firewall (`ufw` or `firewalld`) — opening **only** the
   ports that role needs, and (for multi-host) restricting backend ports
   to the peer IPs you supply.
8. Prepare data directories with correct ownership.

The scripts are **idempotent** — re-running them is safe.

---

## Before you start

You'll need:

- A fresh VM per the [host-sizing table](./prerequisites.md#host-sizing-single-host-topology).
- **Root** (or `sudo`) on each VM.
- The on-prem bundle (or git clone) extracted somewhere on the **app/web**
  VM — typically `/opt/taskmaster`.
- Internet access to `download.docker.com` (for the Docker repo) **or**
  pre-staged offline Docker packages if air-gapped.
- DNS records pointing to your public hostname (web tier) and internal
  hostnames for the db / storage tiers if multi-host.

> **Air-gapped?** Set up an internal apt/dnf mirror of `download.docker.com`
> first, or `dnf download docker-ce docker-ce-cli containerd.io
> docker-compose-plugin docker-buildx-plugin` on a connected jump box and
> copy the RPMs over. Everything else in the script works offline.

---

## Path A — Single-host (Eval/Small/Medium/Large-A1)

One VM runs Postgres, the edge runtime, the web bundle, auth, realtime,
and stores uploads on the local filesystem.

### Step 1 — Get the bundle onto the VM

```bash
sudo mkdir -p /opt/taskmaster
sudo chown $USER /opt/taskmaster
# either git clone, or scp/extract the release tarball:
tar -xzf taskmaster-onprem-vX.Y.Z.tar.gz -C /opt/taskmaster --strip-components=1
cd /opt/taskmaster
```

### Step 2 — Run the prerequisites script

```bash
sudo ./scripts/prereqs-single-host.sh
```

You should see green `[ ok ]` lines for OS detection, package install,
Docker, kernel tuning, user creation, and firewall rules. The script
ends with a "Next steps" block.

### Step 3 — Provision TLS certificates

Use the `provision-tls.sh` helper. Pick **one** of three modes:

```bash
# (A) Public domain, internet-reachable on port 80 — Let's Encrypt + auto-renew
sudo ./scripts/provision-tls.sh --mode letsencrypt \
    --domain $DOMAIN --email ops@example.com --renew

# (B) Air-gapped or internal-only — generate a local CA + leaf cert
sudo ./scripts/provision-tls.sh --mode self-signed --domain $DOMAIN

# (C) Bring your own enterprise PKI / wildcard cert
sudo ./scripts/provision-tls.sh --mode byo --domain $DOMAIN \
    --cert /tmp/wildcard.example.com.pem \
    --key  /tmp/wildcard.example.com.key
```

The script writes `tls/fullchain.pem` + `tls/privkey.pem`, sets the right
permissions, updates `DOMAIN`/`PUBLIC_URL`/`TLS_*` in `.env`, and reloads
the `web` container if it's running. For self-signed mode, it also prints
the CA path (`tls/ca.crt`) and the exact OS-trust import commands —
distribute that CA to clients (browser, MDM, GPO) or they'll see an
"untrusted" warning.

For Let's Encrypt, `--renew` installs a deploy hook that automatically
copies renewed certs into `tls/` and HUPs the web container — no manual
intervention needed every 90 days.

### Step 4 — Configure `.env`

```bash
cd /opt/taskmaster
sudo -u taskmaster cp .env.example .env
sudo -u taskmaster $EDITOR .env
```

Minimum required values:

```dotenv
DOMAIN=taskmaster.example.com
PUBLIC_URL=https://taskmaster.example.com
POSTGRES_PASSWORD=<generate with: openssl rand -hex 32>
LICENSE_KEY=<from your account team>
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM=taskmaster@example.com
STORAGE_DRIVER=file
STORAGE_PATH=/var/lib/storage
```

### Step 5 — Re-login (or `newgrp docker`)

The `taskmaster` user was added to the `docker` group, but the membership
only takes effect on the next login.

```bash
sudo su - taskmaster   # or: newgrp docker
```

### Step 6 — Run the installer

```bash
cd /opt/taskmaster
./scripts/install.sh
```

When it finishes, browse to `https://$DOMAIN` and sign in as the
bootstrap admin (credentials printed at the end of `install.sh`).

---

## Path B — Multi-host (Large-A2 / XL/XXL/HA)

Three (or more) VMs, one role each. The script must run on **every** VM,
once, with the right `--role` flag.

> **Recommended hostnames** (used throughout the docs):
> `app1.internal`, `app2.internal`, `db.internal`, `minio.internal`.

### Step 0 — Lock down the network first

Before you run anything, decide:

- Which VMs are **app/web** nodes? (They terminate TLS and talk out to db + storage.)
- Which VM is the **db** node? Note its hostname/IP.
- Which VM(s) are the **storage** nodes? Note their hostname(s)/IP(s).

You'll pass the **peer list** (the IPs/hostnames that should be allowed
to connect *into* this VM) to the script — anything not in the list will
be blocked at the firewall.

### Step 1 — Provision the **db** node

```bash
# On db.internal:
sudo ./scripts/prereqs-multi-host.sh \
    --role db \
    --peers app1.internal,app2.internal
```

This installs Docker, tunes the kernel for Postgres, opens **5432/tcp
only** to `app1` and `app2`, and prepares `/var/lib/taskmaster/pgdata`
with the right ownership for the Postgres container image.

Then start Postgres on this VM:

```bash
# Copy docker-compose.db.yml + a minimal .env to /opt/taskmaster on this host
cd /opt/taskmaster
docker compose -f docker-compose.db.yml up -d
```

Set up backups (see [backup-runbook.md](./backup-runbook.md)).

### Step 2 — Provision the **storage** node(s)

```bash
# On minio.internal (single-node):
sudo ./scripts/prereqs-multi-host.sh \
    --role storage \
    --peers app1.internal,app2.internal
```

For the **distributed 4-node MinIO cluster**, run the same command on
each of the four nodes, listing the **app nodes** as peers (not the
other MinIO nodes — those are handled inside `docker-compose` by the
MinIO image itself).

Then start MinIO:

```bash
cd /opt/taskmaster
# Single node:
docker compose -f docker-compose.minio.yml up -d
# Or 4-node cluster: follow onprem/docs/minio-cluster.md
```

Note the `S3_ACCESS_KEY` / `S3_SECRET_KEY` printed by the bootstrap
container — you'll paste them into the web nodes' `.env`.

### Step 3 — Provision each **web/app** node

```bash
# On app1.internal (and app2.internal, etc.):
sudo ./scripts/prereqs-multi-host.sh \
    --role web \
    --peers <load-balancer-ip-if-any>
```

This installs Docker, opens **80/443/22** publicly, and creates the
`taskmaster` Unix user + `/var/lib/taskmaster/{logs,backups}`.

> If you're terminating TLS at an external L7 load balancer, you can
> skip opening 443 — pass `--peers <lb-ip>` and only allow that
> upstream's IP through.

### Step 4 — Configure `.env` on **each web node**

```dotenv
DOMAIN=taskmaster.example.com
PUBLIC_URL=https://taskmaster.example.com
LICENSE_KEY=<same key on every web node>

# Tell the app NOT to start its own Postgres
DB_EMBEDDED=false
POSTGRES_HOST=db.internal
POSTGRES_PORT=5432
POSTGRES_PASSWORD=<same as db node>

# Switch storage to S3-compatible
STORAGE_DRIVER=s3
S3_ENDPOINT=https://minio.internal:9000
S3_BUCKET=taskmaster
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
S3_ACCESS_KEY=<from bootstrap output>
S3_SECRET_KEY=<from bootstrap output>

# SMTP (same on all web nodes)
SMTP_HOST=...
```

### Step 5 — Provision TLS on each web node

Run `provision-tls.sh` on **each** app/web node. Use the same `--domain`
everywhere; if individual nodes also have their own internal hostnames,
add them as `--san`.

```bash
# Public Let's Encrypt (each node temporarily binds :80 for the challenge)
sudo ./scripts/provision-tls.sh --mode letsencrypt \
    --domain taskmaster.example.com --email ops@example.com --renew

# OR — TLS terminated at LB, internal traffic uses self-signed
sudo ./scripts/provision-tls.sh --mode self-signed \
    --domain taskmaster.example.com \
    --san app1.internal --san app2.internal

# OR — enterprise wildcard cert distributed to each node
sudo ./scripts/provision-tls.sh --mode byo \
    --domain taskmaster.example.com \
    --cert /opt/secrets/wildcard.pem --key /opt/secrets/wildcard.key
```

> **TLS-terminating load balancer?** If your L7 LB (HAProxy, Nginx,
> AWS ALB, F5) terminates TLS and re-encrypts to the backends, run
> `--mode self-signed` on each web node and import the generated
> `tls/ca.crt` into the LB's trust store. The public cert lives only
> on the LB.

> **MinIO TLS (storage node).** The storage role doesn't run the web
> container, but MinIO itself needs a cert when used over HTTPS. Run
> the same script on the storage VM — it produces certs in `./tls/`,
> which `docker-compose.minio.yml` mounts at `/root/.minio/certs/`.
> See [minio-cluster.md](./minio-cluster.md#tls).

### Step 6 — Bring up the app stack on each web node

```bash
cd /opt/taskmaster
sudo su - taskmaster
docker compose -f docker-compose.yml --profile=app-only up -d
```

The `app-only` profile excludes the `db` service (which now lives on
`db.internal`) and the local-FS storage volume.

### Step 7 — Front them with a load balancer

Point your L4 or L7 LB at port 443 of each web node. Health-check path
is `/functions/v1/health` (returns `{ok: true}` when the node can reach
both DB and storage).

See [scaling-ha.md](./scaling-ha.md) for HAProxy / Nginx examples.

---

## Verifying the prereqs

After the script finishes, confirm each VM is ready:

```bash
docker --version                 # >= 24
docker compose version           # v2.x
sysctl vm.swappiness             # = 10
ulimit -n                        # >= 65536 (after re-login)
systemctl is-active chronyd      # active
sudo ufw status                  # or: firewall-cmd --list-all
```

For multi-host, from a **web node** verify you can reach the others:

```bash
nc -zv db.internal 5432
nc -zv minio.internal 9000
```

If either fails, check the `--peers` list you passed to the db/storage
script — that IP must be included.

---

## Common issues

| Symptom | Likely cause | Fix |
|---|---|---|
| `docker: permission denied` after install | User wasn't re-logged in | `newgrp docker` or `sudo su - taskmaster` |
| `pg_isready: connection refused` from web node | DB firewall didn't include this peer | Re-run db prereqs with the correct `--peers` |
| MinIO uploads fail with `403 Forbidden` | Bootstrap policy not attached | Check `docker logs minio-bootstrap` |
| `chronyd` shows large offset | NTP blocked outbound | Allow UDP 123 outbound or point chrony at an internal NTP |
| `install.sh` warns "<4GB RAM" | Under-provisioned VM | Resize before installing |
| Browser shows "NET::ERR_CERT_AUTHORITY_INVALID" | Self-signed CA not imported on client | Distribute `tls/ca.crt` to the OS/browser trust store (see script output) |
| `certbot: port 80 already in use` | Web container is bound to :80 | Script auto-stops it; if it fails, run `docker compose stop web` first |
| Cert expired / not auto-renewing | `--renew` was not passed | Re-run `provision-tls.sh --mode letsencrypt … --renew` |

---

## Uninstall / re-provision

The prereq scripts only **add** packages and config — they don't
uninstall. If you want to start from a clean VM:

```bash
sudo docker compose down -v             # destroy containers + volumes
sudo apt-get purge docker-ce docker-ce-cli containerd.io \
    docker-compose-plugin docker-buildx-plugin
sudo rm -rf /var/lib/docker /var/lib/taskmaster /var/lib/minio
sudo rm /etc/sysctl.d/99-taskmaster.conf \
        /etc/security/limits.d/99-taskmaster.conf
```

Then re-run the prereqs script.
