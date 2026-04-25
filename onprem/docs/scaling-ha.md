# Scaling & High Availability

This guide covers scaling TaskMaster on-prem **beyond the default
single-host deployment** (which tops out around 2,000 active users) and
making it **highly available** so that a single host, disk, or AZ
failure does not take the platform down.

It is the operator-facing companion to [architecture.md](./architecture.md)
and [prerequisites.md](./prerequisites.md).

---

## 1. When to scale out

The bundled single-host `docker compose` stack is sized for up to
**~2,000 concurrent authenticated users** on the **Large** tier
(16 vCPU / 32 GB / 500 GB SSD, Postgres co-located, S3 for uploads).

Scale out when **any** of the following is true:

| Trigger                                                  | What it means                                           |
|----------------------------------------------------------|---------------------------------------------------------|
| > 2,000 concurrent users or > 10,000 named users         | Single host CPU / connection pool saturation            |
| Postgres CPU sustained > 70% or `db-data` > 250 GB       | DB needs its own host (and likely a replica)            |
| Edge function p95 latency > 1.5 s under normal load      | `edge` (Deno) is CPU-bound — needs horizontal scaling   |
| Realtime channel count > 5,000 or fan-out lag > 2 s      | `realtime` needs its own host(s)                        |
| RPO < 1 hour or RTO < 15 min required                    | You need streaming replication + automated failover     |
| Compliance requires no single point of failure           | You need full HA (multi-host, multi-AZ)                 |
| Local LLM (Ollama) used by > 50 concurrent users         | GPU host(s) must be split off and load-balanced         |

If **none** of these apply, stay on the single-host stack. It is far
simpler to operate, back up, and upgrade.

---

## 2. Reference topologies

We support three documented topologies. Pick the smallest one that meets
your scale and availability targets.

### 2.1 Topology A — Single app host (default, ≤ 2,000 users)

Two co-located variants, both still "Topology A":

**A1 — fully co-located (Eval / Small / Medium / Large ≤ ~1,200 users)**

```
                ┌──────────────────────────────────┐
                │  Host 1 (16 vCPU / 32 GB)        │
   Users ──► LB │  web · kong · auth · edge ·      │
                │  realtime · storage · db · ollama│
                │  (all containers, one VM)        │
                └──────────────────────────────────┘
```

**A2 — Postgres split off (Large, ~1,200–2,000 users)**

```
                ┌──────────────────────────────┐         ┌────────────────────────┐
                │  App VM (12 vCPU / 24 GB)    │         │  DB VM (8 vCPU / 32 GB)│
   Users ──► LB │  web · kong · auth · edge ·  │ ──────► │  db (Postgres 15)      │
                │  realtime · storage · ollama │  5432   │  /var/lib/postgresql   │
                └──────────────────────────────┘         └────────────────────────┘
```

In both A1 and A2:

- Postgres always runs in its **own container** (`db` service). The
  difference is only **which VM** that container runs on.
- A2 is enabled by setting `DB_EMBEDDED=false` and pointing
  `POSTGRES_HOST` at the DB VM in `.env`. The `db` container then runs
  via a small `docker-compose.db.yml` on the DB VM (or you can use a
  managed Postgres 15 service).
- Backups via nightly `pg_dump` + uploads tarball (run on the DB VM in A2).
- **Not** highly available — loss of either VM = outage.

### 2.2 Topology B — Split DB + horizontally scaled app tier (2k–10k users)

```
                       ┌────────────────────┐
                       │  App host 1        │  web · kong · auth ·
                       │                    │  edge · realtime · storage
                       └─────────┬──────────┘
   Users ──► LB (L7) ──┤         │
                       │         ▼
                       │   ┌──────────────────────────┐
                       │   │  Postgres primary        │
                       │   │  (dedicated VM, 16+ vCPU)│
                       │   └──────────┬───────────────┘
                       │              │ streaming replication
                       │              ▼
                       │   ┌──────────────────────────┐
                       │   │  Postgres replica (read) │
                       │   └──────────────────────────┘
                       │
                       └─► App host 2 (identical)
                          App host N …

   Object storage: S3 / MinIO cluster (shared)
   GPU pool:       1–N Ollama hosts behind LB (optional)
```

- **App hosts**: 2+ identical hosts running `web`, `kong`, `auth`,
  `edge`, `realtime`, `storage`. Stateless — safe to add/remove.
- **Postgres**: dedicated VM (or managed Postgres 15). One primary,
  one or more streaming replicas.
- **Object storage**: S3-compatible (AWS S3, MinIO cluster, Ceph RGW)
  shared by all app hosts. **Required** once `storage` runs on more
  than one host.
