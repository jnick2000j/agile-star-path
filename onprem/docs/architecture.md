# Architecture

TaskMaster on-prem runs as a single `docker compose` stack on one host.
All components are containerized and require no external dependencies
beyond Postgres (which we bundle) and an SMTP relay (which you provide).

## Services

| Service    | Image                              | Purpose                               |
|------------|------------------------------------|---------------------------------------|
| `db`       | `onprem-db` (Postgres 15 + ext)    | Primary data store + auth schema      |
| `auth`     | `onprem-auth` (GoTrue)             | Email/password, SSO, MFA              |
| `realtime` | `onprem-realtime`                  | Postgres → WebSocket fan-out          |
| `storage`  | `onprem-storage`                   | File uploads (local FS or S3)         |
| `edge`     | `onprem-edge` (Deno)               | Business logic — every `supabase/functions/*` |
| `kong`     | `onprem-kong`                      | API gateway, JWT validation           |
| `web`      | `onprem-web` (nginx + Vite build)  | React SPA + TLS termination           |
| `ollama`   | `ollama/ollama` *(optional)*       | Local LLM inference                   |

## Data flow

```
browser ──► web (nginx) ──► kong ──► { auth | rest | realtime | storage | edge }
                                        │
                                        ▼
                                       db (Postgres)
```

The browser only ever talks to `web` and `kong`. Internal services are not
exposed on the host network.

## Persistence

| Volume          | Contents                                          |
|-----------------|---------------------------------------------------|
| `db-data`       | Postgres data dir                                 |
| `storage-data`  | User-uploaded files (when `STORAGE_DRIVER=file`)  |
| `ollama-models` | Downloaded local LLM weights                      |
| `./backups/`    | `pg_dump` output and uploads tarballs             |
| `./bundles/`    | Release bundles (one directory per version)       |

## Outbound network

By default, **zero** outbound traffic is required. When `ALLOW_OUTBOUND_TELEMETRY=true`:

- `edge` polls `updates.taskmaster.app` for new release manifests
- `edge` may submit anonymized health metrics

This is configurable per-org in the Platform Admin UI.

## Edge function surface

The `edge` container hosts every function under `supabase/functions/*`.
Operator-relevant groups:

- **AI**: `task-master-chat`, `ai-advisor`, `ai-draft`, `ai-draft-chat`,
  `ai-summarize`, `ai-insights-scan`, `ai-search`, `ai-translate`,
  `ai-ticket-intake`, `risk-insights`.
- **Helpdesk**: `helpdesk-inbound-email`, `helpdesk-notify`,
  `helpdesk-workflow-runner`, `helpdesk-workflow-approve`.
- **Knowledge Base**: `kb-ingest-upload`, `kb-embed`, `kb-search`,
  `kb-suggest-for-ticket`.
- **Notifications & reporting**: `notification-dispatcher`,
  `check-notifications`, `check-update-reminders`, `notify-cm-activity`,
  `notify-milestone-change`, `notify-org-suspension`, `notify-sso-request`,
  `notify-workflow-assignment`, `summarize-weekly-report`,
  `send-weekly-report`, `email-timesheet`.
- **Auth & provisioning**: `mfa-manage`, `session-manage`, `send-invite`,
  `manage-user`, `register-tenant-saml`, `register-tenant-oidc`, `scim-v2`.
- **Compliance / audit**: `export-audit-log`, `siem-export`, `verify-domain`,
  `generate-governance-report`, `generate-comms-pack`, `generate-report`.
- **Automations**: `automation-runner`, `automation-approve`.
- **Billing (hybrid only)**: `create-checkout`, `create-portal-session`,
  `cancel-subscription`, `get-stripe-price`, `sync-plan-to-stripe`,
  `payments-webhook`, `manage-ai-credit-packs`.

## Scheduled jobs

Cron is configured inside the `edge` container (see `supabase/config.toml`):

| Cadence  | Function                                            |
|----------|-----------------------------------------------------|
| 1 min    | `automation-runner`, `helpdesk-workflow-runner`     |
| Hourly   | `check-notifications`, `check-update-reminders`     |
| Weekly   | `summarize-weekly-report` → `send-weekly-report`    |

See [features.md](./features.md) for the per-module operator notes.
