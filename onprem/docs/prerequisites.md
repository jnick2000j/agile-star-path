# Prerequisites

## Host sizing (single-host topology)

> **Container layout (always true):** Postgres runs in its **own
> container** (`db` service in `docker-compose.yml`) — never inside the
> `edge` or `web` container. The question at each tier is only whether
> that container runs on the **same VM** as the rest of the stack, or
> on its **own VM**.
>
> **"S3" below = any S3-compatible object store** (AWS S3, on-prem
> **MinIO**, Ceph RGW, Wasabi, etc.). AWS itself is never required.
> See [scaling-ha.md §4.3](./scaling-ha.md#43-storage--when-and-why-you-need-object-storage)
> for why and when to switch off the local-disk default.

| Tier      | Users     | vCPU | RAM   | Disk  | Postgres placement                         | Uploads (default → recommended)        |
|-----------|-----------|------|-------|-------|--------------------------------------------|----------------------------------------|
| Eval      | <10       | 2    | 4 GB  | 20 GB | Same VM, same compose stack                | Local FS                               |
| Small     | 10–100    | 4    | 8 GB  | 50 GB | Same VM, same compose stack                | Local FS                               |
| Medium    | 100–500   | 8    | 16 GB | 200 GB| Same VM, same compose stack                | Local FS (S3 if uploads are heavy)     |
| Large (A1)| 500–1,200 | 16   | 32 GB | 500 GB| **Same VM**, same compose stack (co-located)| Local FS works; S3 if uploads > ~200 GB|
| Large (A2)| 1,200–2,000| app: 12 / 24 GB; db: 8 / 32 GB | 100 GB app + 500 GB db | **Separate VM** for Postgres (still single node, no replica) | **S3 recommended** (simpler backup/DR) |

**Why split into A1 vs A2?** At the lower end of "Large" (≤ ~1,200 users)
co-locating Postgres on the same VM is fine — it's one `docker compose up`
and one host to operate. Past that point, Postgres and the app start
competing for CPU and page cache, and you should move the `db` container
to its own VM (`DB_EMBEDDED=false` + `POSTGRES_HOST=db.internal` in `.env`)
**before** you reach 2,000 users. Both A1 and A2 are still **Topology A**
(single app host, no HA).

> **Beyond 2,000 users or need HA?** Even with Postgres on its own VM,
> a single app host tops out around 2,000 concurrent users and is **not**
> highly available. For larger or HA deployments, add app hosts behind
> an L7 LB, add a Postgres replica (or move to a Patroni cluster), and
> use S3-compatible object storage. See [scaling-ha.md](./scaling-ha.md)
> for reference topologies, per-tier sizing, and the operational checklist.

### Quick sizing for scaled topologies

| Tier          | Users      | Topology | App hosts | Postgres                  | Storage       |
|---------------|------------|----------|-----------|---------------------------|---------------|
| XL            | 2k–5k      | B        | 2         | dedicated VM + 1 replica  | S3 / MinIO    |
| XXL           | 5k–10k     | B        | 3–4       | dedicated VM + 2 replicas + PgBouncer | S3 / MinIO |
| HA / Multi-AZ | 10k+       | C        | 4+ across AZs | Patroni 3-node cluster | S3 multi-AZ  |

Per app host (Topology B/C): 8 vCPU / 16 GB / 50 GB.
Per DB node (Topology C):    16 vCPU / 64 GB / 1 TB NVMe.

## OS

- Linux x86_64 (Ubuntu 22.04+, RHEL 9+, Debian 12+)
- Docker Engine 24+
- Docker Compose v2 (built-in `docker compose`, not the legacy `docker-compose`)

## Network

| Port | Direction | Purpose                            |
|------|-----------|------------------------------------|
| 80   | inbound   | Redirect to 443                    |
| 443  | inbound   | HTTPS for the web UI + API gateway |
| 25/465/587 | outbound | SMTP relay                    |

The host should resolve `DOMAIN` (set in `.env`) to its public IP.

## TLS

Place a certificate chain at `onprem/tls/fullchain.pem` and key at
`onprem/tls/privkey.pem`. The `web` container picks them up automatically.

For Let's Encrypt:

```bash
certbot certonly --standalone -d $DOMAIN
cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem onprem/tls/
cp /etc/letsencrypt/live/$DOMAIN/privkey.pem   onprem/tls/
```

## SMTP

You must supply SMTP credentials before installing — invites, password resets,
and MFA challenges all require email delivery. See [smtp.md](./smtp.md).

## Module footprint

These tables are always created but only consume meaningful rows when the
matching module is enabled in **Helpdesk → Admin → Modules** (per org) or
**Platform Admin → Module Toggles** (global override):

| Module                  | Tables that grow when enabled |
|-------------------------|-------------------------------|
| Service Catalog         | `service_catalog_*` (categories, items, fields, tasks, requests, approvals) |
| Problem Management      | `problems`, `problem_known_errors` |
| CMDB                    | `cmdb_items`, `cmdb_relationships` |
| Status Page             | `status_page_components`, `status_page_incidents` |
| Major Incident Mgmt     | `major_incidents`, `major_incident_updates` |

A 4 vCPU / 8 GB host comfortably runs all five modules at small/medium
volumes. For >100 service-catalog requests/day or >50 active major incidents,
plan for the next sizing tier in [scaling-ha.md](./scaling-ha.md).
