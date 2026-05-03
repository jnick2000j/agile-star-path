import { supabase } from "@/integrations/supabase/client";
import { recordMigrationItem } from "../runner";
import type {
  FieldMapping,
  ImportSummary,
  MigrationContext,
  MigrationCredentials,
  MigrationFiles,
  MigrationScope,
  MigrationSourceAdapter,
  PreviewResult,
  RemoteProject,
} from "../types";

/**
 * Generic CSV adapter.
 *
 * Accepts up to four CSV files (projects, tasks, issues, risks). Each file is
 * optional — only provided files are imported. Header rows are required.
 *
 * Recognised columns (case-insensitive, all optional unless noted):
 *   projects.csv: external_id, name*, description, stage, priority, methodology, health, start_date, end_date
 *   tasks.csv:    external_id, project_external_id, name*, description, status, priority, planned_start, planned_end, assigned_to_email
 *   issues.csv:   external_id, project_external_id, title*, description, type, status, priority
 *   risks.csv:    external_id, project_external_id, title*, description, probability, impact, status
 */

const FILE_KEYS = ["projects", "tasks", "issues", "risks"] as const;
type FileKey = (typeof FILE_KEYS)[number];

const DEFAULT_STATUS_MAP: Record<string, string> = {
  "to do": "not_started",
  todo: "not_started",
  open: "not_started",
  backlog: "not_started",
  "not started": "not_started",
  "in progress": "in_progress",
  doing: "in_progress",
  blocked: "blocked",
  done: "completed",
  closed: "completed",
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

function mapStatus(v: string | undefined, m: FieldMapping): string {
  if (!v) return "not_started";
  const k = v.toLowerCase().trim();
  return m.status?.[k] ?? DEFAULT_STATUS_MAP[k] ?? "not_started";
}
function mapPriority(v: string | undefined, m: FieldMapping): string {
  if (!v) return "medium";
  const k = v.toLowerCase().trim();
  return m.priority?.[k] ?? DEFAULT_PRIORITY_MAP[k] ?? "medium";
}

// ---------- CSV parsing (RFC4180-ish) ----------

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
        } else {
          inQuotes = false;
        }
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

function getFile(files: MigrationFiles | undefined, key: FileKey): Record<string, string>[] {
  const f = files?.[key];
  if (!f?.text) return [];
  return parseCsv(f.text);
}

// ---------- adapter ----------

