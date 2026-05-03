import { supabase } from "@/integrations/supabase/client";
import { recordMigrationItem } from "../runner";
import type {
  FieldMapping,
  ImportSummary,
  MigrationContext,
  MigrationCredentials,
  MigrationScope,
  MigrationSourceAdapter,
  PreviewResult,
  RemoteProject,
} from "../types";

/**
 * Jira Cloud REST v3 adapter.
 *
 * Auth: Atlassian email + API token (Basic auth). Users create a token at
 *   https://id.atlassian.com/manage-profile/security/api-tokens
 *
 * NOTE: Browser-side fetch will hit CORS on Atlassian. In production this
 * adapter's HTTP calls should be proxied via an edge function. The adapter
 * is structured so swapping `jiraFetch` for an edge-function call is a
 * one-line change.
 */

interface JiraCreds extends MigrationCredentials {
  base_url?: string; // https://your-domain.atlassian.net
  email?: string;
  api_token?: string;
}

function authHeader(c: JiraCreds): string {
  const token = btoa(`${c.email}:${c.api_token}`);
  return `Basic ${token}`;
}

function baseUrl(c: JiraCreds): string {
  const u = (c.base_url ?? "").trim().replace(/\/+$/, "");
  if (!u) throw new Error("Jira base URL is required");
  return u;
}

async function jiraFetch<T>(c: JiraCreds, path: string, init?: RequestInit): Promise<T> {
  const url = `${baseUrl(c)}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authHeader(c),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Jira ${res.status}: ${body.slice(0, 200) || res.statusText}`);
  }
  return (await res.json()) as T;
}

// ---------- mapping helpers ----------

const DEFAULT_STATUS_MAP: Record<string, string> = {
  "to do": "not_started",
  "todo": "not_started",
  "open": "not_started",
  "backlog": "not_started",
  "in progress": "in_progress",
  "in review": "in_progress",
  "blocked": "blocked",
  "done": "completed",
  "closed": "completed",
  "resolved": "completed",
};

const DEFAULT_PRIORITY_MAP: Record<string, string> = {
  highest: "high",
  high: "high",
  medium: "medium",
  low: "low",
  lowest: "low",
};

function mapStatus(jiraStatus: string | undefined, mapping: FieldMapping): string {
  if (!jiraStatus) return "not_started";
  const key = jiraStatus.toLowerCase();
  return mapping.status?.[key] ?? DEFAULT_STATUS_MAP[key] ?? "not_started";
}

function mapPriority(jiraPriority: string | undefined, mapping: FieldMapping): string {
  if (!jiraPriority) return "medium";
  const key = jiraPriority.toLowerCase();
  return mapping.priority?.[key] ?? DEFAULT_PRIORITY_MAP[key] ?? "medium";
}

// ---------- adapter ----------

interface JiraProjectDto {
  id: string;
  key: string;
  name: string;
  description?: string;
}

interface JiraIssueDto {
  id: string;
  key: string;
  fields: {
    summary?: string;
    description?: string;
    issuetype?: { name?: string };
    status?: { name?: string };
    priority?: { name?: string };
    duedate?: string;
    project?: { id?: string; key?: string };
  };
}

