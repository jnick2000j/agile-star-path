import { LucideIcon } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface QuickActionTabItem {
  value: string;
  label: string;
  icon: LucideIcon;
  count?: number;
}

interface QuickActionTabsProps {
  items: QuickActionTabItem[];
  className?: string;
}

/**
 * Renders tab triggers as a "Quick Actions" style grid of icon+label cards.
 * Drop-in replacement for <TabsList> inside a <Tabs> block.
 */
export function QuickActionTabs({ items, className }: QuickActionTabsProps) {
  return (
    <TabsList
      className={cn(
        "grid h-auto w-full bg-transparent p-0 gap-3",
        "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6",
        className
      )}
    >
      {items.map(({ value, label, icon: Icon, count }) => (
        <TabsTrigger
          key={value}
          value={value}
          className={cn(
            "flex flex-col items-center justify-center gap-2 h-auto py-4 px-2",
            "rounded-lg border border-border bg-card text-card-foreground shadow-sm",
            "transition-all hover:border-primary/40 hover:bg-accent hover:text-accent-foreground",
            "data-[state=active]:border-primary data-[state=active]:bg-primary/10",
            "data-[state=active]:text-primary data-[state=active]:shadow-md"
          )}
        >
          <Icon className="h-5 w-5" />
          <span className="text-xs font-medium text-center leading-tight">
            {label}
            {typeof count === "number" && (
              <span className="ml-1 text-muted-foreground">({count})</span>
            )}
          </span>
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
