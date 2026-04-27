import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  ListTodo,
  AlertTriangle,
  LifeBuoy,
  FileQuestion,
  Plus,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useVertical } from "@/hooks/useVertical";

type CreateKind = "task" | "risk" | "ticket" | "rfi";

const KIND_META: Record<CreateKind, { label: string; icon: React.ElementType; placeholder: string }> = {
  task: { label: "Task", icon: ListTodo, placeholder: "What needs to be done?" },
  risk: { label: "Risk", icon: AlertTriangle, placeholder: "Describe the risk…" },
  ticket: { label: "Ticket", icon: LifeBuoy, placeholder: "What do you need help with?" },
  rfi: { label: "RFI", icon: FileQuestion, placeholder: "What's the question?" },
};

export function QuickCreateBar() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const { hasModule } = useVertical();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [kind, setKind] = useState<CreateKind>("task");
  const [title, setTitle] = useState("");

  const availableKinds: CreateKind[] = (["task", "risk", "ticket", "rfi"] as const).filter((k) => {
    if (k === "ticket") return hasModule("helpdesk");
    if (k === "rfi") return hasModule("rfis");
    return true;
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user || !currentOrganization) throw new Error("Sign in to an organization first");
      const trimmed = title.trim();
      if (!trimmed) throw new Error("Add a title");

      if (kind === "task") {
        const { data, error } = await (supabase as any)
          .from("tasks")
          .insert({
            name: trimmed,
            organization_id: currentOrganization.id,
            assigned_to: user.id,
            created_by: user.id,
            status: "todo",
            priority: "medium",
          })
          .select("id")
          .single();
        if (error) throw error;
        return { type: "task", id: data.id, href: `/tasks?id=${data.id}` };
      }
      if (kind === "risk") {
        const { data, error } = await (supabase as any)
          .from("risks")
          .insert({
            title: trimmed,
            organization_id: currentOrganization.id,
            owner_id: user.id,
            created_by: user.id,
            status: "open",
            impact: "medium",
            probability: "medium",
            score: 9,
          })
          .select("id")
          .single();
        if (error) throw error;
        return { type: "risk", id: data.id, href: `/registers?type=risk&id=${data.id}` };
      }
      if (kind === "ticket") {
        const { data, error } = await (supabase as any)
          .from("support_tickets")
          .insert({
            subject: trimmed,
            organization_id: currentOrganization.id,
            created_by: user.id,
            status: "open",
            priority: "medium",
            type: "request",
          })
          .select("id")
          .single();
        if (error) throw error;
        return { type: "ticket", id: data.id, href: `/support` };
      }
      // rfi
      const refNum = `RFI-${Date.now().toString().slice(-6)}`;
      const { data, error } = await (supabase as any)
        .from("rfis")
        .insert({
          subject: trimmed,
          question: trimmed,
          rfi_number: refNum,
          organization_id: currentOrganization.id,
          submitted_by: user.id,
          status: "open",
          priority: "medium",
        })
        .select("id")
        .single();
      if (error) throw error;
      return { type: "rfi", id: data.id, href: `/construction/rfis` };
    },
    onSuccess: (result) => {
      toast.success(`${KIND_META[kind].label} created`, {
        action: { label: "Open", onClick: () => navigate(result.href) },
      });
      setTitle("");
      qc.invalidateQueries({ queryKey: ["my-work"] });
      qc.invalidateQueries({ queryKey: ["action-inbox"] });
    },
    onError: (e: any) => toast.error(e.message || "Could not create"),
  });

  const Icon = KIND_META[kind].icon;

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <div className="flex items-center gap-2 sm:w-[140px]">
            <Plus className="h-4 w-4 text-primary shrink-0" />
            <Select value={kind} onValueChange={(v) => setKind(v as CreateKind)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableKinds.map((k) => {
                  const M = KIND_META[k];
                  return (
                    <SelectItem key={k} value={k}>
                      <span className="flex items-center gap-2">
                        <M.icon className="h-3.5 w-3.5" />
                        {M.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={KIND_META[kind].placeholder}
            className="flex-1 h-9"
            onKeyDown={(e) => {
              if (e.key === "Enter" && title.trim()) create.mutate();
            }}
            disabled={create.isPending}
          />
          <Button
            onClick={() => create.mutate()}
            disabled={!title.trim() || create.isPending}
            size="sm"
            className="h-9"
          >
            {create.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Icon className="h-4 w-4 mr-1.5" />
                Create
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
