# Object Storage — Decision Matrix & Setup

TaskMaster's `docker-compose.yml` does **not** ship an S3 server. You choose
how uploads (avatars, document attachments, exported PDFs, helpdesk
attachments) are stored. This page helps you pick, then links to the
install guide for each option.

## TL;DR

| Deployment tier | Recommended storage |
|---|---|
| Small (≤ 200 users, single VM) | Local filesystem (`STORAGE_DRIVER=file`) — no extra container |
| Medium (≤ 2,000 users, single VM) | Local filesystem **or** single-node MinIO |
| Large A1/A2 (multi-host app tier) | **Required**: S3-compatible — single-node MinIO is OK to start, distributed MinIO or managed S3 for HA |
| Air-gapped / regulated | Self-hosted MinIO (single-node or 4-node distributed) |
| Cloud-adjacent (VPC peering OK) | AWS S3 / Cloudflare R2 / Wasabi / Backblaze B2 |
| Existing enterprise object store | Ceph RGW, NetApp StorageGRID, Dell ECS, Pure FlashBlade |

## Decision matrix

| Option | HA built-in | Air-gap OK | Operational cost | Cost model | Notes |
|---|---|---|---|---|---|
| **Local FS** | ❌ (single-host only) | ✅ | None | Free | Breaks the moment you add a second app node — see [scaling-ha.md](./scaling-ha.md) |
| **MinIO single-node** | ❌ (data on one disk/VM) | ✅ | Low — one container | Free (AGPLv3) or commercial subscription | Best starting point for Large A1 before HA is needed |
| **MinIO distributed (4+ nodes)** | ✅ | ✅ | Medium — manage 4 VMs + erasure coding | Free or commercial | True on-prem HA; survives 2-node failure with EC:4 |
| **AWS S3** | ✅ (11 nines) | ❌ | Zero — fully managed | Pay per GB + requests | Easiest if your VPC can reach AWS |
| **Cloudflare R2** | ✅ | ❌ | Zero | Pay per GB, **no egress fees** | Good for read-heavy workloads |
| **Wasabi / Backblaze B2** | ✅ | ❌ | Zero | Flat per-GB, low egress | Cheaper than S3 for archives |
| **Ceph RGW / StorageGRID / ECS** | ✅ | ✅ | High — but you already run it | Sunk cost | Just point env vars at the existing endpoint |

> **Multi-host app tier requires S3 semantics.** With `STORAGE_DRIVER=file`,
> each app node writes to its own local disk and uploads disappear when the
> next request lands on a different node. See the topology diagram in
> [scaling-ha.md](./scaling-ha.md).

## Option 1 — Local filesystem (default)

In `.env`:
```bash
STORAGE_DRIVER=file
STORAGE_PATH=/var/lib/taskmaster/storage
```
Nothing else to install. The path is mounted as a Docker volume in
`docker-compose.yml`. Back it up with the rsync command in
[backup-runbook.md](./backup-runbook.md).

## Option 2 — Single-node MinIO (self-hosted)

Best for small/medium on-prem and Large A1 starter setups.

### 1. Add MinIO credentials to `.env`

```bash
# MinIO admin (console login)
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=$(openssl rand -hex 32)
MINIO_CONSOLE_URL=https://minio-console.taskmaster.example.com
MINIO_SERVER_URL=https://minio.taskmaster.example.com

# App-facing storage
STORAGE_DRIVER=s3
S3_BUCKET=taskmaster-uploads
S3_REGION=us-east-1
S3_ENDPOINT=http://minio:9000
S3_FORCE_PATH_STYLE=true
S3_ACCESS_KEY=$(openssl rand -hex 12)   # 20+ chars alphanumeric
S3_SECRET_KEY=$(openssl rand -hex 24)   # 40+ chars
```

### 2. Start MinIO alongside the main stack

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.minio.yml \
  up -d
```

The `minio-bootstrap` one-shot container automatically:

1. Creates the buckets used by the app:
   - `taskmaster-uploads` — general attachments, ticket files, signed exports
   - `lms-content` — LMS lesson media & attachments (only used if the LMS
     add-on module is enabled — created unconditionally so enabling the module
     later requires no storage changes)
   - `lms-certificates` — generated LMS completion certificates
2. **Blocks anonymous/public access** (`mc anonymous set none`) — the app
   serves objects via short-lived presigned URLs, never public links
3. Enables **versioning** (recovery from accidental deletes)
4. Installs a **lifecycle policy**:
   - Noncurrent object versions expire after 30 days
   - Incomplete multipart uploads abort after 7 days
5. Creates an IAM **least-privilege policy** (`taskmaster-app`) that grants
   only `ListBucket`, `GetObject`, `PutObject`, `DeleteObject`, and
   multipart APIs — scoped to all three buckets above
6. Creates a **dedicated service account** with that policy attached and
   binds it to the access/secret keys you set in `.env`

### 3. Verify

```bash
docker compose logs minio-bootstrap | tail -20
# expect: ">> done. bucket=taskmaster-uploads access_key=..."

