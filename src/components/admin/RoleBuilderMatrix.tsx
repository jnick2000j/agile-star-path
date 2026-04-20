import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Save, Copy, Shield, Sparkles, Globe, MapPin, Lock } from "lucide-react";
import {
  PERMISSION_ACTIONS,
  type PermissionAction,
  type PermissionModule,
  type RoleModulePermission,
  actionToColumn,
} from "@/lib/permissions";

interface CustomRoleRow {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  is_system: boolean;
  can_draft_with_ai: boolean;
  can_approve_ai_output: boolean;
  can_view_ai_advisor: boolean;
  can_manage_translations: boolean;
  can_manage_regions: boolean;
}

const ACTION_LABELS: Record<PermissionAction, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  approve: "Approve",
  export: "Export",
};

const TOP_LEVEL_FLAGS: { key: keyof CustomRoleRow; label: string; description: string; icon: typeof Sparkles }[] = [
  { key: "can_draft_with_ai", label: "AI Drafting", description: "Use AI to draft entity content", icon: Sparkles },
  { key: "can_approve_ai_output", label: "AI Approval", description: "Approve AI-drafted content before publish", icon: Shield },
  { key: "can_view_ai_advisor", label: "AI Advisor", description: "See AI recommendations and coaching", icon: Sparkles },
  { key: "can_manage_translations", label: "Translations", description: "Manage content translations", icon: Globe },
  { key: "can_manage_regions", label: "Regions & Compliance", description: "Manage region and residency settings", icon: MapPin },
];

