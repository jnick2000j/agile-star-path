import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { MessageSquarePlus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

interface EntityUpdatesProps {
  entityType: "task" | "project" | "programme" | "product";
  entityId: string;
  organizationId?: string | null;
}

const criticialityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  critical: "bg-destructive/20 text-destructive",
};

export function EntityUpdates({ entityType, entityId, organizationId }: EntityUpdatesProps) {
  const { user, userRole } = useAuth();
  const { isAdmin } = usePermissions();
  const queryClient = useQueryClient();
  const [newUpdate, setNewUpdate] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [isRiskFlagged, setIsRiskFlagged] = useState(false);
  const [riskCriticality, setRiskCriticality] = useState("medium");

  // Stakeholder roles cannot post updates
  const isStakeholder = userRole === "org_stakeholder" || userRole === "programme_stakeholder" || userRole === "project_stakeholder" || userRole === "product_stakeholder" || userRole === "stakeholder";
  const canPostUpdates = !isStakeholder || isAdmin;

  const { data: updates = [] } = useQuery({
    queryKey: ["entity-updates", entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entity_updates")
        .select("*, profiles:created_by(full_name, email)")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addUpdate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("entity_updates").insert({
        entity_type: entityType,
        entity_id: entityId,
        update_text: newUpdate.trim(),
        created_by: user?.id,
        organization_id: organizationId || null,
        is_risk_flagged: isRiskFlagged,
        risk_criticality: isRiskFlagged ? riskCriticality : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entity-updates", entityType, entityId] });
      setNewUpdate("");
      setShowForm(false);
      setIsRiskFlagged(false);
      setRiskCriticality("medium");
      toast({ title: "Update added" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteUpdate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("entity_updates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entity-updates", entityType, entityId] });
      toast({ title: "Update removed" });
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Progress Updates</h4>
        <Button variant="ghost" size="sm" onClick={() => setShowForm(!showForm)} className="gap-1">
          <MessageSquarePlus className="h-3.5 w-3.5" />
          Add Update
        </Button>
      </div>

      {showForm && (
        <div className="space-y-3">
          <Textarea
            placeholder="Add a progress update..."
            value={newUpdate}
            onChange={(e) => setNewUpdate(e.target.value)}
            rows={2}
          />
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Switch
                id="risk-flag"
                checked={isRiskFlagged}
                onCheckedChange={setIsRiskFlagged}
              />
              <Label htmlFor="risk-flag" className="flex items-center gap-1 text-sm cursor-pointer">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                Flag as Risk
              </Label>
            </div>
            {isRiskFlagged && (
              <div className="flex items-center gap-2">
                <Label className="text-sm">Criticality:</Label>
                <Select value={riskCriticality} onValueChange={setRiskCriticality}>
                  <SelectTrigger className="w-28 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" onClick={() => addUpdate.mutate()} disabled={!newUpdate.trim() || addUpdate.isPending}>
              Post
            </Button>
          </div>
        </div>
      )}

      {updates.length === 0 && !showForm && (
        <p className="text-xs text-muted-foreground">No updates yet.</p>
      )}

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {updates.map((u: any) => (
          <div key={u.id} className="border rounded-md p-3 text-sm space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {u.profiles?.full_name || u.profiles?.email || "Unknown"} · {format(new Date(u.created_at), "MMM d, yyyy h:mm a")}
                </span>
                {u.is_risk_flagged && (
                  <Badge className={criticialityColors[u.risk_criticality || "medium"]}>
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Risk: {u.risk_criticality || "medium"}
                  </Badge>
                )}
              </div>
              {u.created_by === user?.id && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteUpdate.mutate(u.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
            <p className="text-foreground whitespace-pre-wrap">{u.update_text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
