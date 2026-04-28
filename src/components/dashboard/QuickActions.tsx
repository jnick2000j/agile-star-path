import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ListTodo,
  FolderKanban,
  MessageSquare,
  AlertTriangle,
  LifeBuoy,
  Layers,
  Package,
  GitBranch,
  Wand2,
  Settings2,
  Plus,
  Clock,
} from "lucide-react";
import { useDashboardPrefs } from "@/hooks/useDashboardPrefs";
import { useVertical } from "@/hooks/useVertical";

interface QuickAction {
  key: string;
  label: string;
  icon: React.ElementType;
  href: string;
  description: string;
  module?: string;
}

const ALL_ACTIONS: QuickAction[] = [
  { key: "new-task", label: "New Task", icon: ListTodo, href: "/tasks?new=1", description: "Create a task and assign it." },
  { key: "log-time", label: "Log Time", icon: Clock, href: "/timesheets?new=1", description: "Add or modify a timesheet entry." },
  { key: "new-project", label: "New Project", icon: FolderKanban, href: "/projects?new=1", description: "Start a new project." },
  { key: "new-programme", label: "New Programme", icon: Layers, href: "/programmes?new=1", description: "Start a new programme.", module: "programmes" },
  { key: "new-product", label: "New Product", icon: Package, href: "/products?new=1", description: "Add a product.", module: "products" },
  { key: "log-update", label: "Log Update", icon: MessageSquare, href: "/updates?new=1", description: "Post a status update." },
  { key: "raise-risk", label: "Raise Risk", icon: AlertTriangle, href: "/registers?type=risk&new=1", description: "Log a new risk." },
  { key: "open-ticket", label: "Open Ticket", icon: LifeBuoy, href: "/support?new=1", description: "Raise a helpdesk ticket.", module: "helpdesk" },
  { key: "raise-change", label: "Raise Change", icon: GitBranch, href: "/change-management?new=1", description: "Submit a change request.", module: "change_management" },
  { key: "ai-wizard", label: "AI Wizard", icon: Wand2, href: "/wizards", description: "Draft anything with AI." },
];

export function QuickActions() {
  const { prefs, update } = useDashboardPrefs();
  const { hasModule } = useVertical();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(prefs.quick_actions);

  const visible = ALL_ACTIONS
    .filter((a) => !a.module || hasModule(a.module))
    .filter((a) => prefs.quick_actions.includes(a.key));

  const customizable = ALL_ACTIONS.filter((a) => !a.module || hasModule(a.module));

  const toggle = (key: string) => {
    setDraft((d) => (d.includes(key) ? d.filter((k) => k !== key) : [...d, key]));
  };

  const save = async () => {
    await update({ quick_actions: draft });
    setOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (o) setDraft(prefs.quick_actions);
          }}
        >
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8">
              <Settings2 className="h-3.5 w-3.5 mr-1.5" /> Customize
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Customize Quick Actions</DialogTitle>
              <DialogDescription>
                Pick the create-actions you want pinned to your dashboard.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto py-2">
              {customizable.map((a) => (
                <label
                  key={a.key}
                  className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={draft.includes(a.key)}
                    onCheckedChange={() => toggle(a.key)}
                    className="mt-0.5"
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <a.icon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">{a.label}</div>
                      <div className="text-xs text-muted-foreground">{a.description}</div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            No quick actions pinned. Click <span className="font-medium">Customize</span> to add some.
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {visible.map((a) => (
              <Button
                key={a.key}
                asChild
                variant="outline"
                title={a.description}
                className="h-20 w-20 shrink-0 p-1.5 flex-col gap-1 hover:border-primary hover:text-primary"
              >
                <Link to={a.href}>
                  <a.icon className="h-5 w-5" />
                  <span className="text-[11px] font-medium leading-tight text-center">{a.label}</span>
                </Link>
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
