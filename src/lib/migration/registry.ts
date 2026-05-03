import type { MigrationSourceAdapter, MigrationSourceId } from "./types";
import { jiraAdapter } from "./sources/jira";

const adapters: Record<string, MigrationSourceAdapter> = {
  [jiraAdapter.id]: jiraAdapter,
};

export function getMigrationSource(id: MigrationSourceId | string): MigrationSourceAdapter | undefined {
  return adapters[id];
}

export function listMigrationSources(): MigrationSourceAdapter[] {
  return Object.values(adapters);
}