- **Load balancer**: any L7 LB with sticky sessions for `realtime`
  WebSockets (HAProxy, NGINX, AWS ALB, GCP LB).

This topology survives the loss of **one app host**. Postgres failover
is still manual unless you add Patroni (see §4).

### 2.3 Topology C — Full HA (10k+ users, multi-AZ)

```
            ┌──────────────────────────────────────────────────┐
            │                Global LB (anycast / DNS)         │
            └────────────┬───────────────────────┬─────────────┘
                         │                       │
                ┌────────▼────────┐     ┌────────▼────────┐
                │  AZ-A           │     │  AZ-B           │
                │  App hosts × N  │     │  App hosts × N  │
                │  Ollama × M     │     │  Ollama × M     │
                └────────┬────────┘     └────────┬────────┘
                         │                       │
                  ┌──────▼───────────────────────▼──────┐
                  │  Postgres cluster (Patroni + etcd)  │
                  │  primary (AZ-A) + sync replica (B)  │
                  │  + async replicas for read scaling  │
                  └────────────────────┬────────────────┘
                                       │
                              ┌────────▼─────────┐
                              │  S3 / MinIO      │
                              │  (multi-AZ)      │
                              └──────────────────┘
```

- App tier: 4+ hosts split across AZs, autoscaled.
- Postgres: **Patroni**-managed cluster with synchronous replication
  across AZs and automatic failover via etcd/Consul.
- Storage: S3 with cross-AZ replication, or MinIO in distributed mode
  (≥ 4 nodes, erasure-coded).
- LB: global L7 with health checks per AZ; drains an AZ on failure.
- Survives loss of an entire AZ. RPO ≈ 0, RTO < 60 s.

---

## 3. Do I need a separate Postgres VM?

**Short answer:** yes, once you cross ~500 active users *or* you need HA.

| Situation                                   | DB placement                          |
|---------------------------------------------|---------------------------------------|
| Eval / Small / Medium tier                  | Co-located in the compose stack       |
| Large tier (500–2,000 users)                | **Dedicated VM** (still single node)  |
| Topology B (2k–10k)                         | **Dedicated VM** + 1 read replica     |
| Topology C (10k+ or HA required)            | **Patroni cluster**, ≥ 3 nodes        |

Reasons to split Postgres off even before you hit the user threshold:

1. **Backups don't pause the app** — `pg_basebackup` / snapshots run on
   the DB host without freezing edge workloads.
2. **Independent upgrade cadence** — you can patch Postgres without
   rebuilding the app stack, and vice versa.
3. **Right-sized hardware** — DB benefits from fast NVMe + lots of RAM;
   app hosts benefit from CPU. Splitting lets you tune each.
4. **Connection pooling** — once on a dedicated DB host, put **PgBouncer**
   in front (transaction pooling, `default_pool_size = 25` per app host)
   to keep Postgres connection count sane as you scale app hosts.

To switch from co-located to external Postgres:

```bash
# 1. Stop the stack
docker compose down

# 2. Dump from the bundled db
docker compose run --rm db pg_dumpall -U postgres > /tmp/all.sql

# 3. Restore into the external Postgres 15 instance
psql -h db.internal -U postgres -f /tmp/all.sql

# 4. Point the stack at it (in .env)
POSTGRES_HOST=db.internal
POSTGRES_PORT=5432
POSTGRES_PASSWORD=...
DB_EMBEDDED=false        # disables the bundled db service

# 5. Start app-only services
docker compose up -d web kong auth edge realtime storage
```

---

## 4. Making each tier highly available

### 4.1 App tier (`web`, `kong`, `auth`, `edge`, `realtime`, `storage`)

All app-tier services are **stateless** as long as:

- `storage` uses S3 / MinIO (not the local `storage-data` volume).
- `realtime` clients use sticky sessions on the LB (cookie or IP hash).

Recommended:

- ≥ 2 app hosts, behind an L7 LB with `/healthz` checks on `kong`.
- Rolling deploys: drain one host, upgrade, re-add, repeat.
- Set `EDGE_REPLICAS` per host based on CPU (default: `vCPU - 1`).

### 4.2 Postgres HA with Patroni

We ship a reference Patroni compose file at
`onprem/ha/patroni/docker-compose.yml`. It runs:

- 3 × Postgres 15 nodes (1 primary + 2 replicas, sync to the closest)
- 3 × etcd nodes for leader election
- HAProxy fronting the cluster on `:5432` (writes) and `:5433` (reads)

Failover is automatic and typically completes in **20–40 seconds**.
Point the app tier at the HAProxy VIP, not at any individual node.

