import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface PinnedEntity {
  id: string;
  entity_type: string;
  entity_id: string | null;
  label: string;
  href: string;
  position: number;
}

export function usePinnedEntities() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["user-pinned", user?.id],
    queryFn: async (): Promise<PinnedEntity[]> => {
      if (!user) return [];
      const { data } = await supabase
        .from("user_pinned_entities")
        .select("id, entity_type, entity_id, label, href, position")
        .eq("user_id", user.id)
        .order("position", { ascending: true });
      return (data || []) as PinnedEntity[];
    },
    enabled: !!user,
  });

  const pin = useMutation({
    mutationFn: async (item: Omit<PinnedEntity, "id" | "position">) => {
      if (!user) throw new Error("Not signed in");
      const position = (query.data?.length || 0);
      const { error } = await supabase.from("user_pinned_entities").upsert(
        { user_id: user.id, position, ...item },
        { onConflict: "user_id,entity_type,entity_id,href" }
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-pinned", user?.id] }),
  });

  const unpin = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_pinned_entities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-pinned", user?.id] }),
  });

  return {
    pinned: query.data || [],
    isLoading: query.isLoading,
    pin: pin.mutateAsync,
    unpin: unpin.mutateAsync,
  };
}
