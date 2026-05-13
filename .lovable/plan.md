## Goal
Two related capabilities, behind one cohesive UX:
1. **Bulk-create users** from CSV in Admin → User Management.
2. **Map source users → platform users** during migrations, with auto-invite of unmatched and a reconciliation tool that back-fills assignees later.

Activation = invite-only. Scope = both Org Admins (own org) and Platform Admins (any org via slug). Mapping step = optional, auto-invites unmatched valid emails. Reconciliation = built now.

---

## What gets built

### A. New edge function `bulk-create-users`
Accepts an array of rows; returns a per-row result. Reuses `manage-user`'s invite logic per row.

- **Authorization**: same checks as `manage-user`. Non-platform-admins can only target their own org; `organization_slug` column ignored unless caller is platform admin.
- **Per-row flow**: validate (email+first/last name required) → resolve org (slug or default) → resolve role (custom_role name or `viewer`/`editor`/`admin`) → `auth.admin.createUser` → grant `user_organization_access` → optional `user_organization_custom_roles` → upsert profile fields (job_title, department, phone, location) → generate signup link → `sendTransactionalEmail` invite.
- Idempotent on email: existing user → `linked` (grant access only), don't recreate.
- Returns `{rows: [{email, status: 'created'|'linked'|'skipped'|'error', user_id?, error?, accept_url?}], summary: {created, linked, skipped, errored}}`.
- Also accepts `mode: 'auto_invite'` from the migration wizard (same body, smaller default fields, suppresses email if `send_invite=false`).

### B. New `BulkImportUsersDialog` (Admin → User Management)
- "Bulk import" button next to existing Create User.
- CSV input + downloadable template (`/migration-templates/users.csv`).
- Headers: `email, first_name, last_name, job_title, department, phone_number, location, organization_slug, access_level, custom_roles, send_invite`.
- Client-side parse → preview table with row-level validation badges (duplicate email in file, malformed email, unknown org slug for platform admin, unknown role name).
- "Import N users" → calls `bulk-create-users` → shows results table → "Download report.csv" button.
- Reuses `downloadBlob` helper from `src/lib/migration/runner.ts`.

### C. Migration framework — user mapping
- **Type**: `MigrationSourceAdapter.discoverUsers?(creds, scope, files)` returns `{ externalId, email?, displayName?, refCount }[]`. Optional; adapters implement when feasible.
- **CSV adapter**: scans `assignee`/`reporter`/`owner`/`created_by` columns across all uploaded files; emits distinct entries.
- **Jira adapter**: pulls a sample page of issues per selected project (already has `jiraFetch`) and collects `fields.assignee`/`fields.reporter` `emailAddress` + `displayName` + `accountId`.
- **JSM adapter**: same shape, from request reporter/assignee.
- **Wizard**: new `users` step inserted between `mapping` and `contacts`. Shows discovered users with auto-match results:
  - Auto-match: case-insensitive email exact match against `profiles.email`.
  - Per-row dropdown: **Linked to <user>** (auto), **Link to existing user…** (search picker), **Invite as viewer** (calls `bulk-create-users` with one row), **Skip**.
  - "Auto-invite all unmatched (with valid emails)" bulk button.
  - Saves `mapping.user[externalId] = user_id` for resolved rows; skipped rows stay absent.
- **Adapter `run`**: when inserting a record, look up `mapping.user[externalId]` → set `assigned_to`/`owner_id` accordingly. If no match, write the original identity into `metadata.external = { assignee_email, assignee_name }` on the imported row's `payload` AND on the entity's `metadata` jsonb where the table has one (tasks/issues already do).
  - Concretely modify: `jira.ts` task insert (`assigned_to`), issue insert (`owner_id`), risk insert (`owner_id`); same shape in `csv.ts` and `jiraServiceManagement.ts`.

### D. Reconciliation tool
- New page section under Admin → Migration: **"Reconcile imported users"**.
- Lists `migration_items` rows where `payload->'external'->>'assignee_email'` is not null AND `internal_id` is set AND the corresponding entity has no `assigned_to`/`owner_id`.
- Joins against `profiles.email` to find now-known users; one-click "Reconcile all" runs an edge function `reconcile-migration-users` that:
  - Iterates matches, updates the target table (tasks/issues/risks based on `entity_type`) setting `assigned_to`/`owner_id`.
  - Returns counts per entity type.

---

## Database changes
None. We reuse existing tables:
- `migration_items.payload` (jsonb) stores skipped-assignee identity.
- `migration_jobs.field_map` already stores `mapping.user`.
- `tasks.assigned_to` / `issues.owner_id` / `risks.owner_id` are the targets.

---

## Files

**New**
- `supabase/functions/bulk-create-users/index.ts`
- `supabase/functions/reconcile-migration-users/index.ts`
- `src/components/admin/BulkImportUsersDialog.tsx`
- `src/components/migration/UserMappingStep.tsx`
- `src/components/admin/ReconcileMigratedUsersCard.tsx`
- `public/migration-templates/users.csv`

**Edited**
- `src/components/admin/UserManagementPanel.tsx` — add "Bulk import" button.
- `src/lib/migration/types.ts` — add optional `discoverUsers` to adapter, add `DiscoveredUser` type.
- `src/lib/migration/sources/csv.ts` — implement `discoverUsers` + write `assigned_to`/`owner_id` from `mapping.user` + record skipped identity in payload.
- `src/lib/migration/sources/jira.ts` — same.
- `src/lib/migration/sources/jiraServiceManagement.ts` — same.
- `src/components/migration/MigrationWizard.tsx` — insert "users" step, render `UserMappingStep`.
- `src/pages/AdminPanel.tsx` — add Reconciliation card under Migration tab.

---

## Out of scope (deliberate)
- SCIM enhancements — already covers ongoing sync.
- Updating user data on re-imports (only links/creates; never overwrites profile fields after creation).
- Bulk delete/archive via CSV.
- Mapping users to roles per-record (only per-org access from CSV).