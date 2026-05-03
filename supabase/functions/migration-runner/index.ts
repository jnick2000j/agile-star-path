// Background migration runner.
// Receives a job spec, returns immediately, then processes in the background
// via EdgeRuntime.waitUntil. Progress is written to migration_jobs.progress
// so the UI can poll the row for live updates.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RunRequest {
  jobId: string;
  source: "jira" | "jira_service_management" | "csv" | string;
  scope: {
    selectedProjectIds?: string[];
    includeClosed?: boolean;
    [k: string]: unknown;
  };
  mapping: {
    status?: Record<string, string>;
    priority?: Record<string, string>;
    [k: string]: unknown;
  };
  creds: Record<string, string>;
  files?: Record<string, { name: string; text: string }>;
}

const DEFAULT_STATUS_MAP: Record<string, string> = {
  "to do": "not_started",
  todo: "not_started",
  open: "not_started",
  backlog: "not_started",
  "not started": "not_started",
  "in progress": "in_progress",
  "in review": "in_progress",
  doing: "in_progress",
  blocked: "blocked",
  done: "completed",
  closed: "completed",
  resolved: "completed",
  completed: "completed",
};

const DEFAULT_PRIORITY_MAP: Record<string, string> = {
  critical: "high",
  highest: "high",
  high: "high",
  medium: "medium",
  normal: "medium",
  low: "low",
  lowest: "low",
};

function mapStatus(v: string | undefined, m: RunRequest["mapping"]): string {
  if (!v) return "not_started";
  const k = v.toLowerCase().trim();
  return m.status?.[k] ?? DEFAULT_STATUS_MAP[k] ?? "not_started";
}
function mapPriority(v: string | undefined, m: RunRequest["mapping"]): string {
  if (!v) return "medium";
  const k = v.toLowerCase().trim();
  return m.priority?.[k] ?? DEFAULT_PRIORITY_MAP[k] ?? "medium";
}

interface ProgressShape {
  done: number;
  total: number;
  message: string;
  updated_at: string;
}

interface SummaryShape {
  createdProjects: number;
  createdTasks: number;
  createdIssues: number;
  createdRisks: number;
  skipped: number;
  errors: { entity: string; externalId: string; message: string }[];
}

class JobContext {
  private lastFlush = 0;
  private flushInterval = 750; // ms
  done = 0;
  total = 0;
  constructor(
    private supa: SupabaseClient,
    public jobId: string,
    public organizationId: string,
    public userId: string,
  ) {}

  setTotal(n: number) {
    this.total = Math.max(this.total, n);
  }

  async tick(message: string, force = false) {
    this.done += 1;
    const now = Date.now();
    if (!force && now - this.lastFlush < this.flushInterval) return;
    this.lastFlush = now;
    const payload: ProgressShape = {
      done: this.done,
      total: Math.max(this.total, this.done),
      message: message.slice(0, 240),
      updated_at: new Date().toISOString(),
    };
    await this.supa
      .from("migration_jobs")
      .update({ progress: payload })
      .eq("id", this.jobId);
  }

  async flush(message: string) {
    this.lastFlush = 0;
    await this.tick(message, true);
    // tick increments done — undo the increment for forced flush
    this.done -= 1;
  }

  async recordItem(entry: {
    entity_type: string;
    external_id: string;
    external_key?: string;
    internal_id?: string;
    status: "pending" | "created" | "skipped" | "failed";
    error?: string;
  }) {
    await this.supa.from("migration_items").upsert(
      {
        job_id: this.jobId,
        organization_id: this.organizationId,
        entity_type: entry.entity_type,
        external_id: entry.external_id,
        external_key: entry.external_key ?? null,
        internal_id: entry.internal_id ?? null,
        status: entry.status,
        error: entry.error ?? null,
      },
      { onConflict: "job_id,entity_type,external_id" },
    );
  }
}

// ---------- CSV parser ----------

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") {
        cur.push(field);
        field = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && src[i + 1] === "\n") i++;
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = "";
      } else field += ch;
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows
    .slice(1)
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        obj[h] = (r[idx] ?? "").trim();
      });
      return obj;
    });
}

// ---------- CSV runner ----------

