// Shared types for the migration framework.

export type MigrationSourceId = "jira" | "csv" | "asana" | "linear" | "trello";

export type MigrationEntityType = "project" | "task" | "issue" | "risk";

export interface MigrationContext {
  organizationId: string;
  userId: string;
  jobId: string;
  onProgress?: (done: number, total: number, message: string) => void;
  onLog?: (level: "info" | "warn" | "error", message: string) => void;
}

/** Connection credentials collected by the wizard (NOT persisted as plain text). */
export interface MigrationCredentials {
  [key: string]: string | undefined;
}

/** In-memory file payloads for adapters that take uploads (e.g. CSV). */
export type MigrationFiles = Record<string, { name: string; text: string }>;

/** Scope chosen by the user (e.g. which projects/boards to import). */
export interface MigrationScope {
  selectedProjectIds?: string[];
  includeClosed?: boolean;
  includeAttachments?: boolean;
  [key: string]: unknown;
}

/** A discovered remote project/board the user can pick from. */
export interface RemoteProject {
  id: string;
  key?: string;
  name: string;
  description?: string;
  meta?: Record<string, unknown>;
}

/** Per-entity counts discovered during preview. */
export type EntityCounts = Partial<Record<MigrationEntityType, number>>;

export interface PreviewResult {
  projects: RemoteProject[];
  counts: EntityCounts;
  warnings?: string[];
}

export interface FieldMapping {
  /** Map source status -> internal status (e.g. Jira "Done" -> "completed") */
  status?: Record<string, string>;
  /** Map source priority -> internal priority */
  priority?: Record<string, string>;
  /** Map source user (email/accountId) -> internal user_id */
  user?: Record<string, string>;
  /** Free-form per-source extras */
  extra?: Record<string, unknown>;
}

export interface ImportSummary {
  createdProjects: number;
  createdTasks: number;
  createdIssues: number;
  createdRisks: number;
  skipped: number;
  errors: { entity: MigrationEntityType; externalId: string; message: string }[];
}

/**
 * A migration source adapter. Each external system (Jira, Asana, etc.)
 * implements this interface; the wizard + runner are source-agnostic.
 */
export interface MigrationSourceAdapter {
  id: MigrationSourceId;
  label: string;
  description: string;
  /** Field definitions used to build the credential form. */
  credentialFields: {
    name: string;
    label: string;
    type: "text" | "password" | "url" | "email" | "file";
    placeholder?: string;
    helpText?: string;
    required?: boolean;
    accept?: string; // for file inputs
    multiple?: boolean; // for file inputs
  }[];
  /** Validate creds + return a list of remote projects/boards. */
  testConnection(creds: MigrationCredentials, files?: MigrationFiles): Promise<RemoteProject[]>;
  /** Estimate counts for the chosen scope, plus any warnings. */
  preview(creds: MigrationCredentials, scope: MigrationScope, files?: MigrationFiles): Promise<PreviewResult>;
  /** Suggest a default field mapping (status / priority / etc.) given a sample. */
  suggestMapping(creds: MigrationCredentials, scope: MigrationScope, files?: MigrationFiles): Promise<FieldMapping>;
  /** Run the actual import, writing to the database via Supabase. */
  run(
    creds: MigrationCredentials,
    scope: MigrationScope,
    mapping: FieldMapping,
    ctx: MigrationContext,
    files?: MigrationFiles,
  ): Promise<ImportSummary>;
}
