## Task Calendar Integration

Three layers, shipped together. All scoped to the existing `tasks` table (uses `planned_start`, `planned_end`, `assigned_to`, `organization_id`).

### 1. In-app Calendar View

New tab inside `Tasks.tsx` ("Calendar") next to Task Management / Sprint Planning / Backlog.

- New page `src/pages/TaskCalendar.tsx` using `react-big-calendar` (or `@fullcalendar/react` — leaning `react-big-calendar` for lighter weight, already pairs with date-fns).
- Month / Week / Day / Agenda views.
- Filters: My tasks / All org tasks / by project / programme / product / status / priority (reuse existing filter patterns).
- Drag-to-move and resize → updates `planned_start` / `planned_end`.
- Click event → opens existing task edit dialog.
- Color-codes by priority; strike-through for completed.
- Respects `has_org_access` RLS (no schema change needed).

### 2. ICS Subscription Feed

Per-user secure read-only calendar feed any client can subscribe to (Google / Outlook / Apple).

**DB (migration):**
- `task_calendar_tokens` — `user_id`, `organization_id`, `token` (random 48-char), `scope` (`my_tasks` | `org_tasks`), `revoked_at`, `last_accessed_at`. RLS: user can manage their own rows.

**Edge function `task-calendar-ics` (public, `verify_jwt = false`):**
- `GET /task-calendar-ics?token=...`
- Looks up token via service role, fetches matching tasks with `planned_start` set, returns `text/calendar` body (RFC 5545) with VEVENTs (UID = `task-{id}@pimp`, SUMMARY = task name, DTSTART/DTEND from planned dates, DESCRIPTION + URL back to task, STATUS mapped, LAST-MODIFIED for refresh).
- Updates `last_accessed_at`.

**UI (Profile → "Calendar Sync" section):**
- Generate / revoke / regenerate token.
- Show `webcal://…/functions/v1/task-calendar-ics?token=…` URL with copy button.
- Buttons: "Add to Google Calendar" (opens `https://calendar.google.com/calendar/r?cid=...`), "Add to Outlook", download `.ics` snapshot.

### 3. Google Calendar Two-Way Sync (per-user OAuth)

**Why per-user OAuth (not the connector):** the platform connector authenticates the workspace owner only. Each end-user must grant access to their own calendar.

**Setup the user must do once (documented in UI):**
- Create OAuth client in Google Cloud Console (scope: `https://www.googleapis.com/auth/calendar.events`).
- Paste Client ID + Secret into Cloud secrets (`GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`).

**DB (migration):**
- `user_google_calendar_connections` — `user_id` (unique), `google_account_email`, `target_calendar_id` (default `primary`), `access_token` (encrypted via pgsodium or stored as text — using text + RLS owner-only), `refresh_token`, `token_expires_at`, `sync_token` (incremental sync), `last_synced_at`, `sync_enabled`.
- `task_calendar_event_links` — `task_id`, `user_id`, `google_event_id`, `etag`, `last_pushed_at`, unique `(task_id, user_id)`.
- RLS: each user manages only their own rows.

**Edge functions:**
- `gcal-oauth-start` — builds Google consent URL, returns to client.
- `gcal-oauth-callback` — exchanges code → tokens, stores connection, redirects back to Profile.
- `gcal-sync-push` — for a given user, upserts/deletes Google events for their assigned tasks with planned dates (called on task save via DB trigger → pg_net, and on demand).
- `gcal-sync-pull` — incremental `events.list` with `syncToken`; if a linked event was moved/resized in Google, updates the task's `planned_start`/`planned_end`.
- `gcal-sync-scanner` — hourly cron, iterates `sync_enabled` users, runs pull then push, refreshes tokens.

**Triggers:**
- After insert/update/delete on `tasks` where `assigned_to` is set and `planned_start` is not null → `pg_net.http_post` to `gcal-sync-push` (best-effort; failure logged, not blocking).

**UI (Profile → "Calendar Sync" section, alongside ICS):**
- "Connect Google Calendar" button → starts OAuth.
- Connected state shows account email, target calendar dropdown (fetched once), Disconnect, "Sync now".
- Per-task badge "Synced to Google" when link row exists.

### 4. Module toggle & navigation

- Add `task_calendar` to `organization_module_toggles` (default on).
- Calendar tab inside Tasks page is gated by toggle.
- Sidebar gets no new top-level item — lives under existing Tasks.

### Technical notes

- `react-big-calendar` + `date-fns` localizer.
- Token format for ICS: `encode(random_bytes(36), 'base64url')`.
- All times stored UTC; ICS uses `DTSTART:YYYYMMDDTHHMMSSZ`.
- Google sync: handle 410 Gone on `syncToken` → fall back to full sync.
- Rate limiting on push: debounce per-user 10s in scanner; trigger uses NOTIFY queue table `gcal_sync_queue` instead of direct HTTP to avoid bursts.
- Currency rule (USD) untouched — no financial fields here.
- All emails in connection status shown as `first_name last_name` per identity rule (Google email kept as system identifier only).

### Files to create
- `src/pages/TaskCalendar.tsx`
- `src/components/profile/CalendarSyncSection.tsx`
- `supabase/functions/task-calendar-ics/index.ts`
- `supabase/functions/gcal-oauth-start/index.ts`
- `supabase/functions/gcal-oauth-callback/index.ts`
- `supabase/functions/gcal-sync-push/index.ts`
- `supabase/functions/gcal-sync-pull/index.ts`
- `supabase/functions/gcal-sync-scanner/index.ts`
- Migration: tables, RLS, trigger, hourly cron.

### Files to edit
- `src/pages/Tasks.tsx` — add Calendar tab.
- `src/pages/Profile.tsx` — mount `CalendarSyncSection`.
- `package.json` — add `react-big-calendar`.

### Secrets needed before Google sync works
- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`

I'll request these via the secrets tool when we get to step 3. Steps 1 (in-app calendar) and 2 (ICS feed) work without any secrets and can ship first.