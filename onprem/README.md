# TaskMaster — On-Premises Installer

This directory contains everything needed to install, run, upgrade, and back up
TaskMaster on customer-controlled infrastructure (single host, air-gapped or
internet-connected).

> Looking for the user-facing manual? See [`docs/`](./docs/README.md). This
> README is for the engineer or operator standing up the install.

## Layout

```
onprem/
├── README.md                  ← you are here
├── docker-compose.yml         ← runtime services (Postgres, edge runtime, web, gateway)
├── .env.example               ← required configuration (copy to .env and fill in)
├── seed/
│   ├── 01_ai_provider.sql     ← default to local Ollama
│   ├── 02_smtp_settings.sql   ← default SMTP placeholder rows
│   └── 03_first_admin.sql     ← creates the bootstrap platform admin
├── scripts/
│   ├── install.sh             ← one-shot first-time install
│   ├── upgrade.sh             ← versioned-bundle upgrade (Option 2 from plan)
│   ├── rollback.sh            ← restore previous DB + image tags
│   ├── backup.sh              ← pg_dump + uploads tarball
│   ├── restore.sh             ← restore from a backup tarball
│   ├── pimp-cli               ← thin wrapper around download/verify/upgrade
│   └── healthcheck.sh         ← probes /functions/v1/health and DB
├── docs/                      ← customer-facing documentation
└── bundles/                   ← release tarballs land here (gitignored)
```

## Quick start

```bash
cp .env.example .env
# fill in DOMAIN, POSTGRES_PASSWORD, JWT_SECRET, SMTP_*, LICENSE_KEY
./scripts/install.sh
```

The installer will:

1. Validate prerequisites (Docker, Compose v2, ≥4 GB RAM, ≥20 GB disk).
2. Generate any missing secrets (`JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`).
3. Pull or `docker load` the bundled images.
4. Run all SQL migrations in order against the bundled Postgres.
5. Seed default rows (AI provider = Ollama, SMTP placeholders, first admin).
6. Validate the supplied license against the embedded public key.
7. Start the stack and wait for `healthcheck.sh` to return 200.

## Upgrades

```bash
./scripts/pimp-cli download v1.4.0      # or copy the bundle in by sneakernet
./scripts/pimp-cli verify   v1.4.0
./scripts/pimp-cli upgrade  v1.4.0      # backup → migrate → swap → smoke-test
```

If `healthcheck.sh` fails, the upgrade aborts and `rollback.sh` runs
automatically. See [`docs/upgrade.md`](./docs/upgrade.md) for details.

## Air-gapped installs

Everything in a release tarball is self-contained — no outbound network calls
are required at install or upgrade time. Outbound telemetry is opt-in (see the
`allow_outbound_telemetry` org setting).
