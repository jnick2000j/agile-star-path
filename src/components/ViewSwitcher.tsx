import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface ViewSwitcherTab {
  key: string;
  label: string;
  to: string;
  icon?: LucideIcon;
  external?: boolean;
}

interface Props {
  tabs: ViewSwitcherTab[];
  current: string;
  className?: string;
}

/**
 * Inline horizontal tab strip used at the top of multi-view modules
 * (e.g. Helpdesk → Agent console / Self-service portal).
 * Highlights the active tab and uses Link navigation so deep-links work.
 */
export function ViewSwitcher({ tabs, current, className }: Props) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border bg-muted/40 p-1",
        className,
      )}
    >
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = t.key === current;
        const classes = cn(
          "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          active
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
        );
        if (t.external) {
          return (
            <a
              key={t.key}
              href={t.to}
              target="_blank"
              rel="noopener noreferrer"
              className={classes}
            >
              {Icon && <Icon className="h-4 w-4" />}
              {t.label}
            </a>
          );
        }
        return (
          <NavLink key={t.key} to={t.to} className={classes}>
            {Icon && <Icon className="h-4 w-4" />}
            {t.label}
          </NavLink>
        );
      })}
    </div>
  );
}
