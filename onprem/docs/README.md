# TaskMaster On-Premises Documentation

Operator guide for self-hosted TaskMaster installations.

## Contents

1. [Architecture](./architecture.md) — services, edge functions, scheduled jobs, data flow
2. [Prerequisites](./prerequisites.md) — host sizing, OS, network, TLS, optional inbound email
3. [Install](./install.md) — first-time install walkthrough
4. [Upgrade](./upgrade.md) — versioned bundle workflow + rollback
5. [Backup & Restore](./backup-restore.md) — DB + uploads + DR drills
6. [License management](./license.md) — installing, rotating, revoking
7. [AI provider configuration](./ai-provider.md) — Ollama, OpenAI, Azure, Anthropic, embedding models
8. [SMTP configuration](./smtp.md) — required for invites, notifications, MFA, helpdesk
9. [Object storage](./object-storage.md) — local FS vs MinIO vs managed S3, decision matrix, IAM policy
10. [Distributed MinIO cluster](./minio-cluster.md) — 4-node HA topology for Large A2
11. [Features overview](./features.md) — every shipped module + the edge functions / cron jobs that back it
12. [Scaling & HA](./scaling-ha.md) — going beyond 2,000 users, multi-host topologies, Patroni, multi-AZ
13. [Troubleshooting](./troubleshooting.md) — common errors and fixes

### For release engineers (not operators)

If you are **building** the install / upgrade bundles (rather than
consuming them), see [`onprem/release/RELEASING.md`](../release/RELEASING.md).
It covers signing-key setup, `bump-version.sh`, `build-bundle.sh`, the
GitHub Actions release workflow, local test builds (`SKIP_IMAGES=1`),
hotfix flow, and signing-key rotation.

End-user documentation (PRINCE2 / MSP / Agile / ITIL templates and the
"Ask the Task Master" AI assistant) ships *inside* the application — open
**Documentation** in the sidebar.

## Support

For licensed customers: contact your account team or open a ticket via the
in-app **Support** page (still works on-prem; routes to your account team's
queue when telemetry is enabled, otherwise generates a `.zip` of diagnostics
you can email).
