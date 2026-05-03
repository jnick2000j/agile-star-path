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
 * Jira Service Management (JSM) adapter.
 *
 * Targets the Atlassian Service Desk REST API:
 *   /rest/servicedeskapi/servicedesk        → service desks (projects)
 *   /rest/servicedeskapi/servicedesk/{id}/queue/{qid}/issue → tickets per queue
 *   /rest/servicedeskapi/request?serviceDeskId=...           → customer requests
 *
 * Customer requests become internal **Issues** (since they map naturally to
 * helpdesk-style tickets), and Request Type, Reporter, and SLA metadata are
 * preserved on the description / fields where possible.
 *
 * The HTTP work is done in the migration-runner edge function (CORS-safe).
 * This file only describes the source for the wizard and forwards `run` to
 * the edge function via the standard runner.
 */

interface JsmCreds extends MigrationCredentials {
  base_url?: string; // https://your-domain.atlassian.net
  email?: string;
  api_token?: string;
}

function authHeader(c: JsmCreds): string {
  return `Basic ${btoa(`${c.email}:${c.api_token}`)}`;
}

function baseUrl(c: JsmCreds): string {
  const u = (c.base_url ?? "").trim().replace(/\/+$/, "");
  if (!u) throw new Error("Atlassian site URL is required");
  return u;
}

async function jsmFetch<T>(c: JsmCreds, path: string): Promise<T> {
  const res = await fetch(`${baseUrl(c)}${path}`, {
    headers: {
      Accept: "application/json",
      "X-ExperimentalApi": "opt-in",
      Authorization: authHeader(c),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`JSM ${res.status}: ${body.slice(0, 200) || res.statusText}`);
  }
  return (await res.json()) as T;
}

interface JsmServiceDeskDto {
  id: string;
  projectId: string;
  projectKey: string;
  projectName: string;
}

const DEFAULT_STATUS_MAP: Record<string, string> = {
  "waiting for support": "not_started",
  "waiting for customer": "in_progress",
  open: "not_started",
  "in progress": "in_progress",
  escalated: "blocked",
  resolved: "completed",
  closed: "completed",
  done: "completed",
  cancelled: "completed",
};

const DEFAULT_PRIORITY_MAP: Record<string, string> = {
  highest: "high",
  high: "high",
  medium: "medium",
  low: "low",
  lowest: "low",
};

export const jiraServiceManagementAdapter: MigrationSourceAdapter = {
  id: "jira_service_management",
  label: "Jira Service Management",
  description:
    "Import service desks and customer requests from Jira Service Management. Tickets become internal Issues with request type, reporter and SLA metadata preserved.",
  credentialFields: [
    {
      name: "base_url",
      label: "Atlassian site URL",
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
      helpText: "Create at id.atlassian.com → Security → API tokens. Needs Service Desk Agent access.",
    },
  ],

  async testConnection(creds): Promise<RemoteProject[]> {
    const c = creds as JsmCreds;
    const data = await jsmFetch<{ values: JsmServiceDeskDto[] }>(
      c,
      "/rest/servicedeskapi/servicedesk?limit=100",
    );
    return (data.values ?? []).map((sd) => ({
      id: sd.id, // service desk id (not project id) — used by /request?serviceDeskId=
      key: sd.projectKey,
      name: sd.projectName,
      meta: { projectId: sd.projectId },
    }));
  },

  async preview(creds, scope): Promise<PreviewResult> {
    const c = creds as JsmCreds;
    const ids = scope.selectedProjectIds ?? [];
    const counts: PreviewResult["counts"] = { project: ids.length, issue: 0 };
    const warnings: string[] = [];
    for (const id of ids) {
      try {
        const r = await jsmFetch<{ size: number; isLastPage: boolean }>(
          c,
          `/rest/servicedeskapi/request?serviceDeskId=${id}&limit=1&start=0`,
        );
        // The API doesn't return a total directly; show a hint instead.
        counts.issue = (counts.issue ?? 0) + (r.isLastPage ? r.size : -1);
      } catch (e: unknown) {
        warnings.push(`Service desk ${id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (counts.issue && counts.issue < 0) {
      warnings.unshift(
        "Exact ticket counts aren't returned by the JSM API. The importer will page through every request.",
      );
      counts.issue = undefined;
    }
    return { projects: [], counts, warnings };
  },

  async suggestMapping(creds, scope): Promise<FieldMapping> {
    const c = creds as JsmCreds;
    const status: Record<string, string> = { ...DEFAULT_STATUS_MAP };
    const priority: Record<string, string> = { ...DEFAULT_PRIORITY_MAP };
    const requestType: Record<string, string> = {};
    const requestTypeLabels: Record<string, string> = {};
    const discovered: {
      statuses: string[];
      priorities: string[];
      issueTypes: string[];
      requestTypes: string[];
    } = {
      statuses: Object.keys(DEFAULT_STATUS_MAP),
      priorities: Object.keys(DEFAULT_PRIORITY_MAP),
      issueTypes: [],
      requestTypes: [],
    };

    try {
      const statuses = await jsmFetch<{ name: string }[]>(c, "/rest/api/3/status");
      for (const s of statuses) {
        const k = s.name.toLowerCase();
        if (!discovered.statuses.includes(k)) discovered.statuses.push(k);
        if (!status[k]) status[k] = DEFAULT_STATUS_MAP[k] ?? "not_started";
      }
    } catch { /* optional */ }

    // Discover request types per chosen service desk
    const sdIds = scope.selectedProjectIds ?? [];
    for (const sdId of sdIds) {
      try {
        const rt = await jsmFetch<{
          values: { id: string; name: string; description?: string }[];
        }>(c, `/rest/servicedeskapi/servicedesk/${sdId}/requesttype?limit=100`);
        for (const t of rt.values ?? []) {
          // Use the request type id as the key (stable), but show the name.
          const key = t.id;
          requestTypeLabels[key] = t.name;
          if (!discovered.requestTypes.includes(key)) discovered.requestTypes.push(key);
          if (!requestType[key]) {
            const lower = t.name.toLowerCase();
            requestType[key] =
              /incident|outage|down|emergency/.test(lower) ? "incident" :
              /problem|root cause/.test(lower) ? "problem" :
              /change|deployment|release/.test(lower) ? "change" :
              /risk/.test(lower) ? "risk" :
              /task|work|how[- ]to/.test(lower) ? "task" :
              "issue";
          }
        }
      } catch { /* optional per-desk */ }
    }

    return {
      status,
      priority,
      extra: { discovered, requestType, requestTypeLabels },
    };
  },

  async run(_creds, _scope, _mapping, _ctx: MigrationContext): Promise<ImportSummary> {
    // Actual import runs server-side in the migration-runner edge function.
    return {
      createdProjects: 0,
      createdTasks: 0,
      createdIssues: 0,
      createdRisks: 0,
      skipped: 0,
      errors: [],
    };
  },
};