export const jiraAdapter: MigrationSourceAdapter = {
  id: "jira",
  label: "Jira",
  description:
    "Import projects and issues from Jira Cloud. Issues become tasks (or risks/issues based on type).",
  credentialFields: [
    {
      name: "base_url",
      label: "Site URL",
      type: "url",
      placeholder: "https://your-domain.atlassian.net",
      required: true,
    },
    { name: "email", label: "Atlassian email", type: "email", required: true },
    {
      name: "api_token",
      label: "API token",
      type: "password",
      required: true,
      helpText: "Create at id.atlassian.com → Security → API tokens",
    },
  ],

  async testConnection(creds): Promise<RemoteProject[]> {
    const c = creds as JiraCreds;
    const data = await jiraFetch<{ values: JiraProjectDto[] }>(
      c,
      "/rest/api/3/project/search?maxResults=100",
    );
    return (data.values ?? []).map((p) => ({
      id: p.id,
      key: p.key,
      name: p.name,
      description: p.description,
    }));
  },

  async preview(creds, scope): Promise<PreviewResult> {
    const c = creds as JiraCreds;
    const projectIds = scope.selectedProjectIds ?? [];
    const counts: PreviewResult["counts"] = { project: projectIds.length, task: 0, issue: 0, risk: 0 };
    const warnings: string[] = [];

    for (const pid of projectIds) {
      // JQL count via search with maxResults=0 returns total
      const jql = encodeURIComponent(`project = ${pid}${scope.includeClosed ? "" : " AND statusCategory != Done"}`);
      try {
        const r = await jiraFetch<{ total: number }>(
          c,
          `/rest/api/3/search?jql=${jql}&maxResults=0`,
        );
        // Default: every Jira issue becomes a task. Bug → issue, etc. is decided per record.
        counts.task = (counts.task ?? 0) + r.total;
      } catch (e: unknown) {
        warnings.push(`Project ${pid}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return { projects: [], counts, warnings };
  },

  async suggestMapping(creds): Promise<FieldMapping> {
    const c = creds as JiraCreds;
    const status: Record<string, string> = { ...DEFAULT_STATUS_MAP };
    const priority: Record<string, string> = { ...DEFAULT_PRIORITY_MAP };
    const issueType: Record<string, string> = {};
    const discovered: { statuses: string[]; priorities: string[]; issueTypes: string[] } = {
      statuses: [],
      priorities: [],
      issueTypes: [],
    };

    try {
      const statuses = await jiraFetch<{ name: string }[]>(c, "/rest/api/3/status");
      for (const s of statuses) {
        const k = s.name.toLowerCase();
        discovered.statuses.push(k);
        if (!status[k]) status[k] = DEFAULT_STATUS_MAP[k] ?? "not_started";
      }
    } catch { /* optional */ }

    try {
      const prios = await jiraFetch<{ name: string }[]>(c, "/rest/api/3/priority");
      for (const p of prios) {
        const k = p.name.toLowerCase();
        discovered.priorities.push(k);
        if (!priority[k]) priority[k] = DEFAULT_PRIORITY_MAP[k] ?? "medium";
      }
    } catch { /* optional */ }

    try {
      const types = await jiraFetch<{ name: string }[]>(c, "/rest/api/3/issuetype");
      for (const t of types) {
        const k = t.name.toLowerCase();
        discovered.issueTypes.push(k);
        const isRisk = k === "risk";
        const isIssue = k === "bug" || k === "incident" || k === "problem";
        issueType[k] = isRisk ? "risk" : isIssue ? "issue" : "task";
      }
    } catch { /* optional */ }

    return {
      status,
      priority,
      extra: { issueType, discovered },
    };
  },

  async run(creds, scope, mapping, ctx: MigrationContext): Promise<ImportSummary> {
    const c = creds as JiraCreds;
    const summary: ImportSummary = {
      createdProjects: 0,
      createdTasks: 0,
      createdIssues: 0,
      createdRisks: 0,
      skipped: 0,
      errors: [],
    };

    const projectIds = scope.selectedProjectIds ?? [];
    if (projectIds.length === 0) return summary;

    // 1. Fetch chosen projects
    const allProjects = await this.testConnection(creds);
    const chosen = allProjects.filter((p) => projectIds.includes(p.id));

    let totalEstimate = chosen.length; // we'll grow as we discover issues
    let done = 0;
    const tick = (msg: string) => {
      done += 1;
      ctx.onProgress?.(done, Math.max(totalEstimate, done), msg);
    };

    // 2. Create internal projects
    const projectIdMap = new Map<string, string>(); // jiraProjectId -> internal projects.id
    for (const p of chosen) {
      try {
        const { data, error } = await supabase
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
        projectIdMap.set(p.id, data.id);
        summary.createdProjects += 1;
        await recordMigrationItem(ctx.jobId, ctx.organizationId, {
          entity_type: "project",
          external_id: p.id,
          external_key: p.key,
          internal_id: data.id,
          status: "created",
        });
        tick(`Project: ${p.name}`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        summary.errors.push({ entity: "project", externalId: p.id, message: msg });
        await recordMigrationItem(ctx.jobId, ctx.organizationId, {
          entity_type: "project",
          external_id: p.id,
          external_key: p.key,
          status: "failed",
          error: msg,
        });
      }
    }

    // 3. Fetch and import issues, paginated
    for (const p of chosen) {
      const internalProjectId = projectIdMap.get(p.id);
      if (!internalProjectId) continue;

      const jql = encodeURIComponent(
        `project = ${p.id}${scope.includeClosed ? "" : " AND statusCategory != Done"}`,
      );
      let startAt = 0;
      const pageSize = 100;
      while (true) {
        let page: { issues: JiraIssueDto[]; total: number };
        try {
          page = await jiraFetch(
            c,
            `/rest/api/3/search?jql=${jql}&fields=summary,description,issuetype,status,priority,duedate&startAt=${startAt}&maxResults=${pageSize}`,
          );
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          summary.errors.push({ entity: "task", externalId: `${p.key}@${startAt}`, message: msg });
          break;
        }

        totalEstimate = Math.max(totalEstimate, done + page.total - startAt);

        for (const issue of page.issues) {
          const type = issue.fields.issuetype?.name?.toLowerCase() ?? "task";
          const isRisk = type === "risk";
          const isIssue = type === "bug" || type === "incident";

          try {
            if (isRisk) {
              const { data, error } = await supabase
                .from("risks")
                .insert({
                  organization_id: ctx.organizationId,
                  project_id: internalProjectId,
                  title: issue.fields.summary ?? issue.key,
                  description: issue.fields.description ?? null,
                  created_by: ctx.userId,
                })
                .select("id")
                .single();
              if (error) throw error;
              summary.createdRisks += 1;
              await recordMigrationItem(ctx.jobId, ctx.organizationId, {
                entity_type: "risk",
                external_id: issue.id,
                external_key: issue.key,
                internal_id: data.id,
                status: "created",
              });
            } else if (isIssue) {
              const { data, error } = await supabase
                .from("issues")
                .insert({
                  organization_id: ctx.organizationId,
                  project_id: internalProjectId,
                  title: issue.fields.summary ?? issue.key,
                  description: issue.fields.description ?? null,
                  type: "problem",
                  priority: mapPriority(issue.fields.priority?.name, mapping),
                  status: mapStatus(issue.fields.status?.name, mapping) === "completed" ? "closed" : "open",
                  created_by: ctx.userId,
                })
                .select("id")
                .single();
              if (error) throw error;
              summary.createdIssues += 1;
              await recordMigrationItem(ctx.jobId, ctx.organizationId, {
                entity_type: "issue",
                external_id: issue.id,
                external_key: issue.key,
                internal_id: data.id,
                status: "created",
              });
            } else {
              const { data, error } = await supabase
                .from("tasks")
                .insert({
                  organization_id: ctx.organizationId,
                  project_id: internalProjectId,
                  name: issue.fields.summary ?? issue.key,
                  description: issue.fields.description ?? null,
                  status: mapStatus(issue.fields.status?.name, mapping) as never,
                  priority: mapPriority(issue.fields.priority?.name, mapping),
                  planned_end: issue.fields.duedate ?? null,
                  created_by: ctx.userId,
                })
                .select("id")
                .single();
              if (error) throw error;
              summary.createdTasks += 1;
              await recordMigrationItem(ctx.jobId, ctx.organizationId, {
                entity_type: "task",
                external_id: issue.id,
                external_key: issue.key,
                internal_id: data.id,
                status: "created",
              });
            }
            tick(`${issue.key}: ${issue.fields.summary ?? ""}`);
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            summary.errors.push({
              entity: isRisk ? "risk" : isIssue ? "issue" : "task",
              externalId: issue.id,
              message: msg,
            });
            await recordMigrationItem(ctx.jobId, ctx.organizationId, {
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

    return summary;
  },
};
