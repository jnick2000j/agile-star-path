import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Layers } from "lucide-react";
import { toast } from "sonner";

export function OrgVerticalManager() {
  const qc = useQueryClient();

  const { data: orgs = [] } = useQuery({
    queryKey: ["admin-orgs-verticals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, slug, industry_vertical")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: verticals = [] } = useQuery({
    queryKey: ["industry-verticals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("industry_verticals")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const updateVertical = useMutation({
    mutationFn: async ({ orgId, verticalId }: { orgId: string; verticalId: string }) => {
      const { error } = await supabase
        .from("organizations")
        .update({ industry_vertical: verticalId })
        .eq("id", orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Industry vertical updated");
      qc.invalidateQueries({ queryKey: ["admin-orgs-verticals"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Layers className="h-5 w-5" /> Industry Vertical per Organization
        </h3>
        <p className="text-sm text-muted-foreground">
          Switching the vertical changes the visible modules, terminology and AI context for that organization.
        </p>
      </div>

      <Card className="divide-y">
        {orgs.map((org: any) => {
          const current = verticals.find((v: any) => v.id === org.industry_vertical);
          return (
            <div key={org.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="font-medium truncate">{org.name}</div>
                <div className="text-xs text-muted-foreground">{org.slug}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {current && <Badge variant="outline">{current.name}</Badge>}
                <Select
                  value={org.industry_vertical || "technology"}
                  onValueChange={(v) => updateVertical.mutate({ orgId: org.id, verticalId: v })}
                >
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {verticals.map((v: any) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          );
        })}
        {orgs.length === 0 && <div className="p-8 text-center text-muted-foreground">No organizations.</div>}
      </Card>
    </div>
  );
}
