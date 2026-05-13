#!/usr/bin/env node
// TaskMaster on-prem scaling configurator.
//
// Given a target concurrent user count (and a few optional flags), this
// emits a ready-to-use deployment bundle into ./out/<tier>/:
//
//   .env.scaling          — env fragment to merge into your .env
//   docker-compose.*.yml  — the exact overlay files to bring up
//   bring-up.sh           — the docker compose command line for this tier
//   topology.md           — human-readable plan (hosts, sizing, services,
//                           HA notes, follow-up runbooks)
//
// Usage:
//   node scripts/scale-configurator.mjs --users 1500
//   node scripts/scale-configurator.mjs --users 8000 --ha --gpu --out ./out
//   node scripts/scale-configurator.mjs --users 25000 --ha --multi-az
//
// Flags:
//   --users <N>     Required. Target peak concurrent authenticated users.
//   --ha            Force a topology with no single point of failure.
//   --multi-az      Force Topology C (multi-AZ, Patroni, MinIO cluster).
//   --gpu           Plan dedicated Ollama GPU host(s) for local AI.
//   --out <dir>     Output directory (default: ./out).
//   --domain <fqdn> Public hostname (default: taskmaster.example.com).
//
// Tier matrix (matches onprem/docs/scaling-ha.md):
//   Eval     <50         A1   single host          4 vCPU / 8 GB
//   Small    <250        A1   single host          8 vCPU / 16 GB
//   Medium   <1200       A1   single host          16 vCPU / 32 GB
//   Large    <2000       A2   app + dedicated DB   12+8 vCPU
//   XL       <10000      B    N×app + DB+replica   N×16 vCPU
//   XXL      >=10000     C    multi-AZ + Patroni   autoscaled

import { mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { join, resolve } from "node:path";

// --------------------------------------------------------------------------
// arg parsing
// --------------------------------------------------------------------------
const args = process.argv.slice(2);
const opts = { out: "./out", domain: "taskmaster.example.com" };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--users") opts.users = parseInt(args[++i], 10);
  else if (a === "--out") opts.out = args[++i];
  else if (a === "--domain") opts.domain = args[++i];
  else if (a === "--ha") opts.ha = true;
  else if (a === "--multi-az") opts.multiAz = true;
  else if (a === "--gpu") opts.gpu = true;
  else if (a === "-h" || a === "--help") { usage(); process.exit(0); }
  else { console.error(`Unknown flag: ${a}`); usage(); process.exit(2); }
}
if (!opts.users || Number.isNaN(opts.users)) {
  console.error("Missing required --users <N>"); usage(); process.exit(2);
}

function usage() {
  console.log(`Usage: scale-configurator.mjs --users <N> [--ha] [--multi-az] [--gpu] [--out dir] [--domain fqdn]`);
}

// --------------------------------------------------------------------------
// tier selection
// --------------------------------------------------------------------------
function pickTier(users, ha, multiAz) {
  if (multiAz || users >= 10000) return "xxl";
  if (ha || users >= 2000)        return "xl";
  if (users >= 1200)              return "large";
  if (users >= 250)               return "medium";
  if (users >= 50)                return "small";
  return "eval";
}
const tier = pickTier(opts.users, opts.ha, opts.multiAz);

