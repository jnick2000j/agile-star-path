import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useOrganization } from "./useOrganization";
import { toast } from "@/hooks/use-toast";

export type SavedViewLayout = "table" | "kanban" | "calendar" | "list" | "board" | "gantt";

export interface SavedViewConfig {
  filters?: Record<string, any>;
  sort?: { field: string; dir: "asc" | "desc" } | null;
  columns?: string[];
  grouping?: string | null;
  layout?: SavedViewLayout;
  /** Quick assignment chip: me | my_team | created_by_me | mentioned_me | unassigned | null */
  assignment?: string | null;
}

export interface SavedView {
  id: string;
  organization_id: string;
  owner_user_id: string;
  scope: string;
  name: string;
  description: string | null;
  is_shared: boolean;
  config: SavedViewConfig;
  created_at: string;
  updated_at: string;
}

interface UseSavedViewsResult {
  views: SavedView[];
  loading: boolean;
  activeView: SavedView | null;
  activeConfig: SavedViewConfig;
  setActiveConfig: (cfg: SavedViewConfig) => void;
  selectView: (id: string | null) => void;
  saveView: (input: { name: string; description?: string; is_shared?: boolean; id?: string }) => Promise<SavedView | null>;
  deleteView: (id: string) => Promise<boolean>;
  setOrgDefault: (id: string | null) => Promise<void>;
  setMyDefault: (id: string | null) => Promise<void>;
  orgDefaultId: string | null;
  myDefaultId: string | null;
  refresh: () => Promise<void>;
}

/**
 * Platform-wide saved views hook. Persists filters, sort, columns,
 * grouping, layout, and assignment chip per scope (e.g. "helpdesk.tickets").
 */
export function useSavedViews(scope: string, initialConfig: SavedViewConfig = {}): UseSavedViewsResult {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id ?? null;

  const [views, setViews] = useState<SavedView[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeConfig, setActiveConfigState] = useState<SavedViewConfig>(initialConfig);
  const [orgDefaultId, setOrgDefaultId] = useState<string | null>(null);
  const [myDefaultId, setMyDefaultId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user || !orgId) {
      setViews([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [vRes, oRes, uRes] = await Promise.all([
      supabase
        .from("saved_views" as any)
        .select("*")
        .eq("organization_id", orgId)
        .eq("scope", scope)
        .order("name", { ascending: true }),
      supabase
        .from("saved_view_org_defaults" as any)
        .select("view_id")
        .eq("organization_id", orgId)
        .eq("scope", scope)
        .maybeSingle(),
      supabase
        .from("saved_view_user_defaults" as any)
        .select("view_id")
        .eq("user_id", user.id)
        .eq("organization_id", orgId)
        .eq("scope", scope)
        .maybeSingle(),
    ]);
    const list = (vRes.data ?? []) as unknown as SavedView[];
    setViews(list);
    setOrgDefaultId(((oRes.data as any)?.view_id) ?? null);
    setMyDefaultId(((uRes.data as any)?.view_id) ?? null);
    setLoading(false);
  }, [orgId, scope, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Apply default on first load
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (loading || hydrated || views.length === 0 && !myDefaultId && !orgDefaultId) {
      if (!loading) setHydrated(true);
      return;
    }
    if (!hydrated) {
      const target = myDefaultId ?? orgDefaultId;
      if (target) {
        const v = views.find((x) => x.id === target);
        if (v) {
          setActiveId(v.id);
          setActiveConfigState({ ...initialConfig, ...v.config });
        }
      }
      setHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, views, myDefaultId, orgDefaultId, hydrated]);

  const activeView = useMemo(
    () => views.find((v) => v.id === activeId) ?? null,
    [views, activeId]
  );

  const setActiveConfig = useCallback((cfg: SavedViewConfig) => {
    setActiveConfigState(cfg);
  }, []);

  const selectView = useCallback(
    (id: string | null) => {
      setActiveId(id);
      if (id) {
        const v = views.find((x) => x.id === id);
        if (v) setActiveConfigState({ ...initialConfig, ...v.config });
      } else {
        setActiveConfigState(initialConfig);
      }
    },
    [views, initialConfig]
  );

  const saveView: UseSavedViewsResult["saveView"] = useCallback(
    async ({ name, description, is_shared, id }) => {
      if (!user || !orgId) return null;
      const payload = {
        organization_id: orgId,
        owner_user_id: user.id,
        scope,
        name,
        description: description ?? null,
        is_shared: !!is_shared,
        config: activeConfig as any,
      };
      let res;
      if (id) {
        res = await supabase
          .from("saved_views" as any)
          .update({
            name,
            description: description ?? null,
            is_shared: !!is_shared,
            config: activeConfig as any,
          })
          .eq("id", id)
          .select()
          .maybeSingle();
      } else {
        res = await supabase
          .from("saved_views" as any)
          .insert(payload)
          .select()
          .maybeSingle();
      }
      if (res.error) {
        toast({ title: "Could not save view", description: res.error.message, variant: "destructive" });
        return null;
      }
      await refresh();
      const saved = res.data as unknown as SavedView;
      if (saved?.id) setActiveId(saved.id);
      toast({ title: id ? "View updated" : "View saved" });
      return saved;
    },
    [user, orgId, scope, activeConfig, refresh]
  );

  const deleteView = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("saved_views" as any).delete().eq("id", id);
      if (error) {
        toast({ title: "Delete failed", description: error.message, variant: "destructive" });
        return false;
      }
      if (activeId === id) setActiveId(null);
      await refresh();
      toast({ title: "View deleted" });
      return true;
    },
    [activeId, refresh]
  );

  const setOrgDefault = useCallback(
    async (id: string | null) => {
      if (!orgId) return;
      if (!id) {
        await supabase
          .from("saved_view_org_defaults" as any)
          .delete()
          .eq("organization_id", orgId)
          .eq("scope", scope);
      } else {
        await supabase
          .from("saved_view_org_defaults" as any)
          .upsert(
            { organization_id: orgId, scope, view_id: id, set_by: user?.id },
            { onConflict: "organization_id,scope" }
          );
      }
      setOrgDefaultId(id);
      toast({ title: id ? "Org default set" : "Org default cleared" });
    },
    [orgId, scope, user?.id]
  );

  const setMyDefault = useCallback(
    async (id: string | null) => {
      if (!orgId || !user) return;
      if (!id) {
        await supabase
          .from("saved_view_user_defaults" as any)
          .delete()
          .eq("user_id", user.id)
          .eq("organization_id", orgId)
          .eq("scope", scope);
      } else {
        await supabase
          .from("saved_view_user_defaults" as any)
          .upsert(
            { user_id: user.id, organization_id: orgId, scope, view_id: id },
            { onConflict: "user_id,organization_id,scope" }
          );
      }
      setMyDefaultId(id);
      toast({ title: id ? "Your default set" : "Personal default cleared" });
    },
    [orgId, scope, user]
  );

  return {
    views,
    loading,
    activeView,
    activeConfig,
    setActiveConfig,
    selectView,
    saveView,
    deleteView,
    setOrgDefault,
    setMyDefault,
    orgDefaultId,
    myDefaultId,
    refresh,
  };
}
