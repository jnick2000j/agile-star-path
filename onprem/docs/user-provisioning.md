# User Provisioning (on-prem)

This page covers how users get into a self-hosted TaskMaster install:
manual invites, bulk CSV import, migration-driven mapping, SSO Just-in-Time
(JIT) provisioning, and the billable-user model.

End-user docs are inside the app under **Documentation → Administration →
User Management**. This page is for the operator standing the system up.

---

## Provisioning paths

| Path                       | Who triggers it          | Where in the app |
|----------------------------|--------------------------|------------------|
| Manual invite (email)      | Org Admin / Platform Admin | Admin Panel → Users → Invite |
| Bulk CSV import            | Org Admin / Platform Admin | Admin Panel → Users → Bulk Import |
| Migration-driven mapping   | Importer (Jira/CSV)      | Migration Wizard → User Mapping (Step 3) |
| SSO Just-in-Time           | First IdP login          | Automatic — no UI step |
| Reconciliation (catch-up)  | Org Admin / Platform Admin | Admin Panel → Users → Reconcile Migrated |

All paths converge on the same model: a row in `auth.users`, a row in
`profiles` (first/last name), an `access_level` row in
`user_organization_access`, and zero-or-more custom-role rows in
`user_organization_custom_roles`.

---

## 1. Manual invites

`Admin Panel → Users → Invite` calls the `manage-user` Edge Function, which
sends a Supabase invite email via the configured SMTP gateway. The recipient
sets their password from the link and lands in the org with the access level
the inviter chose.

**Operator notes**:
- Invite emails are routed through the same SMTP relay configured in
  [smtp.md](./smtp.md). If invites stall, check `docker compose logs edge | grep manage-user`.
- The activation model is **invite-email only** — there is no
  open-self-signup mode in on-prem. End users cannot create their own org.

---

## 2. Bulk CSV import

`Admin Panel → Users → Bulk Import` opens `BulkImportUsersDialog` which
calls the `bulk-create-users` Edge Function.

**CSV shape** (template at `/migration-templates/users.csv`):

```csv
email,first_name,last_name,access_level,custom_role_ids
alice@example.com,Alice,Cooper,member,
bob@example.com,Bob,Vance,manager,"<role-uuid-1>,<role-uuid-2>"
```

- `access_level` accepts `viewer`, `member`, `manager`, or `admin`.
- `custom_role_ids` is an optional comma-separated list of UUIDs from
  `custom_roles.id` for the target organization.
- The Edge Function deduplicates by email, sends invite emails for new
  accounts, and attaches existing users to the org without resending an
  invite.

**Scope**:
- Org Admins can bulk import into **their own org** only.
- Platform Admins can target **any org** via the org switcher in the dialog.

**Operator notes**:
- The function rate-limits to 100 invites per call. For larger backfills,
  split the CSV or use the migration wizard.
- Invite throughput is bounded by SMTP and the email queue (see
  [smtp.md](./smtp.md) and the `email_send_state` row).

---

## 3. Migration-driven user mapping

When importing data from Jira or a generic CSV via the **Migration Wizard**,
Step 3 (`UserMappingStep`) lets the importer:

1. Match source users (by email) to existing TaskMaster users.
2. **Auto-invite** unmatched emails — these emails are queued through the
   same `bulk-create-users` path so the resulting tickets, tasks and
   audit-log rows attribute correctly.
