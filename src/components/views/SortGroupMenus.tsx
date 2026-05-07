import { ArrowUpDown, ArrowUp, ArrowDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ViewSchema } from "@/lib/viewSchemas/types";

interface SortMenuProps {
  schema: ViewSchema;
  value?: { field: string; dir: "asc" | "desc" } | null;
  onChange: (next: { field: string; dir: "asc" | "desc" } | null) => void;
}

export function SortMenu({ schema, value, onChange }: SortMenuProps) {
  const sortable = schema.fields.filter((f) => f.sortable !== false);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-muted-foreground hover:text-foreground">
          <ArrowUpDown className="h-3.5 w-3.5" />
          Sort
          {value && (
            <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground">
              {schema.fields.find((f) => f.key === value.field)?.label ?? value.field}
              {value.dir === "asc" ? " ↑" : " ↓"}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3 space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Sort by</div>
        <Select
          value={value?.field ?? ""}
          onValueChange={(f) => onChange({ field: f, dir: value?.dir ?? "asc" })}
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder="Field…" />
          </SelectTrigger>
          <SelectContent>
            {sortable.map((f) => (
              <SelectItem key={f.key} value={f.key}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {value && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={value.dir === "asc" ? "secondary" : "outline"}
              className="flex-1 h-8 gap-1"
              onClick={() => onChange({ field: value.field, dir: "asc" })}
            >
              <ArrowUp className="h-3.5 w-3.5" /> Asc
            </Button>
            <Button
              size="sm"
              variant={value.dir === "desc" ? "secondary" : "outline"}
              className="flex-1 h-8 gap-1"
              onClick={() => onChange({ field: value.field, dir: "desc" })}
            >
              <ArrowDown className="h-3.5 w-3.5" /> Desc
            </Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => onChange(null)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface GroupMenuProps {
  schema: ViewSchema;
  value?: string | null;
  onChange: (next: string | null) => void;
}

export function GroupMenu({ schema, value, onChange }: GroupMenuProps) {
  const groupable = schema.fields.filter((f) => f.groupable);
  if (groupable.length === 0) return null;
  return (
    <Select
      value={value ?? "__none__"}
      onValueChange={(v) => onChange(v === "__none__" ? null : v)}
    >
      <SelectTrigger className="h-7 w-auto gap-1 border-0 bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40 px-2 text-xs font-medium shadow-none focus:ring-0">
        <SelectValue placeholder="Group" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">No grouping</SelectItem>
        {groupable.map((f) => (
          <SelectItem key={f.key} value={f.key}>
            Group by {f.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
