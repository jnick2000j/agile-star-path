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