docker compose exec app node -e "
  const {S3Client, ListObjectsV2Command} = require('@aws-sdk/client-s3');
  const c = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY
    }
  });
  c.send(new ListObjectsV2Command({Bucket: process.env.S3_BUCKET}))
    .then(r => console.log('OK', r.KeyCount ?? 0, 'objects'))
    .catch(e => { console.error('FAIL', e.message); process.exit(1); });
"
```

### 4. Reverse-proxy with TLS

In production, terminate TLS at your edge proxy (nginx / Caddy / Traefik):

```nginx
# minio.taskmaster.example.com  -> S3 API (port 9000)
# Required header for virtual-host-style requests; we use path-style though.
server {
  listen 443 ssl http2;
  server_name minio.taskmaster.example.com;
  client_max_body_size 5G;       # match your largest upload
  proxy_request_buffering off;   # stream uploads
  location / {
    proxy_pass http://127.0.0.1:9000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_http_version 1.1;
  }
}

# minio-console.taskmaster.example.com -> Web console (port 9001)
server {
  listen 443 ssl http2;
  server_name minio-console.taskmaster.example.com;
  location / {
    proxy_pass http://127.0.0.1:9001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_http_version 1.1;
  }
}
```

Then update `.env`:
```bash
S3_ENDPOINT=https://minio.taskmaster.example.com
```

## Option 3 — Distributed MinIO (4-node HA cluster)

For Large A2 / multi-AZ deployments where object storage cannot be a
single point of failure.

See [minio-cluster.md](./minio-cluster.md) for the full 4-node topology,
erasure coding configuration, rolling-upgrade procedure, and failure
tolerance matrix.

## Option 4 — Managed S3 (AWS / R2 / Wasabi / B2)

Skip the MinIO compose file entirely. In `.env`:

```bash
STORAGE_DRIVER=s3
S3_BUCKET=taskmaster-uploads
S3_REGION=eu-west-1
S3_ENDPOINT=                       # blank for AWS S3; set for R2/Wasabi/B2
S3_FORCE_PATH_STYLE=false          # true for R2 and most non-AWS providers
S3_ACCESS_KEY=AKIA...
S3_SECRET_KEY=...
```

You still need to:

1. **Create the bucket** in the provider's console (private, versioning ON,
   block public access ON).
2. **Create an IAM user/service account** with the same least-privilege
   policy as the bootstrap script writes:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       { "Effect": "Allow",
         "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
         "Resource": "arn:aws:s3:::taskmaster-uploads" },
       { "Effect": "Allow",
         "Action": ["s3:PutObject","s3:GetObject","s3:DeleteObject",
                    "s3:AbortMultipartUpload","s3:ListMultipartUploadParts"],
         "Resource": "arn:aws:s3:::taskmaster-uploads/*" }
     ]
   }
   ```
3. **Configure CORS** on the bucket to allow `PUT`/`GET` from your
   `PUBLIC_URL` origin (the app uses presigned URLs from the browser).
4. **Set a lifecycle rule**: expire noncurrent versions after 30 days,
   abort incomplete multipart uploads after 7 days.

## Option 5 — Existing enterprise object store

Ceph RGW, NetApp StorageGRID, Dell ECS, Pure FlashBlade S3 — all expose
the same S3 API. Configure exactly like Option 4, but with
`S3_ENDPOINT` pointing at your gateway and `S3_FORCE_PATH_STYLE=true`
(most enterprise gateways don't support virtual-host style).

Have the storage team create a tenant/account, a bucket, and a service
account with the policy from Option 4 — TaskMaster doesn't need anything
beyond standard S3 v2/v4 signed requests.

## Migrating between options

Use the AWS CLI (works against any S3-compatible endpoint):

```bash
# from local FS to MinIO
aws s3 sync /var/lib/taskmaster/storage s3://taskmaster-uploads/ \
  --endpoint-url https://minio.taskmaster.example.com

# from MinIO to AWS S3
aws s3 sync s3://taskmaster-uploads/ s3://taskmaster-prod-uploads/ \
  --source-endpoint-url https://minio.taskmaster.example.com
```

After sync, flip `STORAGE_DRIVER` / `S3_*` in `.env` and
`docker compose up -d app` to pick up the new credentials.
