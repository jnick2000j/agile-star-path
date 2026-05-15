## OKR Module — Lightweight, Cycles → Objectives → Key Results → Check-ins

Add an org-scoped OKR module that fits alongside the Benefits Register, reusing existing patterns (RLS via `has_org_access`, notifications dispatcher, weekly report cron, AI summary panels).

### 1. Database (migration)

New tables, all `organization_id`-scoped with RLS:

- **`okr_cycles`** — name, period_type (`quarterly`/`annual`/`custom`), start_date, end_date, status (`planned`/`active`/`closed`), grading_scale (default 0.0–1.0).
- **`okr_objectives`** — cycle_id, parent_objective_id (cascading), owner_user_id, scope (`org`/`programme`/`project`/`team`/`individual`), programme_id/project_id/product_id (nullable links), title, description, category, status, final_grade, final_commentary.
- **`okr_key_results`** — objective_id, owner_user_id, title, metric_type (`number`/`percent`/`currency`/`boolean`/`milestone`), start_value, target_value, current_value, unit, progress_pct (computed/stored), confidence (0.0–1.0), status, weight.
- **`okr_checkins`** — key_result_id, user_id, checkin_date, previous_value, new_value, progress_pct, confidence, commentary, blockers.
- **`okr_objective_alignments`** — optional many-to-many for cross-team alignment beyond parent.
- **`okr_settings`** — per-org: checkin_cadence (`weekly`/`biweekly`), checkin_day_of_week, reminder_enabled, cycle_reminder_days_before_end.

RLS: standard `has_org_access(organization_id)` SELECT; INSERT/UPDATE/DELETE gated to org members; Org Admin full rights. Triggers: auto-recompute `key_result.progress_pct` and `current_value` from latest check-in; recompute `objective.progress` (weighted avg of KRs); `updated_at` triggers; `status_history` audit on objective/cycle status changes.

### 2. Frontend pages & components

- **`/okrs`** — Cycle picker + dashboard: active objectives grid, overall org progress, confidence heatmap, alignment tree view, filter by owner/scope/programme/project.
- **`/okrs/cycles`** — Cycle list + create/edit dialog, close-cycle flow (triggers grading).
- **`/okrs/objectives/:id`** — Objective detail: KR list with sparkline progress, check-in history, child objectives (cascading view), alignment links.
- **`/okrs/checkins`** — "My check-ins this week" — quick entry form per KR (new value + confidence slider + commentary).
- **`/okrs/grading`** — End-of-cycle grading workspace for closed cycles: per-objective final grade (auto-suggested from KR avg), commentary, lessons learned link.
- **Sidebar entry** under Strategy/Programmes section, gated by `useModuleToggles` (`okrs` flag).
- Reuse: `Badge` for confidence/status, `Progress` bars, `Recharts` for trend lines, AI Summary panel, status filter popovers.

### 3. Notifications & emails

- Reuse `notification-dispatcher` with new event types: `okr_checkin_due`, `okr_checkin_missed`, `okr_confidence_dropped`, `okr_cycle_starting`, `okr_cycle_ending`, `okr_objective_assigned`, `okr_grading_due`.
- New cron-driven edge function **`okr-reminder-scanner`** (hourly): finds KR owners due for check-in based on `okr_settings.checkin_cadence`, queues bell + email notifications. Also fires cycle start/end reminders.
- Email templates (transactional, per-recipient): "Your weekly OKR check-in is due", "Cycle ending in 7 days — time to grade", "Confidence dropped on [KR]". Wired through existing transactional email infrastructure.
- Weekly report (`summarize-weekly-report`): include OKR progress section per recipient — objectives at risk (confidence < 0.4), KRs without check-ins this week, trending grades.

### 4. Module toggle

Add `okrs` to `organization_module_toggles` so org admins can enable/disable from Helpdesk → Admin → Modules pattern (or new Strategy admin tab). Off by default.

### 5. Memory

Add `mem://features/okr-module` describing the module and update index Core line: "OKR module: org-scoped cycles → objectives → KRs → check-ins, weighted progress, confidence 0.0–1.0, gated by `okrs` module toggle."

### Technical notes

- Progress aggregation: trigger on `okr_checkins` insert → updates parent KR `current_value`, `progress_pct`, `confidence`; second trigger on KR update → recomputes objective progress as weighted avg; cascading objective progress rolls up to parent objectives.
- Final grade suggestion: average of KR `progress_pct` weighted by `weight`, surfaced as default in grading UI but editable.
- Alignment view: recursive CTE on `parent_objective_id` rendered as a tree.
- All currency in USD per project rules.
