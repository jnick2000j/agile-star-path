# Upgrade

TaskMaster on-prem uses **versioned signed bundles**. Each release is a single
tarball containing pre-built images, ordered SQL migrations, the web bundle,
and a signed manifest.

## Connected sites

```bash
cd /opt/taskmaster
./scripts/pimp-cli download v1.4.0
./scripts/pimp-cli verify   v1.4.0
./scripts/pimp-cli upgrade  v1.4.0
```

## Air-gapped sites

1. On a machine with internet, download `taskmaster-v1.4.0.tar.gz` and
   `taskmaster-v1.4.0.tar.gz.sig`.
2. Transfer both files to the install host (USB, internal mirror, etc.).
3. Place them under `bundles/`:
   ```
   bundles/
   └── v1.4.0.tar.gz
   └── v1.4.0.tar.gz.sig
   ```
4. Then:
   ```bash
   tar -xzf bundles/v1.4.0.tar.gz -C bundles/v1.4.0
   ./scripts/pimp-cli verify  v1.4.0
   ./scripts/pimp-cli upgrade v1.4.0
   ```

## What `upgrade.sh` does

1. **Verify** the bundle signature against `keys/release.pub.pem`.
2. **Pre-flight**: check disk space, DB reachability, version chain.
3. **Backup**: `pg_dump` to `backups/pre-vX.Y.Z-<timestamp>.sql.gz`.
4. **Load** new images via `docker load`.
5. **Migrate**: apply only SQL files not already in `public.schema_version`.
6. **Swap** the static web bundle.
7. **Restart** `edge`, `web`, `kong` with the new `IMAGE_TAG`.
8. **Health gate**: poll `healthcheck.sh` for up to 2 minutes. If anything
   fails, automatically run `rollback.sh`.

## Rollback

Manual rollback at any time:

```bash
./scripts/pimp-cli rollback
```

This restores the most recent pre-upgrade DB snapshot and re-pins the previous
`IMAGE_TAG`. Note: rollback restores DB state to the moment **before** the
last upgrade. Any data created since the upgrade will be lost — restore from
a full backup if you need a different point in time.

## Rolling upgrades (multi-host / HA topologies)

If you are running Topology B or C (see [scaling-ha.md](./scaling-ha.md)),
the upgrade flow uses the same bundle but is applied differently to
avoid downtime:

1. **DB migrations first**, against the Postgres primary, from any one
   app host:
   ```bash
   ./scripts/pimp-cli migrate v1.4.0
   ```
   Migrations are written to be backward-compatible with the previous
   app version (the N / N-1 rule), so existing app hosts keep serving
   traffic during and after migration.

2. **Drain & upgrade each app host**, one at a time:
   ```bash
   # On the LB: mark host out of rotation
   # On the host:
   ./scripts/pimp-cli upgrade v1.4.0 --skip-migrate --skip-backup
   # Wait for /healthz to return 200, then re-add to LB
   ```

3. **Repeat** for each app host. With ≥ 2 app hosts behind the LB this
   yields a zero-downtime upgrade.

4. For Patroni-managed Postgres major-version upgrades, follow the
   Patroni rolling upgrade procedure (replicas first, then a controlled
   switchover) — never run `pg_upgrade` against the primary directly.

## Skipping versions

A bundle's `manifest.json` declares `min_previous_version`. If your installed
version is older, `upgrade.sh` will refuse and ask you to upgrade
incrementally. We support a 3-version skip range; older installs need to step
through intermediate releases.

## Update channels

Set `UPDATE_CHANNEL` in `.env` to:

- `stable` — recommended for production (default)
- `beta`   — early access, recommended for staging
- `lts`    — long-term-support, slower cadence, only critical fixes

Channel only affects `pimp-cli download` defaults. `pimp-cli download v1.4.0`
always works regardless of channel.

## Notable schema additions in recent releases

These tables/triggers are added by ordered migrations in the bundle and need
no manual action — they are listed here for operators auditing the diff:

| Migration introduces                       | Purpose |
|--------------------------------------------|---------|
| `organization_module_toggles`              | Per-org enable/disable for Problem Mgmt, CMDB, Service Catalog, Status Page, MIM |
| `service_catalog_categories.icon`          | Lucide icon name shown in catalog browse |
| `service_catalog_item_tasks`               | Predefined ordered fulfillment tasks per catalog item |
| `helpdesk_spawn_next_catalog_task` fn      | Spawns next sequential child ticket |
| `trg_helpdesk_catalog_task_close` trigger  | Fires next task when prior is resolved/closed |
| `lms_*` tables + `lms_recompute_enrollment` fn | Optional LMS add-on — courses, lessons, quizzes, enrollments, certificates, vector chunks. See [features.md → LMS](./features.md#learning-management-lms--optional-add-on). |
| `lms-content` and `lms-certificates` storage buckets | Auto-created by the MinIO bootstrap. **External-S3 operators**: create both buckets and re-attach the IAM policy before enabling the LMS module — see [object-storage.md](./object-storage.md). |

If you maintain custom RLS or BI views over `service_catalog_*` or
`helpdesk_tickets`, re-validate after upgrading — the catalog-task workflow
writes `metadata->>catalog_task_id` and `parent_ticket_id` on child tickets.

