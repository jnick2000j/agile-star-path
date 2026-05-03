# Platform Features (operator overview)

This page summarises every functional module shipped in the platform so on-prem
operators know what to expect, what tables/edge functions back each module, and
where the typical operational pitfalls are. End-user documentation lives inside
the app at **Documentation** in the sidebar; the same material is also covered
by the in-app AI assistant ("Ask the Task Master").

For methodology guidance (PRINCE2, MSP, Agile, ITIL Change Enablement,
HDI/KCS), point users at the in-app **Documentation → Methodology** tab — it is
identical between cloud and on-prem builds.

---

## Programme & project delivery

| Module                    | Where in the app             | Notes |
|---------------------------|------------------------------|-------|
| Programmes (MSP)          | Programmes, Programme Details| Definition, Blueprint, Tranches, Success Plan tabs |
| Projects (PRINCE2)        | Projects, Project Details    | PRINCE2 / Agile / Hybrid / Waterfall methodologies |
| Products                  | Products, Product Details    | Roadmap, Feature Backlog, Sprint Planning, Dependencies |
| Work Packages             | Work Packages                | Constraints, tolerances, story points |
| Tasks (with sub-tasks)    | Tasks                        | Linkable to programme/project/product/work-package/feature |
| Stage Gates & Milestones  | Stage Gates, Milestones      | Go/no-go decisions, stage boundaries |
| Updates                   | Updates                      | Frequency settings, mandatory toggles, reminders |
| Cross-entity registers    | Risks, Issues, Benefits,     | All filterable by programme/project/product |
|                           | Stakeholders, Lessons,       | Cross-entity traceability links everywhere |
|                           | Quality, Exceptions          | |

**Backed by**: `programmes`, `projects`, `products`, `work_packages`, `tasks`,
`task_assignments`, `milestones`, `stage_gates`, `risks`, `issues`, `benefits`,
`stakeholders`, `lessons_learned`, `quality_reviews`, `exceptions`.

---

## Helpdesk / ITSM

End-to-end ticket lifecycle aligned with ITIL 4 + HDI + KCS.

| Capability                | Notes |
|---------------------------|-------|
| Tickets                   | Incident / Service Request / Problem / Question / Support |
| Ticket detail header      | Status / Priority / Type on row 1; editable Programme / Project / Product dropdowns on row 2 (changes audited via `helpdesk_ticket_activity`) |
| Action bar                | Single-row square buttons: **SLA / CSAT**, **People**, **Log time**, **Resolution**, **Mark as Resolved**, convert-to-task, declare major incident |
| Tabs (single row)         | Conversation, CI & Problem Mgmt (linked CIs + catalog request + linked problem + approvals), Parent/Child, Catalog, Knowledge, Attachments, Activity |
| Sub-tickets / parent      | Parent/Child dialog persists `parent_ticket_id` immediately, supports drag & drop reparenting, bulk parent set, cascade delete with reparent; every change written to the activity log |
| AI Ticket Intake          | Conversation → categorised ticket, suggested KB articles |
| SLA policies              | Response & resolution targets per priority/type; pause on customer-pending |
| Helpdesk workflows        | Visual rule editor: triggers → conditions → actions → approvals |
| Approval chains           | Sequential approvers, technical/business/security triad slots |
| Inbound email             | Tickets/comments via the helpdesk email address |
| Macros                    | Pre-canned replies and bulk-action templates |
| CSAT                      | Survey on resolution; feeds the dashboard. Opened from the **SLA / CSAT** action button |
| People dialog             | Assignees + watchers managed from a single dialog launched from the action bar |
| Service Requests tab      | Dedicated agent view filtered to service-request tickets |
| Module toggles            | Per-org enable/disable for Problem Mgmt, CMDB, Service Catalog, Status Page, Major Incident Management |

**Edge functions**: `helpdesk-inbound-email`, `helpdesk-notify`,
`helpdesk-workflow-runner`, `helpdesk-workflow-approve`, `ai-ticket-intake`,
`sla-escalation-engine`, `sla-escalation-scanner`.

**Operator notes**:
- Inbound email requires an SMTP gateway that can forward to the
  `helpdesk-inbound-email` HTTP endpoint (Postmark, SendGrid Inbound, mailgun
  routes, or your own MX → webhook script). Cloud deployments use Resend Inbound;
  on-prem operators provide their own.
- The workflow runner runs on Postgres triggers + a 1-minute cron tick. If
  workflows appear "stuck", check `docker compose logs edge | grep workflow`.
- **Module toggles** are stored in `organization_module_toggles` and gate the
  Problem, CMDB, Service Catalog, Status Page and Major Incident sidebar
  entries. Org admins toggle modules from **Helpdesk → Admin → Modules**;
  platform admins can override any org from **Platform Admin → Module
  Toggles**. The same row drives the in-app sidebar visibility.