### 4.3 Storage HA

| Backend           | HA story                                                  |
|-------------------|-----------------------------------------------------------|
| Local FS (default)| Not HA. Single host only.                                 |
| AWS S3            | Inherently HA (11 9s durability).                         |
| MinIO distributed | ≥ 4 nodes, erasure-coded, survives `(N/2)-1` node loss.   |
| Ceph RGW          | HA via Ceph cluster. Heavier to operate.                  |

Set in `.env`:

```bash
STORAGE_DRIVER=s3
STORAGE_S3_ENDPOINT=https://minio.internal:9000
STORAGE_S3_BUCKET=taskmaster
STORAGE_S3_REGION=us-east-1
```

### 4.4 Realtime

`realtime` is horizontally scalable but **stateful per WebSocket
connection**. Use sticky sessions on the LB (e.g. HAProxy
`balance source` or NGINX `ip_hash`). Each realtime instance subscribes
to Postgres logical replication independently — no cross-instance
coordination is required.

### 4.5 AI / Ollama

Ollama is GPU-bound. For HA + scale:

- Run ≥ 2 Ollama hosts, each with the same model set pre-pulled.
- Front them with NGINX or HAProxy (`balance leastconn`) on `:11434`.
- Set `OLLAMA_BASE_URL=http://ollama-lb.internal:11434` in the app `.env`.
- For mixed workloads, route embedding requests (`/api/embeddings`) to
  CPU-only hosts and chat requests (`/api/chat`) to GPU hosts.

### 4.6 SMTP

Use a redundant relay (two MX hosts, or a managed provider like SES /
SendGrid / Postmark). The app retries failed sends with exponential
backoff via the `notification-dispatcher` edge function.

---

## 5. Sizing reference (extended)

| Tier         | Users      | Topology | App hosts | DB                       | Storage       |
|--------------|------------|----------|-----------|--------------------------|--------------- |
| Eval         | < 10       | A1       | 1         | container, **same VM**   | local FS      |
| Small        | 10–100     | A1       | 1         | container, **same VM**   | local FS      |
| Medium       | 100–500    | A1       | 1         | container, **same VM**   | local FS / S3 |
| Large (low)  | 500–1,200  | A1       | 1 (16 vCPU)| container, **same VM**  | S3            |
| Large (high) | 1,200–2,000| A2       | 1 (12 vCPU)| container, **own VM** (single node) | S3 |
| XL           | 2k–5k      | B        | 2         | dedicated VM + 1 replica | S3 / MinIO    |
| XXL          | 5k–10k     | B        | 3–4       | dedicated VM + 2 replicas + PgBouncer | S3 / MinIO |
| HA / Multi-AZ| 10k+       | C        | 4+ across AZs | Patroni 3-node cluster | S3 multi-AZ  |

Per-app-host sizing in Topology B/C: **8 vCPU / 16 GB / 50 GB**.
Per-DB-node sizing in Topology C: **16 vCPU / 64 GB / 1 TB NVMe**.

---

## 6. Observability for scaled deployments

Once you are past Topology A, ship metrics off-host:

- **Postgres**: `postgres_exporter` → Prometheus, with alerts on
  replication lag, connection count, `pg_stat_activity` long queries.
- **App hosts**: `cadvisor` + `node_exporter`.
- **Edge functions**: each function logs a structured JSON line per
  invocation; ship via Vector / Fluent Bit to Loki / ELK.
- **LB**: 4xx/5xx rate per upstream + p95 latency.

Recommended SLOs:

| Signal                        | Target            |
|-------------------------------|-------------------|
| API availability (kong 2xx/3xx) | 99.9% monthly   |
| Edge function p95 latency     | < 800 ms          |
| Realtime fan-out lag          | < 1 s p95         |
| DB replication lag            | < 5 s             |

---

## 7. Operational checklist before going HA

- [ ] External Postgres (dedicated VM or Patroni cluster) provisioned
- [ ] S3 / MinIO bucket created and credentials in `.env`
- [ ] Load balancer with sticky sessions for `/realtime/*`
- [ ] Shared TLS cert (or per-host cert + LB-terminated TLS)
- [ ] Backups: `pg_basebackup` + WAL archiving to off-host storage
- [ ] Monitoring: Prometheus + alerting on the SLOs above
- [ ] DR drill: documented & rehearsed restore from off-host backup
- [ ] Runbook: failover, host replacement, rolling upgrade

See [backup-restore.md](./backup-restore.md) for the DR procedures and
[upgrade.md](./upgrade.md) for the rolling-upgrade workflow.
