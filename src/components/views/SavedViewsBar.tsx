import { useEffect, useMemo, useRef } from "react";
import { LayoutGrid, Rows3, Calendar as CalendarIcon, Table as TableIcon } from "lucide-react";
import { SavedViewMenu } from "./SavedViewMenu";
import { FilterBuilder } from "./FilterBuilder";
import { ColumnPicker } from "./ColumnPicker";
import { SortMenu, GroupMenu } from "./SortGroupMenus";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useSavedViews, type SavedViewConfig } from "@/hooks/useSavedViews";
import type { ViewSchema, ViewFilter } from "@/lib/viewSchemas/types";
import { cn } from "@/lib/utils";

interface SavedViewsBarProps {
  scope: string;
  state: SavedViewConfig;
  onApply: (config: SavedViewConfig) => void;
  showAssignmentChips?: boolean;
  /** Optional schema enables: FilterBuilder, ColumnPicker, Sort, Group, Layout switcher. */
  schema?: ViewSchema;
  /** Override layouts (otherwise uses schema.layouts) */
  layouts?: ("table" | "kanban" | "calendar" | "list" | "board" | "gantt")[];
  className?: string;
  /** Rendered at the start of the toolbar row (e.g. search input) */
  leading?: React.ReactNode;
  /** Rendered at the end of the toolbar row (e.g. New / Create button) */
  trailing?: React.ReactNode;
}

const LAYOUT_ICONS: Record<string, React.ComponentType<any>> = {
  table: TableIcon,
  list: Rows3,
  kanban: LayoutGrid,
  board: LayoutGrid,
  calendar: CalendarIcon,
  gantt: Rows3,
};

const LAYOUT_LABELS: Record<string, string> = {
  table: "Table",
  list: "List",
  kanban: "Kanban",
  board: "Board",
  calendar: "Calendar",
  gantt: "Gantt",
};

export function SavedViewsBar({
  scope,
  state,
  onApply,
  showAssignmentChips,
  schema,
  layouts,
  className,
  leading,
  trailing,
}: SavedViewsBarProps) {
  const views = useSavedViews(scope, state);
  const lastAppliedRef = useRef<string>("");

  // Apply view config -> page state on view change / hydration
  useEffect(() => {
    const serialized = JSON.stringify(views.activeConfig ?? {});
    if (serialized !== lastAppliedRef.current) {
      lastAppliedRef.current = serialized;
      onApply(views.activeConfig ?? {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views.activeView?.id, views.loading]);

  // Mirror page state -> working config (so Save captures it)
  useEffect(() => {
    const serialized = JSON.stringify(state);
    if (serialized !== JSON.stringify(views.activeConfig)) {
      views.setActiveConfig(state);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(state)]);

  const dirty = useMemo(() => {
    if (!views.activeView) return false;
    return JSON.stringify(views.activeConfig) !== JSON.stringify(views.activeView.config);
  }, [views.activeView, views.activeConfig]);

  const filters: ViewFilter[] = Array.isArray(views.activeConfig.filters)
    ? (views.activeConfig.filters as ViewFilter[])
    : [];
  const setFilters = (next: ViewFilter[]) => {
    const cfg = { ...views.activeConfig, filters: next };
    views.setActiveConfig(cfg);
    onApply(cfg);
  };

  const setSort = (next: SavedViewConfig["sort"]) => {
    const cfg = { ...views.activeConfig, sort: next };
    views.setActiveConfig(cfg);
    onApply(cfg);
  };
  const setGrouping = (next: string | null) => {
    const cfg = { ...views.activeConfig, grouping: next };
    views.setActiveConfig(cfg);
    onApply(cfg);
  };
  const setColumns = (next: string[]) => {
    const cfg = { ...views.activeConfig, columns: next };
    views.setActiveConfig(cfg);
    onApply(cfg);
  };
  const setLayout = (next: any) => {
    const cfg = { ...views.activeConfig, layout: next };
    views.setActiveConfig(cfg);
    onApply(cfg);
  };

  const handleSaveActive = async () => {
    if (!views.activeView) return;
    await views.saveView({
      name: views.activeView.name,
      description: views.activeView.description ?? undefined,
      is_shared: views.activeView.is_shared,
      id: views.activeView.id,
    });
  };
  const handleReset = () => {
    if (!views.activeView) return;
    views.setActiveConfig(views.activeView.config);
    onApply(views.activeView.config);
  };

  const availableLayouts = layouts ?? schema?.layouts ?? [];

  const showStructured = !!schema;
  const hasActiveFilters = showStructured && filters.length > 0;

  return (
    <div
      className={cn(
        "rounded-lg border bg-card/40 backdrop-blur-sm",
        className
      )}
    >
      {/* Top row: view + controls */}
      <div className="flex items-center gap-1 flex-wrap px-2 py-1.5">
        <SavedViewMenu
          scope={scope}
          views={views}
          showAssignmentChips={showAssignmentChips}
          dirty={dirty}
          onSaveActive={handleSaveActive}
          onReset={handleReset}
        />

        {showStructured && (
          <>
            <div className="h-5 w-px bg-border mx-1" />
            <SortMenu schema={schema!} value={views.activeConfig.sort ?? null} onChange={setSort} />
            <GroupMenu schema={schema!} value={views.activeConfig.grouping ?? null} onChange={setGrouping} />
            <ColumnPicker
              schema={schema!}
              value={views.activeConfig.columns}
              onChange={setColumns}
            />
          </>
        )}

        {availableLayouts.length > 1 && (
          <div className="ml-auto">
            <ToggleGroup
              type="single"
              size="sm"
              value={(views.activeConfig.layout as string) ?? availableLayouts[0]}
              onValueChange={(v) => v && setLayout(v)}
              className="border rounded-md bg-background p-0.5"
            >
              {availableLayouts.map((l) => {
                const Icon = LAYOUT_ICONS[l] ?? TableIcon;
                return (
                  <ToggleGroupItem
                    key={l}
                    value={l}
                    className="h-6 px-2 text-xs gap-1 data-[state=on]:bg-muted"
                    title={LAYOUT_LABELS[l]}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </div>
        )}
      </div>

      {/* Filter row */}
      {showStructured && (
        <div
          className={cn(
            "flex items-center gap-1.5 flex-wrap border-t px-2 py-1.5",
            !hasActiveFilters && "border-t-0 pt-0 pb-1.5"
          )}
        >
          <FilterBuilder schema={schema!} value={filters} onChange={setFilters} />
        </div>
      )}
    </div>
  );
}