// edge replicas per app host (vCPU - 1, capped) and # of app hosts
function plan(tier, users) {
  switch (tier) {
    case "eval":   return { hosts: { app: 1 }, sizing: { app: "4 vCPU / 8 GB / 50 GB SSD" },
                            edgeReplicas: 2, appHosts: 1, dbSplit: false, s3: false, patroni: false };
    case "small":  return { hosts: { app: 1 }, sizing: { app: "8 vCPU / 16 GB / 100 GB SSD" },
                            edgeReplicas: 4, appHosts: 1, dbSplit: false, s3: false, patroni: false };
    case "medium": return { hosts: { app: 1 }, sizing: { app: "16 vCPU / 32 GB / 250 GB SSD" },
                            edgeReplicas: 8, appHosts: 1, dbSplit: false, s3: false, patroni: false };
    case "large":  return { hosts: { app: 1, db: 1 },
                            sizing: { app: "12 vCPU / 24 GB / 100 GB SSD", db: "8 vCPU / 32 GB / 500 GB NVMe" },
                            edgeReplicas: 8, appHosts: 1, dbSplit: true, s3: false, patroni: false };
    case "xl": {
      const appHosts = Math.max(2, Math.ceil(users / 4000));
      return { hosts: { app: appHosts, db: 2, minio: 1 },
               sizing: { app: "12 vCPU / 24 GB", db: "16 vCPU / 64 GB / 1 TB NVMe (primary + 1 replica)",
                         minio: "8 vCPU / 16 GB / 2 TB" },
               edgeReplicas: 11, appHosts, dbSplit: true, s3: true, patroni: false };
    }
    case "xxl": {
      const appHosts = Math.max(4, Math.ceil(users / 5000));
      return { hosts: { app: appHosts, db: 3, minio: 4 },
               sizing: { app: "16 vCPU / 32 GB", db: "16 vCPU / 64 GB / 2 TB NVMe (Patroni cluster of 3)",
                         minio: "8 vCPU / 16 GB / 4 TB ×4 (erasure-coded)" },
               edgeReplicas: 15, appHosts, dbSplit: true, s3: true, patroni: true };
    }
  }
}
const p = plan(tier, opts.users);
if (opts.gpu) p.hosts.gpu = tier === "xxl" ? 2 : 1;

// --------------------------------------------------------------------------
// emit files
// --------------------------------------------------------------------------
const outDir = resolve(opts.out, tier);
mkdirSync(outDir, { recursive: true });

const envLines = [
  `# Generated by scale-configurator.mjs for ${opts.users} users (tier: ${tier})`,
  `DOMAIN=${opts.domain}`,
  `EDGE_REPLICAS=${p.edgeReplicas}`,
  ``,
  p.dbSplit ? `# Postgres on dedicated VM` : `# Postgres co-located in the compose stack`,
  `DB_EMBEDDED=${p.dbSplit ? "false" : "true"}`,
  ...(p.dbSplit ? [
    `POSTGRES_HOST=db.internal`,
    `POSTGRES_PORT=5432`,
  ] : []),
  ``,
  p.s3 ? `# Object storage: S3-compatible (REQUIRED for multi-app-host)` : `# Object storage: local FS`,
  `STORAGE_DRIVER=${p.s3 ? "s3" : "file"}`,
  ...(p.s3 ? [
    `S3_BUCKET=taskmaster-uploads`,
    `S3_ENDPOINT=https://minio.internal:9000`,
    `S3_FORCE_PATH_STYLE=true`,
    `S3_ACCESS_KEY=`,
    `S3_SECRET_KEY=`,
  ] : [
    `STORAGE_PATH=/var/lib/taskmaster/storage`,
  ]),
  ``,
  opts.gpu ? `# Dedicated GPU host pool for local Ollama` : `# Local Ollama (default)`,
  ...(opts.gpu ? [
    `AI_PROVIDER=ollama`,
    `AI_BASE_URL=http://ollama-lb.internal:11434`,
  ] : [
    `AI_PROVIDER=ollama`,
    `AI_BASE_URL=http://ollama:11434`,
  ]),
  `AI_DEFAULT_MODEL=llama3.1:8b`,
  ``,
  p.patroni ? `# Postgres HA via Patroni — point at HAProxy` : ``,
  ...(p.patroni ? [
    `POSTGRES_HOST=pg-haproxy.internal`,
    `POSTGRES_READ_HOST=pg-haproxy.internal`,
    `POSTGRES_READ_PORT=5433`,
  ] : []),
];
writeFileSync(join(outDir, ".env.scaling"), envLines.filter(l => l !== undefined).join("\n") + "\n");

// docker compose file selection
const composeFiles = ["docker-compose.yml"];
if (p.dbSplit) composeFiles.push("docker-compose.db.yml");
if (p.s3)      composeFiles.push("docker-compose.minio.yml");
if (p.patroni) composeFiles.push("ha/patroni/docker-compose.yml");

