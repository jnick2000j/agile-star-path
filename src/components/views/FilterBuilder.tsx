import { useMemo, useState } from "react";
import { Plus, X, ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_OPS_BY_TYPE,
  OP_LABELS,
  type FilterOp,
  type ViewField,
  type ViewFilter,
  type ViewSchema,
} from "@/lib/viewSchemas/types";

interface FilterBuilderProps {
  schema: ViewSchema;
  value: ViewFilter[];
  onChange: (next: ViewFilter[]) => void;
}

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function defaultValueFor(field: ViewField, op: FilterOp): any {
  if (op === "is_empty" || op === "is_not_empty" || op === "is_true" || op === "is_false") return undefined;
  if (op === "in" || op === "not_in") return [];
  if (op === "between") return ["", ""];
  if (field.type === "bool") return true;
  if (field.type === "number") return 0;
  return "";
}

export function FilterBuilder({ schema, value, onChange }: FilterBuilderProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const filterableFields = useMemo(
    () => schema.fields.filter((f) => f.filterable !== false),
    [schema.fields]
  );

  const fieldByKey = useMemo(() => {
    const m = new Map<string, ViewField>();
    schema.fields.forEach((f) => m.set(f.key, f));
    return m;
  }, [schema.fields]);

  const addFilter = (key: string) => {
    const field = fieldByKey.get(key);
    if (!field) return;
    const op = (field.operators ?? DEFAULT_OPS_BY_TYPE[field.type])[0];
    onChange([...value, { id: newId(), field: key, op, value: defaultValueFor(field, op) }]);
    setPickerOpen(false);
  };

  const updateFilter = (id: string, patch: Partial<ViewFilter>) => {
    onChange(value.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const removeFilter = (id: string) => onChange(value.filter((f) => f.id !== id));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((f) => {
        const field = fieldByKey.get(f.field);
        if (!field) return null;
        return (
          <FilterChip
            key={f.id}
            field={field}
            filter={f}
            onChange={(patch) => updateFilter(f.id, patch)}
            onRemove={() => removeFilter(f.id)}
          />
        );
      })}

      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-muted-foreground hover:text-foreground">
            {value.length === 0 ? (
              <>
                <ListFilter className="h-3.5 w-3.5" />
                Add filter
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                Filter
              </>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-0">
          <Command>
            <CommandInput placeholder="Search fields…" />
            <CommandList>
              <CommandEmpty>No fields.</CommandEmpty>
              <CommandGroup>
                {filterableFields.map((f) => (
                  <CommandItem key={f.key} value={f.label} onSelect={() => addFilter(f.key)}>
                    {f.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function FilterChip({
  field,
  filter,
  onChange,
  onRemove,
}: {
  field: ViewField;
  filter: ViewFilter;
  onChange: (patch: Partial<ViewFilter>) => void;
  onRemove: () => void;
}) {
  const ops = field.operators ?? DEFAULT_OPS_BY_TYPE[field.type];
  const [open, setOpen] = useState(false);

  const summary = summarizeValue(field, filter);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 h-7 pl-2 pr-1 rounded-md border bg-background hover:bg-muted/50 text-xs"
        >
          <span className="font-medium">{field.label}</span>
          <span className="text-muted-foreground">{OP_LABELS[filter.op]}</span>
          {summary && <span className="max-w-[160px] truncate">{summary}</span>}
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="inline-flex items-center justify-center h-4 w-4 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive ml-0.5"
          >
            <X className="h-3 w-3" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3 space-y-2">
        <div className="text-xs font-medium text-muted-foreground">{field.label}</div>
        <Select
          value={filter.op}
          onValueChange={(op) => {
            const nextOp = op as FilterOp;
            onChange({ op: nextOp, value: defaultValueFor(field, nextOp) });
          }}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ops.map((op) => (
              <SelectItem key={op} value={op}>
                {OP_LABELS[op]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ValueEditor field={field} filter={filter} onChange={onChange} />
      </PopoverContent>
    </Popover>
  );
}

function summarizeValue(field: ViewField, filter: ViewFilter): string {
  const v = filter.value;
  if (v === undefined || v === null || v === "") return "";
  if (Array.isArray(v)) {
    if (filter.op === "between") {
      return v.filter(Boolean).join(" – ");
    }
    if (field.options) {
      const labels = v
        .map((x) => field.options!.find((o) => o.value === x)?.label ?? String(x))
        .filter(Boolean);
      return labels.length > 2 ? `${labels.slice(0, 2).join(", ")} +${labels.length - 2}` : labels.join(", ");
    }
    return v.join(", ");
  }
  if (field.options) {
    return field.options.find((o) => o.value === v)?.label ?? String(v);
  }
  return String(v);
}

function ValueEditor({
  field,
  filter,
  onChange,
}: {
  field: ViewField;
  filter: ViewFilter;
  onChange: (patch: Partial<ViewFilter>) => void;
}) {
  const op = filter.op;
  if (op === "is_empty" || op === "is_not_empty" || op === "is_true" || op === "is_false") {
    return <div className="text-xs text-muted-foreground">No value needed.</div>;
  }

  if (field.type === "enum" && (op === "is" || op === "is_not")) {
    return (
      <Select value={filter.value ?? ""} onValueChange={(v) => onChange({ value: v })}>
        <SelectTrigger className="h-8">
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          {field.options?.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if ((field.type === "enum" || field.type === "multiEnum") && (op === "in" || op === "not_in")) {
    const arr: string[] = Array.isArray(filter.value) ? filter.value : [];
    const toggle = (val: string) => {
      onChange({
        value: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val],
      });
    };
    return (
      <div className="max-h-56 overflow-auto space-y-1.5 rounded border p-2">
        {field.options?.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={arr.includes(o.value)} onCheckedChange={() => toggle(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    );
  }

  if (field.type === "user") {
    return (
      <Select value={filter.value ?? "@me"} onValueChange={(v) => onChange({ value: v })}>
        <SelectTrigger className="h-8">
          <SelectValue placeholder="Select user…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="@me">Current user (me)</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "date") {
    if (op === "between") {
      const arr: string[] = Array.isArray(filter.value) ? filter.value : ["", ""];
      return (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={arr[0] ?? ""}
            onChange={(e) => onChange({ value: [e.target.value, arr[1] ?? ""] })}
            className="h-8"
          />
          <Input
            type="date"
            value={arr[1] ?? ""}
            onChange={(e) => onChange({ value: [arr[0] ?? "", e.target.value] })}
            className="h-8"
          />
        </div>
      );
    }
    return (
      <Input
        type="date"
        value={filter.value ?? ""}
        onChange={(e) => onChange({ value: e.target.value })}
        className="h-8"
      />
    );
  }

  if (field.type === "number") {
    return (
      <Input
        type="number"
        value={filter.value ?? 0}
        onChange={(e) => onChange({ value: Number(e.target.value) })}
        className="h-8"
      />
    );
  }

  return (
    <Input
      value={filter.value ?? ""}
      onChange={(e) => onChange({ value: e.target.value })}
      placeholder="Value…"
      className="h-8"
    />
  );
}