export const csvAdapter: MigrationSourceAdapter = {
  id: "csv",
  label: "CSV / Excel export",
  description:
    "Upload CSV files exported from any tool. Provide projects, tasks, issues and/or risks separately.",
  credentialFields: [
    {
      name: "projects",
      label: "Projects CSV (optional)",
      type: "file",
      accept: ".csv,text/csv",
      helpText: "Columns: external_id, name, description, stage, priority, methodology, health, start_date, end_date",
    },
    {
      name: "tasks",
      label: "Tasks CSV (optional)",
      type: "file",
      accept: ".csv,text/csv",
      helpText: "Columns: external_id, project_external_id, name, description, status, priority, planned_start, planned_end",
    },
    {
      name: "issues",
      label: "Issues CSV (optional)",
      type: "file",
      accept: ".csv,text/csv",
      helpText: "Columns: external_id, project_external_id, title, description, type, status, priority",
    },
    {
      name: "risks",
      label: "Risks CSV (optional)",
      type: "file",
      accept: ".csv,text/csv",
      helpText: "Columns: external_id, project_external_id, title, description, probability, impact, status",
    },
  ],

  async testConnection(_creds, files): Promise<RemoteProject[]> {
    const provided = FILE_KEYS.filter((k) => files?.[k]?.text);
    if (provided.length === 0) {
      throw new Error("Upload at least one CSV file to continue.");
    }
    const projectRows = getFile(files, "projects");
    if (projectRows.length > 0) {
      return projectRows.map((r, i) => ({
        id: r.external_id || r.id || `row-${i}`,
        key: r.external_id || r.id || undefined,
        name: r.name || r.title || `Project ${i + 1}`,
        description: r.description,
      }));
    }
    // No projects file — synthesize a single bucket so the user can scope the import.
    return [
      {
        id: "__csv_default__",
        name: `Imported CSV bucket (${provided.join(", ")})`,
        description: "All rows will be attached to a single new project.",
      },
    ];
  },

  async preview(_creds, scope, files): Promise<PreviewResult> {
    const counts: PreviewResult["counts"] = {
      project: 0,
      task: 0,
      issue: 0,
      risk: 0,
    };
    const warnings: string[] = [];
    const projects = getFile(files, "projects");
    const tasks = getFile(files, "tasks");
    const issues = getFile(files, "issues");
    const risks = getFile(files, "risks");

    const selected = new Set(scope.selectedProjectIds ?? []);
    const isDefault = selected.has("__csv_default__");

    counts.project = isDefault ? 1 : projects.filter((r) => selected.has(r.external_id || r.id)).length;

    const inScope = (r: Record<string, string>) =>
      isDefault || !r.project_external_id || selected.has(r.project_external_id);

    counts.task = tasks.filter(inScope).length;
    counts.issue = issues.filter(inScope).length;
    counts.risk = risks.filter(inScope).length;

    if (!isDefault && tasks.length > 0 && projects.length === 0) {
      warnings.push("Tasks reference projects but no projects.csv was provided — they will all attach to a default project.");
    }
    for (const t of tasks) {
      if (!t.name && !t.title) warnings.push(`A task row has no name (external_id=${t.external_id || "?"})`);
    }

    return { projects: [], counts, warnings: warnings.slice(0, 20) };
  },

  async suggestMapping(): Promise<FieldMapping> {
    return { status: { ...DEFAULT_STATUS_MAP }, priority: { ...DEFAULT_PRIORITY_MAP } };
  },

  async run(_creds, scope, mapping, ctx: MigrationContext, files): Promise<ImportSummary> {
    const summary: ImportSummary = {
      createdProjects: 0,
      createdTasks: 0,
      createdIssues: 0,
      createdRisks: 0,
      skipped: 0,
      errors: [],
    };

    const projectRows = getFile(files, "projects");
    const taskRows = getFile(files, "tasks");
    const issueRows = getFile(files, "issues");
    const riskRows = getFile(files, "risks");

    const selected = new Set(scope.selectedProjectIds ?? []);
    const isDefault = selected.has("__csv_default__");

    const total = (isDefault ? 1 : selected.size) + taskRows.length + issueRows.length + riskRows.length;
    let done = 0;
    const tick = (msg: string) => {
      done += 1;
      ctx.onProgress?.(done, total, msg);
    };

    // 1. Projects
    const projectIdMap = new Map<string, string>(); // external_id -> internal id
    let defaultProjectId: string | null = null;

    const insertProject = async (row: Partial<Record<string, string>>, fallbackName: string) => {
      const { data, error } = await supabase
        .from("projects")
        .insert({
          organization_id: ctx.organizationId,
          name: row.name || row.title || fallbackName,
          description: row.description ?? null,
          stage: (row.stage as never) ?? "initiating",
          priority: mapPriority(row.priority, mapping),
          health: (row.health as never) ?? "green",
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
        defaultProjectId = await insertProject({}, `CSV import ${new Date().toLocaleDateString()}`);
        summary.createdProjects += 1;
        await recordMigrationItem(ctx.jobId, ctx.organizationId, {
          entity_type: "project",
          external_id: "__csv_default__",
          internal_id: defaultProjectId,
          status: "created",
        });
        tick("Default project");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        summary.errors.push({ entity: "project", externalId: "__csv_default__", message: msg });
      }
    } else {
      for (const row of projectRows) {
        const ext = row.external_id || row.id;
        if (!ext || !selected.has(ext)) continue;
        try {
          const id = await insertProject(row, ext);
          projectIdMap.set(ext, id);
          summary.createdProjects += 1;
          await recordMigrationItem(ctx.jobId, ctx.organizationId, {
            entity_type: "project",
            external_id: ext,
            internal_id: id,
            status: "created",
          });
          tick(`Project: ${row.name || ext}`);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          summary.errors.push({ entity: "project", externalId: ext, message: msg });
          await recordMigrationItem(ctx.jobId, ctx.organizationId, {
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

    // 2. Tasks
    for (const row of taskRows) {
      const projId = resolveProject(row);
      const ext = row.external_id || row.id || row.name || `task-${done}`;
      if (!projId) {
        summary.skipped += 1;
        await recordMigrationItem(ctx.jobId, ctx.organizationId, {
          entity_type: "task",
          external_id: ext,
          status: "skipped",
          error: "No matching project",
        });
        tick(`Skipped task: ${ext}`);
        continue;
      }
      try {
        const { data, error } = await supabase
          .from("tasks")
          .insert({
            organization_id: ctx.organizationId,
            project_id: projId,
            name: row.name || row.title || ext,
            description: row.description || null,
            status: mapStatus(row.status, mapping) as never,
            priority: mapPriority(row.priority, mapping),
            planned_start: row.planned_start || null,
            planned_end: row.planned_end || row.due_date || null,
            created_by: ctx.userId,
          })
          .select("id")
          .single();
        if (error) throw error;
        summary.createdTasks += 1;
        await recordMigrationItem(ctx.jobId, ctx.organizationId, {
          entity_type: "task",
          external_id: ext,
          internal_id: data.id,
          status: "created",
        });
        tick(`Task: ${row.name || ext}`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        summary.errors.push({ entity: "task", externalId: ext, message: msg });
        await recordMigrationItem(ctx.jobId, ctx.organizationId, {
          entity_type: "task",
          external_id: ext,
          status: "failed",
          error: msg,
        });
      }
    }

    // 3. Issues
    for (const row of issueRows) {
      const projId = resolveProject(row);
      const ext = row.external_id || row.id || row.title || `issue-${done}`;
      if (!projId) {
        summary.skipped += 1;
        tick(`Skipped issue: ${ext}`);
        continue;
      }
      try {
        const status = mapStatus(row.status, mapping);
        const { data, error } = await supabase
          .from("issues")
          .insert({
            organization_id: ctx.organizationId,
            project_id: projId,
            title: row.title || row.name || ext,
            description: row.description || null,
            type: (row.type as never) || "problem",
            priority: mapPriority(row.priority, mapping),
            status: status === "completed" ? "closed" : "open",
            created_by: ctx.userId,
          })
          .select("id")
          .single();
        if (error) throw error;
        summary.createdIssues += 1;
        await recordMigrationItem(ctx.jobId, ctx.organizationId, {
          entity_type: "issue",
          external_id: ext,
          internal_id: data.id,
          status: "created",
        });
        tick(`Issue: ${row.title || ext}`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        summary.errors.push({ entity: "issue", externalId: ext, message: msg });
        await recordMigrationItem(ctx.jobId, ctx.organizationId, {
          entity_type: "issue",
          external_id: ext,
          status: "failed",
          error: msg,
        });
      }
    }

    // 4. Risks
    for (const row of riskRows) {
      const projId = resolveProject(row);
      const ext = row.external_id || row.id || row.title || `risk-${done}`;
      if (!projId) {
        summary.skipped += 1;
        tick(`Skipped risk: ${ext}`);
        continue;
      }
      try {
        const { data, error } = await supabase
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
        await recordMigrationItem(ctx.jobId, ctx.organizationId, {
          entity_type: "risk",
          external_id: ext,
          internal_id: data.id,
          status: "created",
        });
        tick(`Risk: ${row.title || ext}`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        summary.errors.push({ entity: "risk", externalId: ext, message: msg });
        await recordMigrationItem(ctx.jobId, ctx.organizationId, {
          entity_type: "risk",
          external_id: ext,
          status: "failed",
          error: msg,
        });
      }
    }

    return summary;
  },
};
