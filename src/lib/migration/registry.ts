import type { MigrationSourceAdapter, MigrationSourceId } from "./types";
import { jiraAdapter } from "./sources/jira";
import { jiraServiceManagementAdapter } from "./sources/jiraServiceManagement";
import { csvAdapter } from "./sources/csv";

const adapters: Record<string, MigrationSourceAdapter> = {
  [csvAdapter.id]: csvAdapter,
  [jiraAdapter.id]: jiraAdapter,
  [jiraServiceManagementAdapter.id]: jiraServiceManagementAdapter,
};

export function getMigrationSource(id: MigrationSourceId | string): MigrationSourceAdapter | undefined {
  return adapters[id];
}

export function listMigrationSources(): MigrationSourceAdapter[] {
  return Object.values(adapters);
}
