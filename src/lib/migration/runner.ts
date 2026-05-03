import { supabase } from "@/integrations/supabase/client";
import type {
  FieldMapping,
  ImportSummary,
  MigrationCredentials,
  MigrationFiles,
  MigrationScope,
  MigrationSourceId,
} from "./types";

export interface StartJobInput {
  organizationId: string;
  userId: string;
  source: MigrationSourceId | string;
  sourceLabel?: string;
  scope: MigrationScope;
  // creds and files are NOT persisted — they only travel with the invoke call
  creds: MigrationCredentials;
  files?: MigrationFiles;
  mapping: FieldMapping;
}

export async function createMigrationJob(input: Omit<StartJobInput, "creds" | "files">) {
  const { data, error } = await supabase
    .from("migration_jobs")
    .insert({
      organization_id: input.organizationId,
      created_by: input.userId,
      source: input.source,
      source_label: input.sourceLabel ?? null,
      status: "draft",
      config: { scope: input.scope } as never,
      field_map: input.mapping as never,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

interface JobProgressRow {
  id: string;
  status: string;
  progress: { done?: number; total?: number; message?: string; summary?: ImportSummary } | null;
  totals: Record<string, number> | null;
  error_summary: string | null;
}

/**
 * Kick the migration off in the background (edge function) and poll the job
 * row until it reaches a terminal status. Returns the final ImportSummary.
 */
export async function runMigrationJob(
  jobId: string,
  input: StartJobInput,
  onProgress?: (done: number, total: number, message: string) => void,
): Promise<ImportSummary> {
  // 1. Trigger background run
  const { error: invokeErr } = await supabase.functions.invoke("migration-runner", {
    body: {
      jobId,
      source: input.source,
      scope: input.scope,
      mapping: input.mapping,
      creds: input.creds,
      files: input.files,
    },
  });
  if (invokeErr) throw new Error(invokeErr.message);

  // 2. Poll for progress until terminal
  return await new Promise<ImportSummary>((resolve, reject) => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      const { data, error } = await supabase
        .from("migration_jobs")
        .select("id,status,progress,totals,error_summary")
        .eq("id", jobId)
        .maybeSingle<JobProgressRow>();
      if (error) {
        cancelled = true;
        reject(new Error(error.message));
        return;
      }
      if (!data) {
        setTimeout(tick, 1500);
        return;
      }
      const p = data.progress ?? {};
      onProgress?.(p.done ?? 0, p.total ?? 0, p.message ?? "");

      if (data.status === "completed" || data.status === "failed") {
        cancelled = true;
        if (data.status === "failed") {
          reject(new Error(data.error_summary ?? "Migration failed"));
          return;
        }
        const summary: ImportSummary = p.summary ?? {
          createdProjects: data.totals?.projects ?? 0,
          createdTasks: data.totals?.tasks ?? 0,
          createdIssues: data.totals?.issues ?? 0,
          createdRisks: data.totals?.risks ?? 0,
          skipped: data.totals?.skipped ?? 0,
          errors: [],
        };
        resolve(summary);
        return;
      }
      setTimeout(tick, 1500);
    };
    // small initial delay to give the function time to flip status to running
    setTimeout(tick, 600);
  });
}

export async function listMigrationJobs(organizationId: string) {
  const { data, error } = await supabase
    .from("migration_jobs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

/**
 * Optional client-side helper kept for backward compatibility with adapter
 * `run` methods. Background execution happens in the migration-runner edge
 * function — this stub lets adapter source files still compile and may be
 * called for client-side dry runs.
 */
export async function recordMigrationItem(
  jobId: string,
  organizationId: string,
  entry: {
    entity_type: string;
    external_id: string;
    external_key?: string;
    internal_id?: string;
    status: "pending" | "created" | "skipped" | "failed";
    error?: string;
    payload?: unknown;
  },
) {
  await supabase.from("migration_items").upsert(
    {
      job_id: jobId,
      organization_id: organizationId,
      entity_type: entry.entity_type,
      external_id: entry.external_id,
      external_key: entry.external_key ?? null,
      internal_id: entry.internal_id ?? null,
      status: entry.status,
      error: entry.error ?? null,
      payload: (entry.payload ?? null) as never,
    },
    { onConflict: "job_id,entity_type,external_id" },
  );
}

/**
 * Lightweight live-progress watcher for the Migrations page. Returns an
 * unsubscribe function. Polls every `intervalMs` until the job is terminal.
 */
export function watchMigrationJob(
  jobId: string,
  onUpdate: (row: JobProgressRow) => void,
  intervalMs = 2000,
): () => void {
  let cancelled = false;
  const tick = async () => {
    if (cancelled) return;
    const { data } = await supabase
      .from("migration_jobs")
      .select("id,status,progress,totals,error_summary")
      .eq("id", jobId)
      .maybeSingle<JobProgressRow>();
    if (data) {
      onUpdate(data);
      if (data.status === "completed" || data.status === "failed") return;
    }
    setTimeout(tick, intervalMs);
  };
  tick();
  return () => {
    cancelled = true;
  };
}

// ---------- Error report ----------

export interface MigrationErrorRow {
  entity_type: string;
  external_id: string;
  external_key: string | null;
  status: string;
  error: string | null;
  created_at: string;
}

export async function fetchMigrationErrorRows(jobId: string): Promise<MigrationErrorRow[]> {
  const { data, error } = await supabase
    .from("migration_items")
    .select("entity_type,external_id,external_key,status,error,created_at")
    .eq("job_id", jobId)
    .in("status", ["skipped", "failed"])
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MigrationErrorRow[];
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function rowsToCsv(rows: MigrationErrorRow[]): string {
  const headers = ["entity_type", "external_id", "external_key", "status", "reason", "recorded_at"];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [r.entity_type, r.external_id, r.external_key ?? "", r.status, r.error ?? "", r.created_at]
        .map(csvEscape)
        .join(","),
    );
  }
  return lines.join("\n");
}

export function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export async function downloadMigrationErrorReport(
  jobId: string,
  fmt: "csv" | "json",
): Promise<number> {
  const rows = await fetchMigrationErrorRows(jobId);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  if (fmt === "csv") {
    downloadBlob(`migration-${jobId.slice(0, 8)}-errors-${stamp}.csv`, rowsToCsv(rows), "text/csv");
  } else {
    downloadBlob(
      `migration-${jobId.slice(0, 8)}-errors-${stamp}.json`,
      JSON.stringify({ jobId, generatedAt: new Date().toISOString(), count: rows.length, rows }, null, 2),
      "application/json",
    );
  }
  return rows.length;
}