- **Activity / audit trail**: every parent-child change, catalog selection,
  Programme/Project/Product reassignment, status transition and SLA/CSAT event
  is written to `helpdesk_ticket_activity` and surfaced under the ticket's
  **Activity** tab (formerly "Audit"). The legacy "Activity" tab was removed —
  there is now a single source of truth.

---

## Service Catalog (ITSM)

Self-service ordering of standardised services with form fields, approval
chains, sequential fulfillment tasks and notifications.

| Capability                       | Notes |
|----------------------------------|-------|
| Categories                       | Color + lucide icon picker (Server, Printer, Laptop, Database, …) |
| Catalog items                    | Name, description, default priority, cost (USD), SLA hours, active flag |
| Custom request fields            | text, textarea, select, multiselect, number, checkbox, date, user-picker |
| Approval policies                | None / Requester's manager / Specific users (sequential) |
| Sequential fulfillment tasks     | Each item can predefine ordered tasks; on approval the first task spawns as a child ticket and the next is auto-spawned when the prior one is resolved/closed |
| Per-task assignee                | Admin picks the assignee per task at the catalog item level |
| Notifications                    | First approver notified on submission; next approver notified on advance; requester notified on final decision and on each fulfillment ticket creation |
| Activity audit                   | `catalog_task_spawned`, approval decisions and submissions logged in `helpdesk_ticket_activity` |
| Public browse                    | `/catalog` with category filter + icons |
| Admin                            | `/catalog/admin` and Helpdesk → Admin → Service Catalog |

**Tables**: `service_catalog_categories` (with `icon` column),
`service_catalog_items`, `service_catalog_item_fields`,
`service_catalog_item_tasks`, `service_catalog_request_data`,
`service_catalog_request_approvals`.

**DB function/trigger**: `helpdesk_spawn_next_catalog_task`,
`trg_helpdesk_catalog_task_close` (fires on `helpdesk_tickets` resolved/closed).

**Operator notes**:
- The trigger is idempotent — it tracks `metadata->>catalog_task_id` on each
  child ticket to determine the next step.
- Approver lookups query `user_organization_access` then `profiles` (no
  PostgREST FK between the two — fetch is performed in two steps).

---

## Knowledge Base (KB)

Markdown articles plus a vector index for semantic search and ticket
suggestions.

**Edge functions**: `kb-ingest-upload`, `kb-embed`, `kb-search`,
`kb-suggest-for-ticket`.

**Operator notes**:
- Embedding uses your configured AI provider. If you're on Ollama, ensure the
  configured embedding model (default `nomic-embed-text`) is pulled:
  `docker compose exec ollama ollama pull nomic-embed-text`.
- Bulk re-embedding can be triggered from **Admin Panel → Knowledge Base →
  Re-index**. Expect ~30 ms per chunk on Ollama / a few ms on a hosted provider.
- Storage: PDF/DOCX uploads land in the `kb-uploads` storage bucket. Plan for
  ~5× the source size due to OCR/Markdown intermediates.

---

## Timesheets

Weekly timesheets with submission/approval signatures, PDF export and email
delivery.

**Edge function**: `email-timesheet`.

**Operator notes**:
- Per-entity opt-in: the picker only shows programmes/projects/products with
  `timesheets_enabled = true`. Toggle on the entity detail page.
- An org setting **restrict_time_logging_to_assigned_tasks** (Settings →
  General → Timesheet restrictions) blocks non-admins from logging time on
  tasks they're not assigned to. A `BEFORE INSERT/UPDATE` trigger on
  `timesheet_entries` enforces this server-side — it cannot be bypassed by
  URL/API tampering.
- "Log Time" Clock icon in the Tasks list pre-fills the current week with the
  selected task. The icon respects the same authorisation rules.

---

## Automations

Cross-module rule engine: trigger → conditions → actions, with approval gates
for destructive actions.

**Edge functions**: `automation-runner` (event + cron driven),
`automation-approve` (approver decisions).