3. Skip mapping entirely (auditing falls back to the importer's user).

This step is **optional** — the migration runner will tolerate unmapped
authors and log a warning per row.

**Tables involved**: `migration_runs`, `migration_user_map`,
`migration_run_log`. See `migration-runner` Edge Function for the full
reconciliation pass.

---

## 4. Reconciliation

After a migration completes, **Admin Panel → Users → Reconcile Migrated**
(`ReconcileMigratedUsersCard`) calls the `reconcile-migration-users` Edge
Function. This:

- Finds rows that were imported with placeholder authors.
- Re-attempts mapping against any users who have since accepted invites.
- Updates ownership / created-by columns transactionally and writes the
  result to `migration_run_log`.

Run this periodically after a big import. It is idempotent and safe to run
on a live system.

---

## 5. SSO Just-in-Time provisioning

The platform supports SAML and OIDC via the standard SSO setup at
**Org Admin → SSO**. Configuration is stored in `sso_configurations`
(`organization_id`, `allowed_domains[]`, `default_access_level`,
`default_custom_role_ids[]`, `attribute_mapping`, `status`).

On first IdP login, the database trigger `handle_new_user()`:

1. Detects SSO providers (`sso`, `saml`, `oidc`).
2. Looks up the active `sso_configurations` row whose `allowed_domains`
   contains the user's email domain.
3. Inserts the user into `user_organization_access` at the configured
   `default_access_level`.
4. Inserts each `default_custom_role_ids` entry into
   `user_organization_custom_roles`.
5. Maps `first_name` / `last_name` from the SSO claims via
   `attribute_mapping`.
6. Logs the outcome to `sso_jit_provisioning_log`.

A second trigger, `trg_apply_sso_default_roles` on
`user_organization_access`, applies the org's SSO default roles **whenever**
a user is added to an org by **any** path (manual invite, bulk import,
reconciliation, JIT) — provided their email domain matches an active SSO
config. This guarantees consistency without overriding the inviter's
explicit access-level choice.

**Recent JIT events** are visible in the `SSOConfigCard` UI (last 10 sign-ins
with status, granted access level, and any errors).

**Operator notes**:
- IdP metadata is configured per org via the Supabase Auth admin API
  (`supabase--configure_saml_sso` in cloud; equivalent admin API call
  exposed by the bundled `auth` container in on-prem).
- JIT requires SMTP to be working — welcome emails are queued through the
  standard email queue.
- To grant elevated rights to an SSO user, do it **after** their first
  login from **Admin Panel → Users**. SSO defaults are intentionally
  restricted to viewer/member-class roles.

---

## 6. Billable users

A user is **billable** when their effective access (the union of
`user_organization_access.access_level` and any custom-role flags) crosses
the `is_billable_tier()` boundary. The default policy considers `member`,
`manager`, and `admin` billable; `viewer` is non-billable.

For on-prem installs, billable counts are **counted but not charged** —
they feed the license enforcement check at start-up and the **Platform
Admin → Licenses** seat counter. If a tenant exceeds its licensed seat
count, the dashboard surfaces a warning and blocks further elevations
until either seats are added (via license rotation) or users are
demoted/archived.

Cloud installs additionally wire this signal into Stripe; on-prem installs
do not. See [license.md](./license.md) for license formats and rotation.

---

## 7. Lifecycle: archive vs. permanent delete

Both flows route through the `manage-user` Edge Function (which holds the
service-role key) — never delete from the client.

| Action      | Effect | Who can do it |
|-------------|--------|---------------|
| Archive     | Bans the auth user, hides them from all org pickers, retains all history | Org Admin |
| Restore     | Lifts the ban, re-attaches access | Org Admin |
| Delete      | Hard-deletes from `auth.users` (cascades to profile + access rows) | **Platform Admin only** |

See [features.md](./features.md#audit-compliance--siem) for the audit-log
rows each action emits.

---

## Quick troubleshooting

| Symptom                                              | First check |
|------------------------------------------------------|-------------|
| Invite email never arrives                           | SMTP relay logs, `email_send_log` for the recipient |
| Bulk import returns 0 created                        | CSV header names, `bulk-create-users` function logs |
| SSO user lands in no org                             | `sso_jit_provisioning_log` for that email; verify `allowed_domains` |
| SSO user has no roles                                | `sso_configurations.default_custom_role_ids` is empty, or the trigger ran before the role was created — re-add via Admin Panel |
| Migration importer's audit attribution looks wrong   | Run **Reconcile Migrated**; inspect `migration_run_log` |
| Seat count says "exceeded" after upgrade             | Run `SELECT * FROM org_seat_summary;` and reconcile via Admin Panel → Users |
