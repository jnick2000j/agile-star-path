import { supabase } from "@/integrations/supabase/client";
import { getMigrationSource } from "./registry";
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
  // creds and files are NOT persisted — they only live in memory for the job run
  creds: MigrationCredentials;
  files?: MigrationFiles;
  mapping: FieldMapping;
}

export async function createMigrationJob(input: Omit<StartJobInput, "creds">) {
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

export async function runMigrationJob(
  jobId: string,
  input: StartJobInput,
  onProgress?: (done: number, total: number, message: string) => void,
): Promise<ImportSummary> {
  const adapter = getMigrationSource(input.source);
  if (!adapter) throw new Error(`Unknown migration source: ${input.source}`);

  await supabase
    .from("migration_jobs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", jobId);

  try {
    const summary = await adapter.run(input.creds, input.scope, input.mapping, {
      organizationId: input.organizationId,
      userId: input.userId,
      jobId,
      onProgress,
    });

    await supabase
      .from("migration_jobs")
      .update({
        status: summary.errors.length > 0 ? "completed" : "completed",
        completed_at: new Date().toISOString(),
        totals: {
          projects: summary.createdProjects,
          tasks: summary.createdTasks,
          issues: summary.createdIssues,
          risks: summary.createdRisks,
          skipped: summary.skipped,
          errors: summary.errors.length,
        } as never,
        error_summary: summary.errors.length
          ? `${summary.errors.length} item(s) failed`
          : null,
      })
      .eq("id", jobId);

    return summary;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase
      .from("migration_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_summary: message,
      })
      .eq("id", jobId);
    throw e;
  }
}

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