**Operator notes**:
- Long-running automations run on a 1-minute cron. Heavy fan-out (e.g. "remind
  every overdue task assignee") is batched 50/cycle to stay within Postgres
  connection limits.
- Failed runs log to `automation_runs` with `status = 'failed'` and a
  `last_error`. Surface in **Admin Panel → Automations → Run history**.

---

## AI features

| Feature                | Endpoint                  |
|------------------------|---------------------------|
| Ask the Task Master    | `task-master-chat`        |
| AI Field Assist        | `ai-draft`                |
| AI Draft Wizards       | `ai-draft`, `ai-draft-chat` |
| AI Summary Panels      | `ai-summarize`            |
| AI Insights Scanner    | `ai-insights-scan`        |
| AI Advisor             | `ai-advisor`              |
| AI Translate           | `ai-translate`            |
| AI Search              | `ai-search`               |
| Risk Insights          | `risk-insights`           |
| AI Ticket Intake       | `ai-ticket-intake`        |
| Comms Pack Generator   | `generate-comms-pack`     |
| Governance Reports     | `generate-governance-report` |

All AI endpoints route through `_shared/ai-provider.ts`, which honours your
configured provider (Ollama / OpenAI / Azure / Anthropic) and per-org credit
limits. See [ai-provider.md](./ai-provider.md).

**AI Approvals**: every draft from any of the above is recorded; admin-approval
gating is configurable per organisation under **Settings → Security → AI
Approvals**.

---

## Construction / industry verticals

Modules that appear when the org's `industry_vertical` selects a vertical pack
that exposes them.

| Module               | Verticals where shown                          |
|----------------------|------------------------------------------------|
| Daily Logs           | Construction, Public Sector (infrastructure)   |
| RFIs                 | Construction, Engineering                      |
| Submittals           | Construction                                   |
| Punch List           | Construction                                   |
| Vertical Entity Reg. | Healthcare, FinServ, Public Sector (etc.)      |
| Verticals Docs       | All verticals                                  |
| Engagements/Retainers| Professional Services, Consulting              |

Vertical packs are seeded from `src/lib/verticalSeedPacks.ts` and applied by the
**Org Onboarding Wizard**. To switch a live org, an admin uses **Admin Panel →
Organization → Industry vertical**.

---

## External portals

| Portal                  | URL                       | Audience |
|-------------------------|---------------------------|----------|
| Stakeholder Portal      | `/stakeholder-portal`     | Read-only external stakeholders |
| Support Portal          | `/support-portal`         | Customers raising helpdesk tickets |
| Change Control Portal   | `/change-control-portal`  | Public Forward Schedule of Change |

All portals respect the same RLS policies as the main app — invited users are
created with `stakeholder` access level.

---

## Authentication & access

| Capability         | Endpoint / surface         | Notes |
|--------------------|----------------------------|-------|
| Email + password   | GoTrue (`auth` container)  | Default |
| MFA (TOTP)         | `mfa-manage`               | Per-user toggle, org-wide enforcement |
| SAML SSO           | `register-tenant-saml`     | New requests queue for platform admins |
| OIDC SSO           | `register-tenant-oidc`     | Same flow as SAML |
| SCIM 2.0           | `scim-v2`                  | IdP-driven user provisioning, token-auth |
| Session management | `session-manage`           | View + revoke active sessions |
| Stakeholder access | `StakeholderAccessSettings`| Per-org configuration |
| Dynamic RBAC       | Admin Panel → Roles        | Granular per-module permissions |

---

## Notifications & dispatch

In-app bell + email, all events flow through the `notification-dispatcher`
edge function.

Centralised event types include:
`task_assigned`, `task_updated`, `task_assignment_added`,
`timesheet_submitted`, `timesheet_decision`,
`workflow_assignment`, `workflow_decision`,
`change_activity`, `milestone_change`,
`org_suspension`, `sso_request`.

**Operator notes**:
- Per-user channel preferences live in `profiles.notification_preferences`.
- For email delivery, the dispatcher uses the SMTP relay configured in
  [smtp.md](./smtp.md). Cloud uses Resend; on-prem uses your SMTP provider.
- Hourly cron entrypoints: `check-update-reminders`, `check-notifications`.
- Weekly cron: `summarize-weekly-report` then `send-weekly-report`.

---

## Billing, plans & add-ons

For **on-prem** the entire Stripe layer is hidden — the platform uses license
entitlements instead. See [license.md](./license.md). The following endpoints
are still in the bundle for hybrid deployments:

- `create-checkout`, `create-portal-session`, `cancel-subscription`,
  `get-stripe-price`, `sync-plan-to-stripe`, `payments-webhook`,
  `manage-ai-credit-packs`.

**Operator notes**:
- If you are running fully on-prem, set `DEPLOYMENT_MODE=on_prem` in `.env`.
  This makes the front-end use `useDeploymentMode` to hide all checkout UI.
- Hybrid customers (cloud billing + on-prem data plane) need outbound HTTPS
  to `api.stripe.com` from the `edge` container.

---

## Learning Management (LMS) — optional add-on

End-to-end internal training: courses, lessons, quizzes, certificates,
learning paths, and manager analytics. Disabled by default — enable per org
from **Helpdesk → Admin → Modules** or platform-wide from **Platform Admin
→ Module Toggles** (`organization_module_toggles.lms`).

| Capability                | Notes |
|---------------------------|-------|
| Courses & modules         | Markdown/video/file lessons grouped into modules; soft-delete safe |
| Quizzes                   | Per-lesson quizzes with single/multi-choice, attempt tracking, pass thresholds |
| Enrollments               | Self-enroll, manager-assign, or learning-path driven; auto-recompute progress |
| Lesson progress           | Per-user, per-lesson; rolls up via `lms_recompute_enrollment` RPC |
| Learning paths            | Ordered course bundles, progress aggregated across courses |
| Certificates              | Issued on completion, stored in the private `lms-certificates` bucket |
| Manager dashboard         | `/learning/dashboard` — completion rates, overdue assignments, training compliance |
| Catalog                   | `/learning` — browseable course catalog filtered by org access |
| Course editor             | `/learning/admin/courses/:id` — markdown editor, lesson reordering, quiz wiring |
| Quiz editor               | `/learning/admin/lessons/:id/quiz` — question/option authoring |
| AI: course recommend      | `/recommend-courses` chat command — vector search over `lms_course_chunks` |
| AI: lesson complete       | `/complete-lesson` chat command — fuzzy matches lesson title and updates progress |
| Vector search             | `lms_course_chunks` populated by `lms-embed-course` (chunked + embedded) |

**Pages**: `LmsCatalog`, `MyLearning`, `CourseDetail`, `LmsAdmin`,
`LmsCourseEditor`, `LmsQuizEditor`, `LmsManagerDashboard`.

**Tables**: `lms_courses`, `lms_modules`, `lms_lessons`, `lms_lesson_progress`,
`lms_enrollments`, `lms_assignments`, `lms_quiz_questions`, `lms_quiz_options`,
`lms_quiz_attempts`, `lms_certificates`, `lms_learning_paths`,
`lms_learning_path_courses`, `lms_course_chunks` (vector index).

**Edge functions**: `lms-chat-command` (Task Master `/complete-lesson` and
`/recommend-courses`), `lms-embed-course` (chunks lesson content and writes
embeddings via `LOVABLE_API_KEY` → AI gateway).

**Storage buckets**: `lms-content` (private — lesson media, attachments) and
`lms-certificates` (private — generated PDFs). Both signed via
`createSignedUrl`. See [object-storage.md](./object-storage.md).

**RPC / DB function**: `lms_recompute_enrollment(_course_id uuid)` — call after
lesson progress changes to roll up enrollment status.

**Operator notes**:
- LMS is an **add-on module** (`ADDON_MODULE_KEYS = ["lms"]`). It is OFF by
  default; turn it on per org or globally before users see the **Learning**
  sidebar entry.
- AI features (`/recommend-courses`, `lms-embed-course`) reuse the same
  `LOVABLE_API_KEY` / `AI_*` configuration as the rest of the platform — no
  extra keys to issue. See [ai-provider.md](./ai-provider.md).
- The two LMS storage buckets must exist on whatever S3-compatible backend
  you've configured (`lms-content`, `lms-certificates`) — `scripts/install.sh`
  provisions both alongside `taskmaster-uploads`.
- After bulk-importing or editing course content, re-run the embedder:
  `curl -X POST https://<host>/functions/v1/lms-embed-course -H "Authorization: Bearer $SERVICE_KEY" -d '{"course_id":"<uuid>"}'`.

---

## Audit, compliance & SIEM

| Capability               | Surface                  | Notes |
|--------------------------|--------------------------|-------|
| Audit log                | DB: `audit_log` table    | Every status change, RLS-respecting reads |
| Audit log export         | `export-audit-log`       | CSV/JSON, admin-only |
| SIEM export              | `siem-export`            | Streamable / pollable, JSON lines |
| Compliance scoring       | Compliance Rule Editor   | Org-defined rules, auto-scored |
| Governance reports       | `generate-governance-report` | PDF/MD report from audit + compliance |
| Email-domain verification| `verify-domain`          | Required before sending org-branded emails |

---

## Data residency

`organizations.data_region` constrains which AI provider and which storage
region a tenant may use. `residency_enforcement` is `warn` or `block`. See
[architecture.md](./architecture.md) for storage routing and
[ai-provider.md](./ai-provider.md) for AI provider region pinning.

---

## What's intentionally NOT in on-prem

- Stripe checkout / billing portal UI (use license entitlements instead).
- Outbound telemetry to `updates.taskmaster.app` (off by default).
- Cross-tenant analytics on the platform admin's dashboard (cloud only).

If a customer needs any of the above, they need to opt into hybrid mode —
contact your account team.
