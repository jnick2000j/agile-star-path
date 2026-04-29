import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Server, Printer, Laptop, Smartphone, Monitor, HardDrive, Database, Cloud,
  Wifi, Globe, Lock, Key, Shield, ShieldCheck, Mail, MessageSquare, Phone,
  Headphones, Camera, Mic, Video, Music, Image, FileText, Folder, Package,
  Box, Truck, Building, Briefcase, Users, User, UserPlus, GraduationCap,
  Settings, Wrench, Cog, Hammer, Plug, Power, Cable, Keyboard, Mouse,
  CreditCard, DollarSign, Receipt, ShoppingCart, Tag, Gift, Heart, Star,
  Bell, Calendar, Clock, MapPin, Car, Plane, Coffee, Lightbulb, Zap,
  Cpu, MemoryStick, Network, Router, Cast, Rss, Bug, Code, Terminal,
  GitBranch, BookOpen, Library, ClipboardList, CheckSquare, AlertCircle,
  HelpCircle, Info, LucideIcon,
} from "lucide-react";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Server, Printer, Laptop, Smartphone, Monitor, HardDrive, Database, Cloud,
  Wifi, Globe, Lock, Key, Shield, ShieldCheck, Mail, MessageSquare, Phone,
  Headphones, Camera, Mic, Video, Music, Image, FileText, Folder, Package,
  Box, Truck, Building, Briefcase, Users, User, UserPlus, GraduationCap,
  Settings, Wrench, Cog, Hammer, Plug, Power, Cable, Keyboard, Mouse,
  CreditCard, DollarSign, Receipt, ShoppingCart, Tag, Gift, Heart, Star,
  Bell, Calendar, Clock, MapPin, Car, Plane, Coffee, Lightbulb, Zap,
  Cpu, MemoryStick, Network, Router, Cast, Rss, Bug, Code, Terminal,
  GitBranch, BookOpen, Library, ClipboardList, CheckSquare, AlertCircle,
  HelpCircle, Info,
};

interface CategoryIconProps {
  name?: string | null;
  className?: string;
  size?: number;
  color?: string;
}

/** Renders a lucide icon by stored name. Falls back to Package. */
export function CategoryIcon({ name, className, size, color }: CategoryIconProps) {
  const Icon = (name && CATEGORY_ICONS[name]) || Package;
  return <Icon className={className} size={size} color={color} />;
}

interface PickerProps {
  value?: string | null;
  onChange: (icon: string) => void;
  color?: string;
}

export function CategoryIconPicker({ value, onChange, color }: PickerProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const entries = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return Object.entries(CATEGORY_ICONS).filter(([n]) =>
      f ? n.toLowerCase().includes(f) : true,
    );
  }, [filter]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="gap-2 h-9">
          <CategoryIcon name={value} size={16} color={color} />
          <span className="text-xs text-muted-foreground">
            {value || "Pick icon"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2">
        <Input
          autoFocus
          placeholder="Search icons…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-8 mb-2"
        />
        <div className="grid grid-cols-8 gap-1 max-h-64 overflow-y-auto">
          {entries.map(([n, Icon]) => {
            const active = value === n;
            return (
              <button
                key={n}
                type="button"
                title={n}
                onClick={() => {
                  onChange(n);
                  setOpen(false);
                }}
                className={
                  "h-8 w-8 inline-flex items-center justify-center rounded-md border transition-colors " +
                  (active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-transparent hover:bg-accent hover:text-accent-foreground")
                }
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
          {entries.length === 0 && (
            <p className="col-span-8 text-xs text-muted-foreground py-3 text-center">
              No icons match "{filter}".
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