// bring-up.sh — different commands per host role
const bringUp = [
  `#!/usr/bin/env bash`,
  `# Generated bring-up for tier=${tier} (${opts.users} users).`,
  `# Run on the host indicated by each block.`,
  `set -euo pipefail`,
  ``,
];
if (!p.dbSplit) {
  bringUp.push(
    `# --- Single host (all-in-one) ---`,
    `cat .env.scaling >> .env`,
    `docker compose -f docker-compose.yml up -d`,
  );
} else {
  bringUp.push(
    `# --- DB host ---`,
    `# scp .env.scaling db.internal:/opt/taskmaster/.env`,
    `# ssh db.internal "cd /opt/taskmaster && docker compose -f docker-compose.db.yml up -d"`,
    ``,
    p.s3 ? `# --- MinIO host(s) ---\n# ssh minio.internal "cd /opt/taskmaster && docker compose -f docker-compose.minio.yml up -d"\n` : ``,
    `# --- App host(s) (run on each of ${p.appHosts}) ---`,
    `cat .env.scaling >> .env`,
    `docker compose -f docker-compose.yml up -d \\`,
    `  --scale edge=${p.edgeReplicas}`,
  );
}
if (p.patroni) {
  bringUp.push(
    ``,
    `# --- Postgres HA cluster (3 nodes) ---`,
    `# ssh pg1.internal "cd /opt/taskmaster && docker compose -f ha/patroni/docker-compose.yml up -d"`,
    `# Repeat on pg2 and pg3.`,
  );
}
const bringUpPath = join(outDir, "bring-up.sh");
writeFileSync(bringUpPath, bringUp.filter(Boolean).join("\n") + "\n");
chmodSync(bringUpPath, 0o755);

// topology.md
const topology = `# TaskMaster on-prem deployment plan

**Generated**: ${new Date().toISOString()}
**Target users**: ${opts.users}
**Selected tier**: \`${tier}\`
**Reference topology**: ${tier === "xxl" ? "C (multi-AZ HA)" : tier === "xl" ? "B (split DB + N app hosts)" : tier === "large" ? "A2 (app + dedicated DB)" : "A1 (single host)"}

## Hosts to provision

${Object.entries(p.hosts).map(([role, n]) => `- **${n}× ${role}** — ${p.sizing[role] || "see scaling-ha.md"}`).join("\n")}

## Compose files to apply

${composeFiles.map(f => `- \`${f}\``).join("\n")}

## Configuration

- Edge runtime replicas per app host: **${p.edgeReplicas}**
- Postgres: **${p.patroni ? "Patroni HA cluster" : p.dbSplit ? "dedicated VM" : "co-located in compose stack"}**
- Object storage: **${p.s3 ? "S3 / MinIO (shared)" : "local volume"}**
- Local AI (Ollama): **${opts.gpu ? "dedicated GPU pool" : "co-located"}**
- HA: **${tier === "xxl" ? "multi-AZ, no SPOF" : tier === "xl" ? "app tier HA, DB has 1 replica" : "no — single host failure = outage"}**

## Bring-up

1. On each VM, run the matching prereq script:
   \`\`\`bash
   sudo ./scripts/prereqs-multi-host.sh --role <web|db|storage> --peers <list>
   \`\`\`
   (or \`prereqs-single-host.sh\` for tier \`eval/small/medium\`).
2. Copy \`.env.scaling\` (this directory) into the project's \`.env\` on each VM.
3. Run \`bring-up.sh\` (or copy the relevant block to each host).

## Follow-up runbooks

- [scaling-ha.md](../../docs/scaling-ha.md) — full topology reference
- [object-storage.md](../../docs/object-storage.md)${p.s3 ? " — **required**, configure S3/MinIO before bringing up app tier" : ""}
- [minio-cluster.md](../../docs/minio-cluster.md)${tier === "xxl" ? " — **required** for 4-node erasure-coded MinIO" : ""}
- [backup-restore.md](../../docs/backup-restore.md) — schedule \`backup.sh\` on the ${p.dbSplit ? "DB" : "app"} host
- [upgrade.md](../../docs/upgrade.md) — versioned bundle workflow (rolling on multi-host)

## Capacity headroom

This plan targets the **${opts.users}** concurrent-user mark with ~30% CPU headroom.
Re-run the configurator and apply the new \`.env.scaling\` when sustained CPU
exceeds 70% on any tier or Postgres connections approach \`max_connections\`.
`;
writeFileSync(join(outDir, "topology.md"), topology);

console.log(`Wrote deployment bundle to ${outDir}/`);
console.log(`  - .env.scaling`);
console.log(`  - bring-up.sh`);
console.log(`  - topology.md`);
console.log(`Tier: ${tier}  |  app hosts: ${p.appHosts}  |  edge replicas/host: ${p.edgeReplicas}  |  DB split: ${p.dbSplit}  |  S3: ${p.s3}  |  Patroni: ${p.patroni}`);
