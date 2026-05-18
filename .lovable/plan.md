## Admin-Managed Google + Microsoft 365 Calendar Integration

Two calendar providers (Google Calendar, Microsoft 365 / Outlook). Each org admin can:
1. Enable/disable the provider for the org.
2. Optionally provide their own OAuth client (branded consent) — otherwise platform-managed credentials are used.

End users then connect their personal account from Profile → Calendar Sync. Sync is two-way for their assigned tasks (already designed per previous plan).

### 1. Database (migration)

**`organization_calendar_integrations`** (per-org config, per-provider)
- `organization_id`, `provider` (`google` | `microsoft`)
- `enabled` (bool, default false)
- `use_custom_oauth` (bool, default false)
- `custom_client_id`, `custom_client_secret` (nullable; only when use_custom_oauth)
- `tenant_id` (nullable; for Microsoft single-tenant apps; default `common`)
- `updated_by`, timestamps
- Unique `(organization_id, provider)`
- RLS: only org admins (via `has_org_role(_user, _org, 'admin')` helper / `useOrgAccessLevel` admin tier) can read/write. The `custom_client_secret` is NEVER exposed to non-admins (split into a separate secret column readable only by service role + RLS for admins).

**Extend `user_google_calendar_connections`** (already exists from prior migration) → rename pattern to support two providers without duplicating tables:

**New `user_calendar_connections`** — generalises the existing Google-only table:
- `user_id`, `organization_id`, `provider` (`google` | `microsoft`)
- `account_email`, `target_calendar_id` (default `primary`)
- `access_token`, `refresh_token`, `token_expires_at`
- `sync_token` (Google) / `delta_link` (Microsoft)
- `last_synced_at`, `sync_enabled`
- Unique `(user_id, provider)`
- RLS: user owns own rows
- Migrate existing `user_google_calendar_connections` rows into this table with `provider='google'`, then drop the old table.

**Extend `task_calendar_event_links`** — add `provider` column (`google` default for existing rows), drop unique `(task_id, user_id)`, add unique `(task_id, user_id, provider)`.

**Extend `gcal_sync_queue` → `calendar_sync_queue`** — add `provider` column, rename. Update the `enqueue_*` trigger function to enqueue one row per active provider connection the user has.

### 2. Edge functions

Replace single-provider functions with provider-aware ones:

- `calendar-oauth-start` — input: `{ provider }`. Reads org integration config, picks custom vs managed credentials, builds the provider's consent URL with state = signed JWT containing `{ user_id, org_id, provider, nonce }`. Returns redirect URL.
- `calendar-oauth-callback` — verifies state, exchanges code for tokens against the right provider, fetches account email (`userinfo.email` for Google, `/me` for Microsoft Graph), stores in `user_calendar_connections`, redirects to `/profile?calendar=connected`.
- `calendar-sync-push` — for `(user, provider)`, fetches assigned tasks with `planned_start`, upserts/deletes events via Google Calendar API or Microsoft Graph Calendar API; refreshes tokens; respects `target_calendar_id`.
- `calendar-sync-pull` — incremental fetch (Google `syncToken`, Microsoft `delta`). For linked tasks where event start/end changed, updates `tasks.planned_start/end`. Loop-prevention via `last_pushed_at` window.
- `calendar-sync-scanner` — hourly cron, walks `user_calendar_connections WHERE sync_enabled`, runs pull then push per (user, provider), refreshes tokens, drains `calendar_sync_queue`.

Delete the now-redundant `gcal-*` function files I had planned (they were never created beyond the queue).

### 3. Secrets (platform-managed defaults)

Request via secrets tool:
- `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`
- `MICROSOFT_CALENDAR_CLIENT_ID`, `MICROSOFT_CALENDAR_CLIENT_SECRET`
- `CALENDAR_OAUTH_STATE_SECRET` (HMAC key for signing the OAuth `state` JWT)

These are used when an org has `use_custom_oauth = false`. When `true`, the org's `custom_client_id` / `custom_client_secret` from the DB are used.

### 4. Admin UI

New tab in `Settings.tsx` → **"Calendar Integrations"** (gated by Org Admin via `useOrgAccessLevel().hasFullOrgAccess`):

For each provider (Google, Microsoft 365):
- Enable toggle.
- "Use Lovable-managed credentials" vs "Use our own OAuth app" radio.
- When custom: Client ID, Client Secret (password input), Tenant ID (Microsoft only, default `common`), Redirect URI shown read-only for them to paste into Google Cloud Console / Microsoft Entra.
- Save button calls supabase upsert on `organization_calendar_integrations`.
- Help link: short instructions panel with the exact scopes to request:
  - Google: `https://www.googleapis.com/auth/calendar.events`, `openid email`
  - Microsoft: `Calendars.ReadWrite`, `User.Read`, `offline_access`

Non-admin org users see a banner: "Calendar integrations are configured by your administrator."

### 5. End-user UI

Expand existing `CalendarSyncSection.tsx` in Profile:
- Keep ICS card as-is.
- New "Connected Calendars" card that lists the providers the admin enabled for the org.
- Per provider: status (Not connected / Connected as `email`), Connect button → calls `calendar-oauth-start`, Disconnect, "Sync now", calendar picker (fetched after connect), sync_enabled toggle.

### 6. Notifications / sidebar

- No new top-level nav.
- Reuse notification system to alert the user when their token is revoked (provider returns `invalid_grant`).

### Files to create
- `supabase/functions/calendar-oauth-start/index.ts`
- `supabase/functions/calendar-oauth-callback/index.ts`
- `supabase/functions/calendar-sync-push/index.ts`
- `supabase/functions/calendar-sync-pull/index.ts`
- `supabase/functions/calendar-sync-scanner/index.ts`
- `src/components/settings/CalendarIntegrationsAdmin.tsx`
- `src/components/profile/ConnectedCalendarsCard.tsx`
- Migration: tables, RLS, trigger replacement, hourly cron.

### Files to edit
- `src/pages/Settings.tsx` — register new admin tab.
- `src/components/profile/CalendarSyncSection.tsx` — mount `ConnectedCalendarsCard` underneath ICS.
- `supabase/config.toml` — add `verify_jwt = false` for `calendar-oauth-callback` only (public redirect target).

### Technical notes
- Microsoft Graph uses `https://graph.microsoft.com/v1.0/me/events` and delta query for incremental sync; tokens via `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`.
- Google uses `https://oauth2.googleapis.com/token` + `https://www.googleapis.com/calendar/v3/calendars/{calId}/events` with `syncToken`.
- Redirect URI is a single fixed URL per platform: `{SUPABASE_URL}/functions/v1/calendar-oauth-callback`. Admins paste this same URI into their own OAuth client config when using custom credentials.
- All timestamps stored UTC; tasks' `planned_start` / `planned_end` are dates today — sync uses 09:00–17:00 UTC default for date-only tasks, configurable later.
- Currency rule unchanged (no money fields).
- Identity: account email is system-side; UI displays `first_name last_name` from `profiles` plus the Google/MS email as a small caption.

### What needs user input before sync can run
Platform-managed credentials (so users don't all need their own OAuth app):
- `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`
- `MICROSOFT_CALENDAR_CLIENT_ID`, `MICROSOFT_CALENDAR_CLIENT_SECRET`
- `CALENDAR_OAUTH_STATE_SECRET` (any random 32+ char string — I'll auto-suggest a generated value)

I'll request these via the secrets tool right after the migration so you can paste them while I build the UI and edge functions in parallel.