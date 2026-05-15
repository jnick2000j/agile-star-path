export const OBJECTIVE_STATUSES = [
  { value: "not_started", label: "Not started", className: "bg-muted text-muted-foreground" },
  { value: "on_track", label: "On track", className: "bg-success/10 text-success" },
  { value: "at_risk", label: "At risk", className: "bg-warning/10 text-warning" },
  { value: "off_track", label: "Off track", className: "bg-destructive/10 text-destructive" },
  { value: "achieved", label: "Achieved", className: "bg-success/20 text-success" },
  { value: "missed", label: "Missed", className: "bg-destructive/20 text-destructive" },
  { value: "cancelled", label: "Cancelled", className: "bg-muted text-muted-foreground" },
] as const;

export const SCOPES = [
  { value: "org", label: "Organization" },
  { value: "programme", label: "Programme" },
  { value: "project", label: "Project" },
  { value: "team", label: "Team" },
  { value: "individual", label: "Individual" },
] as const;

export const METRIC_TYPES = [
  { value: "number", label: "Number" },
  { value: "percent", label: "Percent" },
  { value: "currency", label: "USD ($)" },
  { value: "boolean", label: "Yes / No" },
  { value: "milestone", label: "Milestone" },
] as const;

export const PERIOD_TYPES = [
  { value: "quarterly", label: "Quarterly" },
  { value: "annual", label: "Annual" },
  { value: "custom", label: "Custom" },
] as const;

export function statusMeta(s: string) {
  return OBJECTIVE_STATUSES.find((x) => x.value === s) ?? OBJECTIVE_STATUSES[1];
}

export function confidenceMeta(c: number) {
  if (c >= 0.7) return { label: "High", className: "bg-success/10 text-success" };
  if (c >= 0.4) return { label: "Medium", className: "bg-warning/10 text-warning" };
  return { label: "Low", className: "bg-destructive/10 text-destructive" };
}

export function gradeBand(grade: number | null | undefined) {
  if (grade == null) return { label: "Ungraded", className: "bg-muted text-muted-foreground" };
  if (grade >= 0.7) return { label: "Achieved", className: "bg-success/10 text-success" };
  if (grade >= 0.4) return { label: "Partial", className: "bg-warning/10 text-warning" };
  return { label: "Missed", className: "bg-destructive/10 text-destructive" };
}

export function formatKrValue(value: number, metricType: string, unit?: string | null) {
  if (metricType === "currency") return `$${Number(value).toLocaleString()}`;
  if (metricType === "percent") return `${Number(value).toFixed(1)}%`;
  if (metricType === "boolean") return value >= 1 ? "Yes" : "No";
  return unit ? `${Number(value).toLocaleString()} ${unit}` : Number(value).toLocaleString();
}
