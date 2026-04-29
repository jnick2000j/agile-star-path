export const STATUS_BADGE: Record<string, string> = {
  new: "bg-info/10 text-info hover:bg-info/10",
  open: "bg-primary/10 text-primary hover:bg-primary/10",
  pending: "bg-warning/10 text-warning hover:bg-warning/10",
  on_hold: "bg-muted text-muted-foreground hover:bg-muted",
  resolved: "bg-success/10 text-success hover:bg-success/10",
  closed: "bg-muted text-muted-foreground hover:bg-muted",
  cancelled: "bg-muted text-muted-foreground hover:bg-muted",
};

export const PRIORITY_BADGE: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-info/10 text-info",
  high: "bg-warning/10 text-warning",
  urgent: "bg-destructive/10 text-destructive",
};