export function RoleBuilderMatrix() {
  const qc = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, Partial<RoleModulePermission>>>({});
  const [pendingFlags, setPendingFlags] = useState<Partial<CustomRoleRow>>({});

  const { data: roles = [] } = useQuery({
    queryKey: ["custom-roles-builder"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_roles")
        .select("*")
        .order("is_system", { ascending: false })
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as CustomRoleRow[];
    },
  });

  const { data: modules = [] } = useQuery({
    queryKey: ["permission-modules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permission_modules")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as PermissionModule[];
    },
  });

  const { data: rolePerms = [], isLoading: loadingPerms } = useQuery({
    queryKey: ["role-module-permissions", selectedRoleId],
    enabled: !!selectedRoleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_module_permissions")
        .select("*")
        .eq("role_id", selectedRoleId!);
      if (error) throw error;
      return (data ?? []) as RoleModulePermission[];
    },
  });

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) ?? null,
    [roles, selectedRoleId]
  );

  const isAdminRole = selectedRole?.name === "Administrator";

  const groupedModules = useMemo(() => {
    const groups = new Map<string, PermissionModule[]>();
    for (const m of modules) {
      if (!groups.has(m.category)) groups.set(m.category, []);
      groups.get(m.category)!.push(m);
    }
    return Array.from(groups.entries());
  }, [modules]);

  const getValue = (moduleKey: string, action: PermissionAction): boolean => {
    const pendingRow = pending[moduleKey];
    if (pendingRow && actionToColumn(action) in pendingRow) {
      return Boolean(pendingRow[actionToColumn(action)]);
    }
    const row = rolePerms.find((p) => p.module_key === moduleKey);
    return row ? Boolean(row[actionToColumn(action)]) : false;
  };

  const setValue = (moduleKey: string, action: PermissionAction, value: boolean) => {
    setPending((prev) => ({
      ...prev,
      [moduleKey]: { ...prev[moduleKey], [actionToColumn(action)]: value },
    }));
  };

  const getFlag = (key: keyof CustomRoleRow): boolean => {
    if (key in pendingFlags) return Boolean(pendingFlags[key]);
    return Boolean(selectedRole?.[key]);
  };

  const setFlag = (key: keyof CustomRoleRow, value: boolean) => {
    setPendingFlags((prev) => ({ ...prev, [key]: value }));
  };

  const setRowAll = (moduleKey: string, value: boolean) => {
    PERMISSION_ACTIONS.forEach((a) => setValue(moduleKey, a, value));
  };

  const setColumnAll = (action: PermissionAction, value: boolean) => {
    modules.forEach((m) => setValue(m.module_key, action, value));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRole) return;

      // 1. Save top-level flags
      if (Object.keys(pendingFlags).length > 0) {
        const { error } = await supabase
          .from("custom_roles")
          .update(pendingFlags)
          .eq("id", selectedRole.id);
        if (error) throw error;
      }

      // 2. Upsert module permissions for any changed module
      const upserts = Object.entries(pending).map(([module_key, changes]) => {
        const existing = rolePerms.find((p) => p.module_key === module_key);
        return {
          role_id: selectedRole.id,
          module_key,
          can_view: existing?.can_view ?? false,
          can_create: existing?.can_create ?? false,
          can_edit: existing?.can_edit ?? false,
          can_delete: existing?.can_delete ?? false,
          can_approve: existing?.can_approve ?? false,
          can_export: existing?.can_export ?? false,
          ...changes,
        };
      });

      if (upserts.length > 0) {
        const { error } = await supabase
          .from("role_module_permissions")
          .upsert(upserts, { onConflict: "role_id,module_key" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role-module-permissions", selectedRoleId] });
      qc.invalidateQueries({ queryKey: ["custom-roles-builder"] });
      qc.invalidateQueries({ queryKey: ["custom-roles"] });
      setPending({});
      setPendingFlags({});
      toast.success("Role permissions saved");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  const cloneMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRole) return;
      const newName = `${selectedRole.name} (Copy)`;
      const { data: newRole, error } = await supabase
        .from("custom_roles")
        .insert({
          name: newName,
          description: selectedRole.description,
          color: selectedRole.color,
          is_system: false,
          can_draft_with_ai: selectedRole.can_draft_with_ai,
          can_approve_ai_output: selectedRole.can_approve_ai_output,
          can_view_ai_advisor: selectedRole.can_view_ai_advisor,
          can_manage_translations: selectedRole.can_manage_translations,
          can_manage_regions: selectedRole.can_manage_regions,
        })
        .select()
        .single();
      if (error) throw error;

      if (rolePerms.length > 0) {
        const perms = rolePerms.map((p) => ({
          role_id: newRole.id,
          module_key: p.module_key,
          can_view: p.can_view,
          can_create: p.can_create,
          can_edit: p.can_edit,
          can_delete: p.can_delete,
          can_approve: p.can_approve,
          can_export: p.can_export,
        }));
        const { error: pErr } = await supabase.from("role_module_permissions").insert(perms);
        if (pErr) throw pErr;
      }
      return newRole.id as string;
    },
    onSuccess: (newId) => {
      qc.invalidateQueries({ queryKey: ["custom-roles-builder"] });
      qc.invalidateQueries({ queryKey: ["custom-roles"] });
      toast.success("Role cloned");
      if (newId) setSelectedRoleId(newId);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to clone"),
  });

  const dirty = Object.keys(pending).length > 0 || Object.keys(pendingFlags).length > 0;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Role Builder
            </CardTitle>
            <CardDescription>
              Granular per-module, per-action permissions. Select a role and toggle exactly what it can do.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[240px]">
                <Select value={selectedRoleId ?? ""} onValueChange={setSelectedRoleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role to edit…" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        <span className="flex items-center gap-2">
                          {r.name}
                          {r.is_system && (
                            <Badge variant="secondary" className="text-xs">
                              System
                            </Badge>
                          )}
                          {r.name === "Administrator" && <Lock className="h-3 w-3 text-muted-foreground" />}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                onClick={() => cloneMutation.mutate()}
                disabled={!selectedRole || cloneMutation.isPending}
                className="gap-2"
              >
                <Copy className="h-4 w-4" />
                Clone Role
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!dirty || isAdminRole || saveMutation.isPending}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {saveMutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>
            {isAdminRole && (
              <p className="mt-3 text-sm text-muted-foreground flex items-center gap-2">
                <Lock className="h-3 w-3" /> The Administrator role is locked — it always has full access.
              </p>
            )}
          </CardContent>
        </Card>

        {selectedRole && (
          <>
            {/* Top-level capability flags */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Capability Flags</CardTitle>
                <CardDescription>Cross-cutting capabilities that gate AI, translations, and regional features.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {TOP_LEVEL_FLAGS.map((f) => {
                  const Icon = f.icon;
                  return (
                    <label
                      key={f.key}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/40 transition-colors cursor-pointer"
                    >
                      <Checkbox
                        checked={getFlag(f.key)}
                        disabled={isAdminRole}
                        onCheckedChange={(v) => setFlag(f.key, Boolean(v))}
                      />
                      <div className="space-y-0.5 flex-1">
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium text-sm">{f.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{f.description}</p>
                      </div>
                    </label>
                  );
                })}
              </CardContent>
            </Card>

            {/* Permission matrix */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Permission Matrix</CardTitle>
                <CardDescription>
                  Per-module, per-action permissions. Click column or row headers to toggle entire columns/rows.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingPerms ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Loading permissions…</p>
                ) : (
                  <ScrollArea className="h-[560px]">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-background z-10">
                        <tr className="border-b">
                          <th className="text-left font-medium py-2 pr-4 w-[260px]">Module</th>
                          {PERMISSION_ACTIONS.map((a) => (
                            <th key={a} className="text-center font-medium py-2 px-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const allOn = modules.every((m) => getValue(m.module_key, a));
                                      setColumnAll(a, !allOn);
                                    }}
                                    disabled={isAdminRole}
                                    className="hover:underline disabled:no-underline"
                                  >
                                    {ACTION_LABELS[a]}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Toggle entire {ACTION_LABELS[a]} column</TooltipContent>
                              </Tooltip>
                            </th>
                          ))}
                          <th className="text-center font-medium py-2 px-2 w-[60px]">All</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupedModules.map(([category, mods]) => (
                          <>
                            <tr key={`cat-${category}`} className="bg-muted/40">
                              <td colSpan={PERMISSION_ACTIONS.length + 2} className="py-1.5 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                {category}
                              </td>
                            </tr>
                            {mods.map((m) => {
                              const rowAllOn = PERMISSION_ACTIONS.every((a) => getValue(m.module_key, a));
                              return (
                                <tr key={m.module_key} className="border-b hover:bg-accent/20">
                                  <td className="py-2 pr-4">
                                    <div className="font-medium">{m.label}</div>
                                    {m.description && (
                                      <div className="text-xs text-muted-foreground">{m.description}</div>
                                    )}
                                  </td>
                                  {PERMISSION_ACTIONS.map((a) => (
                                    <td key={a} className="text-center py-2 px-2">
                                      <Checkbox
                                        checked={getValue(m.module_key, a)}
                                        disabled={isAdminRole}
                                        onCheckedChange={(v) => setValue(m.module_key, a, Boolean(v))}
                                      />
                                    </td>
                                  ))}
                                  <td className="text-center py-2 px-2">
                                    <Checkbox
                                      checked={rowAllOn}
                                      disabled={isAdminRole}
                                      onCheckedChange={(v) => setRowAll(m.module_key, Boolean(v))}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                )}
                {dirty && !isAdminRole && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    Unsaved changes — click <strong>Save Changes</strong> to persist.
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
