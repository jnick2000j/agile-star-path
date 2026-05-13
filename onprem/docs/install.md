# Install

## 1. Unpack

Extract the release tarball to your install directory (recommended:
`/opt/taskmaster`):

```bash
sudo mkdir -p /opt/taskmaster
sudo tar -xzf taskmaster-onprem-v1.0.0.tar.gz -C /opt/taskmaster
sudo chown -R $USER /opt/taskmaster
cd /opt/taskmaster
```

## 2. Configure

```bash
cp .env.example .env
$EDITOR .env
```

Required values:

- `DOMAIN` — the FQDN browsers will use (e.g. `pm.example.com`)
- `POSTGRES_PASSWORD` — strong random password
- `LICENSE_KEY` — supplied by your account team
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
- `FIRST_ADMIN_EMAIL` — email of the bootstrap platform admin

`JWT_SECRET`, `ANON_KEY`, and `SERVICE_ROLE_KEY` will be generated on first
install if left blank.

## 3. TLS

Drop your certificate at `tls/fullchain.pem` and key at `tls/privkey.pem`.
See [prerequisites.md](./prerequisites.md#tls) for Let's Encrypt instructions.

## 4. Run the installer

```bash
./scripts/install.sh
```

The script:

1. Validates prerequisites (Docker, RAM, disk).
2. Generates missing secrets.
3. Verifies your license against the embedded public key.
4. Loads bundled images (`docker load` from `bundles/current/images/`).
5. Starts Postgres and runs every SQL migration in order.
6. Seeds default rows (AI provider, bootstrap admin).
7. Brings up the rest of the stack.
8. Polls `healthcheck.sh` until everything reports healthy.

Total time: ~5 minutes on a typical host (longer on first run if Ollama is
downloading model weights).

## 5. First login

Visit `https://$DOMAIN` and trigger **Forgot password** for `FIRST_ADMIN_EMAIL`.
The bootstrap admin row was created with a random password; the reset email
will let you set your own.

After login:

1. Open **Platform Admin → Licenses** and confirm your license shows as
   **Active**.
2. Open **Platform Admin → AI & Credits** and confirm your AI provider is
   reachable (or switch from Ollama to your provider of choice).
3. Open **Settings → Branding** to upload your org logo.
4. Invite your team via **Admin Panel → Users**. For more than ~20 users,
   use **Bulk Import** with `/migration-templates/users.csv`. If you have
   an IdP, configure it under **Org Admin → SSO** so subsequent users are
   provisioned automatically on first login.

See [user-provisioning.md](./user-provisioning.md) for the full provisioning
matrix (manual invite, bulk import, migration mapping, reconciliation, SSO
JIT) and the billable-user model.

## Troubleshooting

If `install.sh` exits non-zero, see [troubleshooting.md](./troubleshooting.md).
