# Troubleshooting

## Quick diagnostics

```bash
./scripts/healthcheck.sh             # which service is unhealthy?
docker compose ps                    # are containers running?
docker compose logs --tail=100 edge  # recent errors from a service
```

## Install fails

| Symptom                                  | Likely cause                       | Fix                                                                    |
|------------------------------------------|------------------------------------|------------------------------------------------------------------------|
| `License verification failed`            | Wrong/expired `LICENSE_KEY`        | Re-issue from your account team                                        |
| `pg_isready` never succeeds              | Port 5432 in use by host Postgres  | Stop host Postgres or set `POSTGRES_PORT=5433` in `.env`               |
| `JWT_SECRET not set`                     | Blank in `.env`                    | Re-run `install.sh` — it auto-generates if blank                       |
| Healthcheck times out                    | TLS cert missing                   | Place chain at `tls/fullchain.pem`, key at `tls/privkey.pem`           |

## Login fails

| Symptom                                  | Likely cause                       | Fix                                                                    |
|------------------------------------------|------------------------------------|------------------------------------------------------------------------|
| "Invalid credentials" on first login     | Bootstrap pwd is random            | Use **Forgot password** with `FIRST_ADMIN_EMAIL`                       |
| Reset email never arrives                | SMTP misconfigured                 | See [smtp.md](./smtp.md), check `docker compose logs auth`             |
| "Email not confirmed"                    | Email confirmation required        | Toggle off in **Platform Admin → Auth Settings** for on-prem demos     |

## Upgrade fails

| Symptom                                  | Likely cause                       | Fix                                                                    |
|------------------------------------------|------------------------------------|------------------------------------------------------------------------|
| `signature INVALID`                      | Tampered or wrong-key bundle       | Re-download; verify with `sha256sum`                                   |
| `min_previous_version` violation         | Skipping too many versions         | Upgrade incrementally                                                  |
| Health gate fails → auto-rollback        | New migration broke RLS            | Inspect `bundles/<v>/migrations/`, restore via `restore.sh`            |

## AI features fail

| Symptom                                  | Likely cause                       | Fix                                                                    |
|------------------------------------------|------------------------------------|------------------------------------------------------------------------|
| "AI provider unreachable"                | Ollama not running or model not pulled | `docker compose exec ollama ollama pull llama3.1:8b`              |
| Slow AI responses                        | Local model too large for host     | Switch to `llama3.1:8b` or use external provider                       |
| "Insufficient credits" on a license install | License has finite `ai_credits_monthly` | Have a new license issued with `-1` (unlimited)                  |
| KB search returns nothing                | Embedding model not pulled         | `docker compose exec ollama ollama pull nomic-embed-text` then re-index from Admin Panel → Knowledge Base |
| Ask the Task Master loops or 500s        | Edge function out of memory        | `docker compose restart edge`; check `logs edge \| grep task-master`  |

## Notifications, workflows & timesheets

| Symptom                                  | Likely cause                       | Fix                                                                    |
|------------------------------------------|------------------------------------|------------------------------------------------------------------------|
| In-app bell shows nothing on assign      | `notification-dispatcher` failing  | `docker compose logs edge \| grep notification-dispatcher`             |
| Email reminders never arrive             | SMTP misconfigured                 | See [smtp.md](./smtp.md); test with `docker compose exec edge deno run -A tools/smtp-test.ts` |
| Helpdesk workflows "stuck"               | Workflow runner cron not ticking   | `docker compose ps`; restart `edge`; check `helpdesk_workflow_runs`    |
| Inbound helpdesk email not creating tickets | Email gateway → webhook misconfigured | Verify your MX/Postmark/Sendgrid route POSTs to `/functions/v1/helpdesk-inbound-email` with the shared secret |
| Timesheet user "can't log time on task"  | Org setting **restrict_time_logging_to_assigned_tasks** is ON | Either assign them in **task_assignments** / set `tasks.assigned_to`, or toggle the setting off in Settings → General |
| Timesheet PDF email fails                | SMTP/Resend not reachable from `edge` | Check `email-timesheet` logs; verify `SMTP_FROM` is verified domain    |

## Backups not running

```bash
# Run by hand to see the error
./scripts/backup.sh
# Check cron user has Docker access
sudo usermod -aG docker $USER && newgrp docker
```

## Collecting diagnostics for support

```bash
./scripts/collect-diagnostics.sh   # bundles logs, env (redacted), versions
# Produces: ./diagnostics-<timestamp>.tar.gz
```

Email this tarball to your account team. It includes:

- Last 1000 log lines from each service
- `docker compose ps` and `docker version`
- Schema version table (which migrations have run)
- `healthcheck.sh` output
- `.env` with secrets redacted
- License entitlements (no key material)
