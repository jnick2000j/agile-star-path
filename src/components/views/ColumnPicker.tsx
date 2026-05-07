import { useMemo } from "react";
import { Columns3, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ViewSchema } from "@/lib/viewSchemas/types";

interface ColumnPickerProps {
  schema: ViewSchema;
  value?: string[];
  onChange: (next: string[]) => void;
}

export function ColumnPicker({ schema, value, onChange }: ColumnPickerProps) {
  const all = schema.fields;
  const visible = useMemo(
    () => value ?? all.filter((f) => f.defaultVisible).map((f) => f.key),
    [value, all]
  );
  const toggle = (key: string) => {
    onChange(
      visible.includes(key) ? visible.filter((k) => k !== key) : [...visible, key]
    );
  };
  const move = (key: string, dir: -1 | 1) => {
    const list = [...visible];
    const i = list.indexOf(key);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    onChange(list);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-muted-foreground hover:text-foreground">
          <Columns3 className="h-3.5 w-3.5" />
          Columns
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b">
          Visible columns
        </div>
        <ScrollArea className="max-h-72">
          <div className="p-2 space-y-1">
            {visible.map((key) => {
              const f = all.find((x) => x.key === key);
              if (!f) return null;
              return (
                <div key={key} className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-muted/40">
                  <button
                    type="button"
                    onClick={() => move(key, -1)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Move up"
                  >
                    <GripVertical className="h-3.5 w-3.5" />
                  </button>
                  <Checkbox checked onCheckedChange={() => toggle(key)} className="ml-1" />
                  <span className="text-sm flex-1">{f.label}</span>
                </div>
              );
            })}
            {all
              .filter((f) => !visible.includes(f.key))
              .map((f) => (
                <div key={f.key} className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-muted/40">
                  <span className="w-3.5" />
                  <Checkbox checked={false} onCheckedChange={() => toggle(f.key)} className="ml-1" />
                  <span className="text-sm flex-1 text-muted-foreground">{f.label}</span>
                </div>
              ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