async function runCsv(
  ctx: JobContext,
  req: RunRequest,
  summary: SummaryShape,
): Promise<void> {
  const files = req.files ?? {};
  const projectRows = files.projects ? parseCsv(files.projects.text) : [];
  const taskRows = files.tasks ? parseCsv(files.tasks.text) : [];
  const issueRows = files.issues ? parseCsv(files.issues.text) : [];
  const riskRows = files.risks ? parseCsv(files.risks.text) : [];

  const selected = new Set(req.scope.selectedProjectIds ?? []);
  const isDefault = selected.has("__csv_default__");

  ctx.setTotal(
    (isDefault ? 1 : selected.size) +
      taskRows.length +
      issueRows.length +
      riskRows.length,
  );

  const supa = (ctx as unknown as { supa: SupabaseClient }).supa;
  const projectIdMap = new Map<string, string>();
  let defaultProjectId: string | null = null;

  const insertProject = async (
    row: Record<string, string>,
    fallbackName: string,
  ) => {
    const { data, error } = await supa
      .from("projects")
      .insert({
        organization_id: ctx.organizationId,
        name: row.name || row.title || fallbackName,
        description: row.description ?? null,
        stage: row.stage ?? "initiating",
        priority: mapPriority(row.priority, req.mapping),
        health: row.health ?? "green",
        methodology: row.methodology ?? "Hybrid",
        start_date: row.start_date || null,
        end_date: row.end_date || null,
        created_by: ctx.userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  };

  if (isDefault) {
    try {
      defaultProjectId = await insertProject(
        {},
        `CSV import ${new Date().toLocaleDateString()}`,
      );
      summary.createdProjects += 1;
      await ctx.recordItem({
        entity_type: "project",
        external_id: "__csv_default__",
        internal_id: defaultProjectId,
        status: "created",
      });
      await ctx.tick("Default project");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.errors.push({
        entity: "project",
        externalId: "__csv_default__",
        message: msg,
      });
    }
  } else {
    for (const row of projectRows) {
      const ext = row.external_id || row.id;
      if (!ext || !selected.has(ext)) continue;
      try {
        const id = await insertProject(row, ext);
        projectIdMap.set(ext, id);
        summary.createdProjects += 1;
        await ctx.recordItem({
          entity_type: "project",
          external_id: ext,
          internal_id: id,
          status: "created",
        });
        await ctx.tick(`Project: ${row.name || ext}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        summary.errors.push({ entity: "project", externalId: ext, message: msg });
        await ctx.recordItem({
          entity_type: "project",
          external_id: ext,
          status: "failed",
          error: msg,
        });
      }
    }
  }

  const resolveProject = (row: Record<string, string>): string | null => {
    if (defaultProjectId) return defaultProjectId;
    const ext = row.project_external_id;
    if (ext && projectIdMap.has(ext)) return projectIdMap.get(ext)!;
    return null;
  };

  // Tasks
  for (const row of taskRows) {
    const projId = resolveProject(row);
    const ext = row.external_id || row.id || row.name || `task-${ctx.done}`;
    if (!projId) {
      summary.skipped += 1;
      await ctx.recordItem({
        entity_type: "task",
        external_id: ext,
        status: "skipped",
        error: "No matching project",
      });
      await ctx.tick(`Skipped task: ${ext}`);
      continue;
    }
    try {
      const { data, error } = await supa
        .from("tasks")
        .insert({
          organization_id: ctx.organizationId,
          project_id: projId,
          name: row.name || row.title || ext,
          description: row.description || null,
          status: mapStatus(row.status, req.mapping),
          priority: mapPriority(row.priority, req.mapping),
          planned_start: row.planned_start || null,
          planned_end: row.planned_end || row.due_date || null,
          created_by: ctx.userId,
        })
        .select("id")
        .single();
      if (error) throw error;
      summary.createdTasks += 1;
      await ctx.recordItem({
        entity_type: "task",
        external_id: ext,
        internal_id: data.id,
        status: "created",
      });
      await ctx.tick(`Task: ${row.name || ext}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.errors.push({ entity: "task", externalId: ext, message: msg });
      await ctx.recordItem({
        entity_type: "task",
        external_id: ext,
        status: "failed",
        error: msg,
      });
    }
  }

  // Issues
  for (const row of issueRows) {
    const projId = resolveProject(row);
    const ext = row.external_id || row.id || row.title || `issue-${ctx.done}`;
    if (!projId) {
      summary.skipped += 1;
      await ctx.recordItem({
        entity_type: "issue",
        external_id: ext,
        status: "skipped",
        error: "No matching project",
      });
      await ctx.tick(`Skipped issue: ${ext}`);
      continue;
    }
    try {
      const status = mapStatus(row.status, req.mapping);
      const { data, error } = await supa
        .from("issues")
        .insert({
          organization_id: ctx.organizationId,
          project_id: projId,
          title: row.title || row.name || ext,
          description: row.description || null,
          type: row.type || "problem",
          priority: mapPriority(row.priority, req.mapping),
          status: status === "completed" ? "closed" : "open",
          created_by: ctx.userId,
        })
        .select("id")
        .single();
      if (error) throw error;
      summary.createdIssues += 1;
      await ctx.recordItem({
        entity_type: "issue",
        external_id: ext,
        internal_id: data.id,
        status: "created",
      });
      await ctx.tick(`Issue: ${row.title || ext}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.errors.push({ entity: "issue", externalId: ext, message: msg });
      await ctx.recordItem({
        entity_type: "issue",
        external_id: ext,
        status: "failed",
        error: msg,
      });
    }
  }

  // Risks
  for (const row of riskRows) {
    const projId = resolveProject(row);
    const ext = row.external_id || row.id || row.title || `risk-${ctx.done}`;
    if (!projId) {
      summary.skipped += 1;
      await ctx.recordItem({
        entity_type: "risk",
        external_id: ext,
        status: "skipped",
        error: "No matching project",
      });
      await ctx.tick(`Skipped risk: ${ext}`);
      continue;
    }
    try {
      const { data, error } = await supa
        .from("risks")
        .insert({
          organization_id: ctx.organizationId,
          project_id: projId,
          title: row.title || row.name || ext,
          description: row.description || null,
          created_by: ctx.userId,
        })
        .select("id")
        .single();
      if (error) throw error;
      summary.createdRisks += 1;
      await ctx.recordItem({
        entity_type: "risk",
        external_id: ext,
        internal_id: data.id,
        status: "created",
      });
      await ctx.tick(`Risk: ${row.title || ext}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.errors.push({ entity: "risk", externalId: ext, message: msg });
      await ctx.recordItem({
        entity_type: "risk",
        external_id: ext,
        status: "failed",
        error: msg,
      });
    }
  }
}

// ---------- Jira runner ----------

interface JiraCreds {
  base_url?: string;
  email?: string;
  api_token?: string;
}

async function jiraFetch<T>(
  c: JiraCreds,
  path: string,
): Promise<T> {
  const u = (c.base_url ?? "").trim().replace(/\/+$/, "");
  if (!u) throw new Error("Jira base URL is required");
  const auth = btoa(`${c.email}:${c.api_token}`);
  const res = await fetch(`${u}${path}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${auth}`,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Jira ${res.status}: ${body.slice(0, 200) || res.statusText}`);
  }
  return (await res.json()) as T;
}

async function runJira(
  ctx: JobContext,
  req: RunRequest,
  summary: SummaryShape,
): Promise<void> {
  const c = req.creds as JiraCreds;
  const supa = (ctx as unknown as { supa: SupabaseClient }).supa;
  const projectIds = req.scope.selectedProjectIds ?? [];
  if (projectIds.length === 0) return;

  // Discover all projects, filter to selected
  const all = await jiraFetch<{ values: { id: string; key: string; name: string; description?: string }[] }>(
    c,
    "/rest/api/3/project/search?maxResults=100",
  );
  const chosen = (all.values ?? []).filter((p) => projectIds.includes(p.id));
  ctx.setTotal(chosen.length);

  const projMap = new Map<string, string>();
  for (const p of chosen) {
    try {
      const { data, error } = await supa
        .from("projects")
        .insert({
          organization_id: ctx.organizationId,
          name: p.name,
          description: p.description ?? `Imported from Jira (${p.key})`,
          stage: "initiating",
          priority: "medium",
          health: "green",
          methodology: "Agile",
          created_by: ctx.userId,
        })
        .select("id")
        .single();
      if (error) throw error;
      projMap.set(p.id, data.id);
      summary.createdProjects += 1;
      await ctx.recordItem({
        entity_type: "project",
        external_id: p.id,
        external_key: p.key,
        internal_id: data.id,
        status: "created",
      });
      await ctx.tick(`Project: ${p.name}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.errors.push({ entity: "project", externalId: p.id, message: msg });
      await ctx.recordItem({
        entity_type: "project",
        external_id: p.id,
        external_key: p.key,
        status: "failed",
        error: msg,
      });
    }
  }

  for (const p of chosen) {
    const internalId = projMap.get(p.id);
    if (!internalId) continue;
    const jql = encodeURIComponent(
      `project = ${p.id}${req.scope.includeClosed ? "" : " AND statusCategory != Done"}`,
    );
    let startAt = 0;
    const pageSize = 100;
    while (true) {
      let page: {
        issues: {
          id: string;
          key: string;
          fields: {
            summary?: string;
            description?: string;
            issuetype?: { name?: string };
            status?: { name?: string };
            priority?: { name?: string };
            duedate?: string;
          };
        }[];
        total: number;
      };
      try {
        page = await jiraFetch(
          c,
          `/rest/api/3/search?jql=${jql}&fields=summary,description,issuetype,status,priority,duedate&startAt=${startAt}&maxResults=${pageSize}`,
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        summary.errors.push({
          entity: "task",
          externalId: `${p.key}@${startAt}`,
          message: msg,
        });
        break;
      }

      ctx.setTotal(ctx.done + (page.total - startAt));

      const issueTypeMap =
        ((req.mapping as { extra?: { issueType?: Record<string, string> } }).extra?.issueType) ?? {};

      for (const issue of page.issues) {
        const type = issue.fields.issuetype?.name?.toLowerCase() ?? "task";
        const target = issueTypeMap[type] ?? (type === "risk" ? "risk" : (type === "bug" || type === "incident") ? "issue" : "task");
        const isRisk = target === "risk";
        const isIssue = target === "issue";
        try {
          if (isRisk) {
            const { data, error } = await supa
              .from("risks")
              .insert({
                organization_id: ctx.organizationId,
                project_id: internalId,
                title: issue.fields.summary ?? issue.key,
                description: issue.fields.description ?? null,
                created_by: ctx.userId,
              })
              .select("id")
              .single();
            if (error) throw error;
            summary.createdRisks += 1;
            await ctx.recordItem({
              entity_type: "risk",
              external_id: issue.id,
              external_key: issue.key,
              internal_id: data.id,
              status: "created",
            });
          } else if (isIssue) {
            const status = mapStatus(issue.fields.status?.name, req.mapping);
            const { data, error } = await supa
              .from("issues")
              .insert({
                organization_id: ctx.organizationId,
                project_id: internalId,
                title: issue.fields.summary ?? issue.key,
                description: issue.fields.description ?? null,
                type: "problem",
                priority: mapPriority(issue.fields.priority?.name, req.mapping),
                status: status === "completed" ? "closed" : "open",
                created_by: ctx.userId,
              })
              .select("id")
              .single();
            if (error) throw error;
            summary.createdIssues += 1;
            await ctx.recordItem({
              entity_type: "issue",
              external_id: issue.id,
              external_key: issue.key,
              internal_id: data.id,
              status: "created",
            });
          } else {
            const { data, error } = await supa
              .from("tasks")
              .insert({
                organization_id: ctx.organizationId,
                project_id: internalId,
                name: issue.fields.summary ?? issue.key,
                description: issue.fields.description ?? null,
                status: mapStatus(issue.fields.status?.name, req.mapping),
                priority: mapPriority(issue.fields.priority?.name, req.mapping),
                planned_end: issue.fields.duedate ?? null,
                created_by: ctx.userId,
              })
              .select("id")
              .single();
            if (error) throw error;
            summary.createdTasks += 1;
            await ctx.recordItem({
              entity_type: "task",
              external_id: issue.id,
              external_key: issue.key,
              internal_id: data.id,
              status: "created",
            });
          }
          await ctx.tick(`${issue.key}: ${issue.fields.summary ?? ""}`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          summary.errors.push({
            entity: isRisk ? "risk" : isIssue ? "issue" : "task",
            externalId: issue.id,
            message: msg,
          });
          await ctx.recordItem({
            entity_type: isRisk ? "risk" : isIssue ? "issue" : "task",
            external_id: issue.id,
            external_key: issue.key,
            status: "failed",
            error: msg,
          });
        }
      }

      startAt += page.issues.length;
      if (startAt >= page.total || page.issues.length === 0) break;
    }
  }
}

// ---------- Jira Service Management runner ----------

interface JsmCreds {
  base_url?: string;
  email?: string;
  api_token?: string;
}

async function jsmFetch<T>(c: JsmCreds, path: string): Promise<T> {
  const u = (c.base_url ?? "").trim().replace(/\/+$/, "");
  if (!u) throw new Error("Atlassian site URL is required");
  const auth = btoa(`${c.email}:${c.api_token}`);
  const res = await fetch(`${u}${path}`, {
    headers: {
      Accept: "application/json",
      "X-ExperimentalApi": "opt-in",
      Authorization: `Basic ${auth}`,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`JSM ${res.status}: ${body.slice(0, 200) || res.statusText}`);
  }
  return (await res.json()) as T;
}

interface JsmUserDto {
  accountId?: string;
  emailAddress?: string;
  displayName?: string;
}

interface JsmRequestDto {
  issueId: string;
  issueKey: string;
  requestTypeId?: string;
  serviceDeskId?: string;
  createdDate?: { iso8601?: string };
  reporter?: JsmUserDto;
  requestFieldValues?: { fieldId: string; label?: string; value?: unknown }[];
  currentStatus?: { status?: string; statusDate?: { iso8601?: string } };
}

interface JsmOrganizationDto {
  id: number | string;
  name: string;
}

async function runJsm(
  ctx: JobContext,
  req: RunRequest,
  summary: SummaryShape,
): Promise<void> {
  const c = req.creds as JsmCreds;
  const supa = (ctx as unknown as { supa: SupabaseClient }).supa;
  const serviceDeskIds = req.scope.selectedProjectIds ?? [];
  if (serviceDeskIds.length === 0) return;

  // ---- Contact directory dedupe cache (job-scoped) ----
  // Key = "p:<accountId>" | "p:e:<lower(email)>" | "o:<extId>" | "o:n:<lower(name)>"
  // Value = directory id + linked stakeholder id (if promoted)
  type DirCacheEntry = { id: string; linkedStakeholderId: string | null };
  const directoryCache = new Map<string, DirCacheEntry>();

  const personKeys = (accountId?: string | null, email?: string | null) => {
    const keys: string[] = [];
    if (accountId) keys.push(`p:${accountId}`);
    if (email) keys.push(`p:e:${email.toLowerCase()}`);
    return keys;
  };
  const orgKeys = (extId?: string | null, name?: string | null) => {
    const keys: string[] = [];
    if (extId) keys.push(`o:${extId}`);
    if (name) keys.push(`o:n:${name.toLowerCase()}`);
    return keys;
  };

  /**
   * Resolve (or create) a directory entry, returning its id. Updates
   * last_seen_at + ticket_count and reuses any prior stakeholder link so the
   * same person/org is reused across every ticket they appear on.
   */
  const resolveDirectory = async (
    contactType: "person" | "organization",
    payload: {
      external_account_id?: string | null;
      email?: string | null;
      display_name?: string | null;
      organization_name?: string | null;
      raw?: unknown;
    },
  ): Promise<DirCacheEntry | null> => {
    const keys =
      contactType === "person"
        ? personKeys(payload.external_account_id, payload.email)
        : orgKeys(payload.external_account_id, payload.organization_name);
    if (keys.length === 0) return null;

    // Cache hit?
    for (const k of keys) {
      const hit = directoryCache.get(k);
      if (hit) {
        // Bump usage in DB but reuse cached id
        await supa
          .from("migration_contact_directory")
          .update({
            last_seen_at: new Date().toISOString(),
            ticket_count: undefined,
          })
          .eq("id", hit.id);
        // Increment via RPC-less pattern: small race is acceptable here
        await supa.rpc("increment_directory_ticket_count", { _id: hit.id }).then(
          () => {},
          () => {},
        );
        return hit;
      }
    }

    // DB lookup using our unique-index columns
    let existing:
      | { id: string; linked_stakeholder_id: string | null }
      | null = null;
    if (payload.external_account_id) {
      const { data } = await supa
        .from("migration_contact_directory")
        .select("id,linked_stakeholder_id")
        .eq("organization_id", ctx.organizationId)
        .eq("source", "jira_service_management")
        .eq("contact_type", contactType)
        .eq("external_account_id", payload.external_account_id)
        .maybeSingle();
      if (data) existing = data;
    }
    if (!existing && contactType === "person" && payload.email) {
      const { data } = await supa
        .from("migration_contact_directory")
        .select("id,linked_stakeholder_id")
        .eq("organization_id", ctx.organizationId)
        .eq("source", "jira_service_management")
        .eq("contact_type", "person")
        .ilike("email", payload.email)
        .is("external_account_id", null)
        .maybeSingle();
      if (data) existing = data;
    }
    if (!existing && contactType === "organization" && payload.organization_name) {
      const { data } = await supa
        .from("migration_contact_directory")
        .select("id,linked_stakeholder_id")
        .eq("organization_id", ctx.organizationId)
        .eq("source", "jira_service_management")
        .eq("contact_type", "organization")
        .ilike("organization_name", payload.organization_name)
        .is("external_account_id", null)
        .maybeSingle();
      if (data) existing = data;
    }

    let entry: DirCacheEntry;
    if (existing) {
      entry = { id: existing.id, linkedStakeholderId: existing.linked_stakeholder_id };
      await supa
        .from("migration_contact_directory")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", existing.id);
      await supa.rpc("increment_directory_ticket_count", { _id: existing.id }).then(
        () => {},
        () => {},
      );
    } else {
      const { data, error } = await supa
        .from("migration_contact_directory")
        .insert({
          organization_id: ctx.organizationId,
          source: "jira_service_management",
          contact_type: contactType,
          external_account_id: payload.external_account_id ?? null,
          email: payload.email ?? null,
          display_name: payload.display_name ?? null,
          organization_name: payload.organization_name ?? null,
          ticket_count: 1,
          raw: (payload.raw ?? null) as Record<string, unknown> | null,
        })
        .select("id,linked_stakeholder_id")
        .single();
      if (error || !data) return null;
      entry = { id: data.id, linkedStakeholderId: data.linked_stakeholder_id };
    }

    for (const k of keys) directoryCache.set(k, entry);
    return entry;
  };

  /** Promote a directory entry to the Stakeholder register (idempotent). */
  const ensureStakeholderForDirectory = async (
    dirId: string,
    role: string,
    payload: {
      display_name?: string | null;
      email?: string | null;
      organization_name?: string | null;
    },
  ): Promise<string | null> => {
    const cached = [...directoryCache.values()].find((e) => e.id === dirId);
    if (cached?.linkedStakeholderId) return cached.linkedStakeholderId;

    // Re-check from DB in case another loop iteration already promoted it
    const { data: dirRow } = await supa
      .from("migration_contact_directory")
      .select("linked_stakeholder_id")
      .eq("id", dirId)
      .maybeSingle();
    if (dirRow?.linked_stakeholder_id) {
      if (cached) cached.linkedStakeholderId = dirRow.linked_stakeholder_id;
      return dirRow.linked_stakeholder_id;
    }

    const name = payload.display_name
      ?? payload.organization_name
      ?? payload.email
      ?? "Unknown contact";

    // Reuse pre-existing manually-created stakeholder with the same email
    let stakeholderId: string | null = null;
    if (payload.email) {
      const { data } = await supa
        .from("stakeholders")
        .select("id")
        .eq("organization_id", ctx.organizationId)
        .ilike("email", payload.email)
        .maybeSingle();
      if (data) stakeholderId = data.id;
    }
    if (!stakeholderId && payload.organization_name && !payload.email) {
      const { data } = await supa
        .from("stakeholders")
        .select("id")
        .eq("organization_id", ctx.organizationId)
        .is("email", null)
        .ilike("organization", payload.organization_name)
        .maybeSingle();
      if (data) stakeholderId = data.id;
    }

    if (!stakeholderId) {
      const { data, error } = await supa
        .from("stakeholders")
        .insert({
          organization_id: ctx.organizationId,
          name,
          email: payload.email ?? null,
          organization: payload.organization_name ?? null,
          role:
            role === "customer_organization" ? "Customer organization"
              : role === "reporter" ? "Service requester"
              : role === "participant" ? "Service participant"
              : "Service assignee",
          influence: "medium",
          interest: "medium",
          engagement: "neutral",
          created_by: ctx.userId,
        })
        .select("id")
        .single();
      if (error || !data) return null;
      stakeholderId = data.id;
    }

    await supa
      .from("migration_contact_directory")
      .update({ linked_stakeholder_id: stakeholderId })
      .eq("id", dirId);
    if (cached) cached.linkedStakeholderId = stakeholderId;
    return stakeholderId;
  };

  // Expose for the per-ticket loop below via closure
  (ctx as unknown as {
    _resolveDirectory: typeof resolveDirectory;
    _ensureStakeholderForDirectory: typeof ensureStakeholderForDirectory;
  })._resolveDirectory = resolveDirectory;
  (ctx as unknown as {
    _ensureStakeholderForDirectory: typeof ensureStakeholderForDirectory;
  })._ensureStakeholderForDirectory = ensureStakeholderForDirectory;

  // Discover service desks for project metadata
  const all = await jsmFetch<{
    values: { id: string; projectId: string; projectKey: string; projectName: string }[];
  }>(c, "/rest/servicedeskapi/servicedesk?limit=100");
  const chosen = (all.values ?? []).filter((sd) => serviceDeskIds.includes(sd.id));
  ctx.setTotal(chosen.length);

  // Create one internal project per service desk
  const projMap = new Map<string, string>(); // serviceDeskId -> internal project id
  for (const sd of chosen) {
    try {
      const { data, error } = await supa
        .from("projects")
        .insert({
          organization_id: ctx.organizationId,
          name: `${sd.projectName} (Service Desk)`,
          description: `Imported from Jira Service Management (${sd.projectKey})`,
          stage: "executing",
          priority: "medium",
          health: "green",
          methodology: "ITIL",
          created_by: ctx.userId,
        })
        .select("id")
        .single();
      if (error) throw error;
      projMap.set(sd.id, data.id);
      summary.createdProjects += 1;
      await ctx.recordItem({
        entity_type: "project",
        external_id: sd.id,
        external_key: sd.projectKey,
        internal_id: data.id,
        status: "created",
      });
      await ctx.tick(`Service desk: ${sd.projectName}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.errors.push({ entity: "project", externalId: sd.id, message: msg });
      await ctx.recordItem({
        entity_type: "project",
        external_id: sd.id,
        external_key: sd.projectKey,
        status: "failed",
        error: msg,
      });
    }
  }

  // Fetch + import customer requests per service desk
  for (const sd of chosen) {
    const projectId = projMap.get(sd.id);
    if (!projectId) continue;

    let start = 0;
    const pageSize = 50;
    while (true) {
      let page: { values: JsmRequestDto[]; isLastPage: boolean; size: number };
      try {
        page = await jsmFetch(
          c,
          `/rest/servicedeskapi/request?serviceDeskId=${sd.id}&expand=status,requestType&start=${start}&limit=${pageSize}`,
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        summary.errors.push({
          entity: "issue",
          externalId: `${sd.projectKey}@${start}`,
          message: msg,
        });
        break;
      }

      ctx.setTotal(ctx.done + page.values.length);

      const requestTypeMap =
        ((req.mapping as { extra?: { requestType?: Record<string, string> } }).extra?.requestType) ?? {};
      const requestTypeLabels =
        ((req.mapping as { extra?: { requestTypeLabels?: Record<string, string> } }).extra?.requestTypeLabels) ?? {};

      for (const r of page.values) {
        const summaryField = r.requestFieldValues?.find((f) => f.fieldId === "summary");
        const descField = r.requestFieldValues?.find((f) => f.fieldId === "description");
        const priorityField = r.requestFieldValues?.find((f) => f.fieldId === "priority");
        const statusName = r.currentStatus?.status ?? "Open";
        const statusKey = statusName.toLowerCase().trim();
        const priorityValue = (() => {
          const v = priorityField?.value as { name?: string } | string | undefined;
          if (typeof v === "string") return v;
          return v?.name;
        })();
        const internalPriority = mapPriority(priorityValue, req.mapping);
        const reporter = r.reporter
          ? `\n\n_Reporter: ${r.reporter.displayName ?? ""} <${r.reporter.emailAddress ?? ""}>_`
          : "";
        const rtLabel = r.requestTypeId ? requestTypeLabels[r.requestTypeId] ?? r.requestTypeId : "";
        const reqTypeNote = rtLabel ? `\n_Request type: ${rtLabel}_` : "";
        const baseDescription = `${(descField?.value as string) ?? ""}${reporter}${reqTypeNote}`;
        const title = ((summaryField?.value as string) ?? r.issueKey).slice(0, 240);

        // Determine target register from request type mapping (default: issue)
        const target = (r.requestTypeId && requestTypeMap[r.requestTypeId]) || "issue";

        // Resolve register-specific workflow status:
        //   1. Per-request-type override (highest precedence)
        //   2. Global status map (fallback) translated into register-specific term
        const requestTypeStatusMap = ((req.mapping as {
          extra?: { requestTypeStatus?: Record<string, Record<string, string>> };
        }).extra?.requestTypeStatus) ?? {};
        const overrideForType = r.requestTypeId
          ? requestTypeStatusMap[r.requestTypeId]
          : undefined;
        const overrideStatus = overrideForType?.[statusKey];
        const genericStatus = mapStatus(statusName, req.mapping); // not_started|in_progress|blocked|completed

        const resolveStatus = (forTarget: string): string => {
          if (overrideStatus) return overrideStatus;
          // Translate the generic status into the target register's vocabulary
          switch (forTarget) {
            case "incident":
              return genericStatus === "completed" ? "resolved"
                : genericStatus === "blocked" ? "monitoring"
                : genericStatus === "in_progress" ? "identified"
                : "investigating";
            case "problem":
              return genericStatus === "completed" ? "resolved"
                : genericStatus === "in_progress" ? "investigating"
                : "new";
            case "change":
              return genericStatus === "completed" ? "implemented"
                : genericStatus === "in_progress" ? "under_review"
                : genericStatus === "blocked" ? "needs_information"
                : "pending";
            case "risk":
              return genericStatus === "completed" ? "closed"
                : genericStatus === "in_progress" ? "mitigating"
                : "open";
            case "task":
              return genericStatus; // already in task vocabulary
            case "issue":
            default:
              return genericStatus === "completed" ? "closed"
                : genericStatus === "in_progress" ? "in_progress"
                : "open";
          }
        };

        try {
          let internalEntityType = "issue";
          let internalId: string | null = null;

          if (target === "incident") {
            const severity =
              internalPriority === "high" ? "sev1" :
              internalPriority === "medium" ? "sev2" : "sev3";
            const { data, error } = await supa
              .from("major_incidents")
              .insert({
                organization_id: ctx.organizationId,
                title,
                description: baseDescription,
                severity,
                status: resolveStatus("incident"),
                created_by: ctx.userId,
              })
              .select("id")
              .single();
            if (error) throw error;
            internalEntityType = "incident";
            internalId = data.id;
            summary.createdIssues += 1;
          } else if (target === "problem") {
            const { data, error } = await supa
              .from("problems")
              .insert({
                organization_id: ctx.organizationId,
                project_id: projectId,
                title,
                description: baseDescription,
                status: resolveStatus("problem"),
                priority: internalPriority,
                is_known_error: false,
                created_by: ctx.userId,
              })
              .select("id")
              .single();
            if (error) throw error;
            internalEntityType = "problem";
            internalId = data.id;
            summary.createdIssues += 1;
          } else if (target === "change") {
            const { data, error } = await supa
              .from("change_requests")
              .insert({
                organization_id: ctx.organizationId,
                project_id: projectId,
                reference_number: r.issueKey,
                title,
                description: baseDescription,
                change_type: "standard",
                status: resolveStatus("change"),
                priority: internalPriority,
                date_raised: new Date().toISOString().slice(0, 10),
                raised_by: ctx.userId,
                created_by: ctx.userId,
              })
              .select("id")
              .single();
            if (error) throw error;
            internalEntityType = "change";
            internalId = data.id;
            summary.createdIssues += 1;
          } else if (target === "task") {
            const { data, error } = await supa
              .from("tasks")
              .insert({
                organization_id: ctx.organizationId,
                project_id: projectId,
                name: title,
                description: baseDescription,
                status: resolveStatus("task"),
                priority: internalPriority,
                created_by: ctx.userId,
              })
              .select("id")
              .single();
            if (error) throw error;
            internalEntityType = "task";
            internalId = data.id;
            summary.createdTasks += 1;
          } else if (target === "risk") {
            const { data, error } = await supa
              .from("risks")
              .insert({
                organization_id: ctx.organizationId,
                project_id: projectId,
                title,
                description: baseDescription,
                status: resolveStatus("risk"),
                created_by: ctx.userId,
              })
              .select("id")
              .single();
            if (error) throw error;
            internalEntityType = "risk";
            internalId = data.id;
            summary.createdRisks += 1;
          } else {
            // default → issue register
            const issueStatus = resolveStatus("issue");
            const { data, error } = await supa
              .from("issues")
              .insert({
                organization_id: ctx.organizationId,
                project_id: projectId,
                title,
                description: baseDescription,
                type: "problem",
                priority: internalPriority,
                // issues table only has open/closed/in_progress in practice
                status: issueStatus === "in_progress" ? "open" : issueStatus,
                created_by: ctx.userId,
              })
              .select("id")
              .single();
            if (error) throw error;
            internalEntityType = "issue";
            internalId = data.id;
            summary.createdIssues += 1;
          }

          // Fetch + persist SLA metrics for this request (best-effort)
          if (internalId) {
            try {
              const slaResp = await jsmFetch<{
                values: {
                  name: string;
                  ongoingCycle?: {
                    breached?: boolean;
                    elapsedTime?: { millis?: number };
                    remainingTime?: { millis?: number };
                    goalDuration?: { millis?: number };
                    startTime?: { iso8601?: string };
                  };
                  completedCycles?: {
                    breached?: boolean;
                    elapsedTime?: { millis?: number };
                    remainingTime?: { millis?: number };
                    goalDuration?: { millis?: number };
                    startTime?: { iso8601?: string };
                    stopTime?: { iso8601?: string };
                  }[];
                }[];
              }>(c, `/rest/servicedeskapi/request/${r.issueKey}/sla`);

              const slaRows = (slaResp.values ?? []).map((s) => {
                const last = s.completedCycles?.[s.completedCycles.length - 1];
                const cyc = s.ongoingCycle ?? last;
                const cycleState = s.ongoingCycle ? "ongoing" : last ? "completed" : null;
                const minutes = (ms?: number) =>
                  typeof ms === "number" ? Math.round(ms / 60000) : null;
                return {
                  organization_id: ctx.organizationId,
                  job_id: ctx.jobId,
                  entity_type: internalEntityType,
                  entity_id: internalId,
                  external_id: r.issueId,
                  external_key: r.issueKey,
                  sla_name: s.name,
                  elapsed_minutes: minutes(cyc?.elapsedTime?.millis),
                  remaining_minutes: minutes(cyc?.remainingTime?.millis),
                  goal_minutes: minutes(cyc?.goalDuration?.millis),
                  breached: !!cyc?.breached,
                  cycle_state: cycleState,
                  started_at: cyc?.startTime?.iso8601 ?? null,
                  completed_at: last?.stopTime?.iso8601 ?? null,
                };
              });

              if (slaRows.length > 0) {
                await supa.from("migration_sla_metrics").insert(slaRows);
              }
            } catch {
              // SLAs are best-effort; ignore failures (no Service Desk Agent
              // permission, request type without SLAs, etc.)
            }

            // Fetch + persist contacts (reporter, participants, customer orgs)
            // — gated by the user's contactRouting choices on the wizard.
            try {
              const routingDefaults: Record<string, "attach_only" | "attach_and_stakeholder" | "skip"> = {
                reporter: "attach_only",
                participant: "attach_only",
                customer_organization: "attach_and_stakeholder",
                assignee: "attach_only",
              };
              const routingFromMapping =
                ((req.mapping as { extra?: { contactRouting?: Record<string, string> } }).extra
                  ?.contactRouting) ?? {};
              const routing = { ...routingDefaults, ...routingFromMapping } as Record<
                string,
                "attach_only" | "attach_and_stakeholder" | "skip"
              >;

              const contactRows: Record<string, unknown>[] = [];
              const stakeholderRows: Record<string, unknown>[] = [];

              const pushContact = (
                role: string,
                payload: {
                  account_id?: string | null;
                  display_name?: string | null;
                  email?: string | null;
                  customer_organization_id?: string | null;
                  customer_organization_name?: string | null;
                  raw: unknown;
                },
              ) => {
                const mode = routing[role] ?? "attach_only";
                if (mode === "skip") return;
                contactRows.push({
                  organization_id: ctx.organizationId,
                  job_id: ctx.jobId,
                  entity_type: internalEntityType,
                  entity_id: internalId,
                  external_id: r.issueId,
                  external_key: r.issueKey,
                  role,
                  account_id: payload.account_id ?? null,
                  display_name: payload.display_name ?? null,
                  email: payload.email ?? null,
                  customer_organization_id: payload.customer_organization_id ?? null,
                  customer_organization_name: payload.customer_organization_name ?? null,
                  raw: payload.raw as Record<string, unknown>,
                });
                if (mode === "attach_and_stakeholder") {
                  const name = payload.display_name
                    ?? payload.customer_organization_name
                    ?? payload.email
                    ?? "Unknown contact";
                  stakeholderRows.push({
                    organization_id: ctx.organizationId,
                    name,
                    email: payload.email ?? null,
                    organization: payload.customer_organization_name ?? null,
                    role:
                      role === "customer_organization" ? "Customer organization"
                        : role === "reporter" ? "Service requester"
                        : role === "participant" ? "Service participant"
                        : "Service assignee",
                    influence: "medium",
                    interest: "medium",
                    engagement: "neutral",
                    created_by: ctx.userId,
                  });
                }
              };

              // Reporter
              if (r.reporter) {
                pushContact("reporter", {
                  account_id: r.reporter.accountId,
                  display_name: r.reporter.displayName,
                  email: r.reporter.emailAddress,
                  raw: r.reporter,
                });
              }

              // Participants
              if (routing.participant !== "skip") {
                try {
                  const partResp = await jsmFetch<{ values: JsmUserDto[] }>(
                    c,
                    `/rest/servicedeskapi/request/${r.issueKey}/participant?limit=50`,
                  );
                  for (const p of partResp.values ?? []) {
                    if (p.accountId && r.reporter?.accountId === p.accountId) continue;
                    pushContact("participant", {
                      account_id: p.accountId,
                      display_name: p.displayName,
                      email: p.emailAddress,
                      raw: p,
                    });
                  }
                } catch { /* optional */ }
              }

              // Customer organizations
              if (routing.customer_organization !== "skip") {
                try {
                  const orgResp = await jsmFetch<{ values: JsmOrganizationDto[] }>(
                    c,
                    `/rest/servicedeskapi/request/${r.issueKey}/organization?limit=50`,
                  );
                  for (const o of orgResp.values ?? []) {
                    pushContact("customer_organization", {
                      customer_organization_id: String(o.id),
                      customer_organization_name: o.name,
                      display_name: o.name,
                      raw: o,
                    });
                  }
                } catch { /* optional */ }
              }

              if (contactRows.length > 0) {
                await supa.from("migration_contacts").insert(contactRows);
              }
              if (stakeholderRows.length > 0) {
                // Best-effort dedupe: skip stakeholders that already exist for
                // this org with the same email or organization name.
                const emails = stakeholderRows
                  .map((s) => s.email)
                  .filter((e): e is string => typeof e === "string");
                const orgs = stakeholderRows
                  .map((s) => s.organization)
                  .filter((o): o is string => typeof o === "string");
                const existing = new Set<string>();
                if (emails.length || orgs.length) {
                  const { data: ex } = await supa
                    .from("stakeholders")
                    .select("email,organization")
                    .eq("organization_id", ctx.organizationId)
                    .or(
                      [
                        emails.length ? `email.in.(${emails.map((e) => `"${e}"`).join(",")})` : "",
                        orgs.length ? `organization.in.(${orgs.map((o) => `"${o}"`).join(",")})` : "",
                      ]
                        .filter(Boolean)
                        .join(","),
                    );
                  for (const row of (ex ?? []) as { email?: string; organization?: string }[]) {
                    if (row.email) existing.add(`e:${row.email.toLowerCase()}`);
                    if (row.organization) existing.add(`o:${row.organization.toLowerCase()}`);
                  }
                }
                const fresh = stakeholderRows.filter((s) => {
                  const e = (s.email as string | null)?.toLowerCase();
                  const o = (s.organization as string | null)?.toLowerCase();
                  if (e && existing.has(`e:${e}`)) return false;
                  if (o && existing.has(`o:${o}`)) return false;
                  if (e) existing.add(`e:${e}`);
                  if (o) existing.add(`o:${o}`);
                  return true;
                });
                if (fresh.length > 0) {
                  await supa.from("stakeholders").insert(fresh);
                }
              }
            } catch {
              // Contacts are best-effort
            }
          }

          await ctx.recordItem({
            entity_type: internalEntityType,
            external_id: r.issueId,
            external_key: r.issueKey,
            internal_id: internalId ?? undefined,
            status: "created",
          });
          await ctx.tick(`${r.issueKey} → ${target}: ${title}`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          summary.errors.push({ entity: target, externalId: r.issueId, message: msg });
          await ctx.recordItem({
            entity_type: target,
            external_id: r.issueId,
            external_key: r.issueKey,
            status: "failed",
            error: msg,
          });
        }
      }

      start += page.values.length;
      if (page.isLastPage || page.values.length === 0) break;
    }
  }
}

declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void } | undefined;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Identify the caller from their JWT
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = (await req.json()) as RunRequest;
    if (!body?.jobId || !body?.source) {
      return new Response(JSON.stringify({ error: "jobId and source are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service-role client for actual writes (RLS-bypassing — safe because we
    // verified the user above and the job row was created under their RLS).
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Load + validate the job belongs to the caller's org
    const { data: job, error: jobErr } = await admin
      .from("migration_jobs")
      .select("*")
      .eq("id", body.jobId)
      .single();
    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Confirm caller has admin access to that org
    const { data: hasAccess } = await admin.rpc("has_org_access", {
      _user_id: userId,
      _org_id: job.organization_id,
    });
    const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: userId });
    if (!hasAccess || !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (job.status === "running") {
      return new Response(
        JSON.stringify({ error: "Job is already running" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Mark running
    await admin
      .from("migration_jobs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
        progress: { done: 0, total: 0, message: "Starting…", updated_at: new Date().toISOString() },
        error_summary: null,
      })
      .eq("id", body.jobId);

    const ctx = new JobContext(admin, body.jobId, job.organization_id, userId);
    // expose private supa via cast for runners
    (ctx as unknown as { supa: SupabaseClient }).supa = admin;

    const work = (async () => {
      const summary: SummaryShape = {
        createdProjects: 0,
        createdTasks: 0,
        createdIssues: 0,
        createdRisks: 0,
        skipped: 0,
        errors: [],
      };
      try {
        if (body.source === "csv") {
          await runCsv(ctx, body, summary);
        } else if (body.source === "jira") {
          await runJira(ctx, body, summary);
        } else if (body.source === "jira_service_management") {
          await runJsm(ctx, body, summary);
        } else {
          throw new Error(`Unknown source: ${body.source}`);
        }

        await admin
          .from("migration_jobs")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            totals: {
              projects: summary.createdProjects,
              tasks: summary.createdTasks,
              issues: summary.createdIssues,
              risks: summary.createdRisks,
              skipped: summary.skipped,
              errors: summary.errors.length,
            },
            error_summary: summary.errors.length
              ? `${summary.errors.length} item(s) failed`
              : null,
            progress: {
              done: ctx.done,
              total: Math.max(ctx.total, ctx.done),
              message: "Done",
              updated_at: new Date().toISOString(),
              summary,
            },
          })
          .eq("id", body.jobId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await admin
          .from("migration_jobs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_summary: msg,
            progress: {
              done: ctx.done,
              total: Math.max(ctx.total, ctx.done),
              message: msg.slice(0, 240),
              updated_at: new Date().toISOString(),
              summary,
            },
          })
          .eq("id", body.jobId);
      }
    })();

    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(work);
    } else {
      // local/dev fallback — fire and forget
      work.catch(() => {});
    }

    return new Response(
      JSON.stringify({ ok: true, jobId: body.jobId, status: "running" }),
      {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
