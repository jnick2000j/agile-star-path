import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useOrgAccessLevel } from "@/hooks/useOrgAccessLevel";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Layers } from "lucide-react";
import { toast } from "sonner";

export function OrgVerticalCard() {
  const { currentOrganization, refreshOrganizations } = useOrganization();
  const { accessLevel } = useOrgAccessLevel();
  const isOrgAdmin = accessLevel === "admin";

  const [verticals, setVerticals] = useState<any[]>([]);
  const [current, setCurrent] = useState<string>("technology");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("industry_verticals").select("*").eq("is_active", true).order("sort_order").then(({ data }) => {
      setVerticals(data || []);
    });
  }, []);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    supabase.from("organizations").select("industry_vertical").eq("id", currentOrganization.id).maybeSingle()
      .then(({ data }) => { if (data?.industry_vertical) setCurrent(data.industry_vertical); });
  }, [currentOrganization?.id]);

  const save = async () => {
    if (!currentOrganization?.id) return;
    setSaving(true);
    const { error } = await supabase.from("organizations").update({ industry_vertical: current }).eq("id", currentOrganization.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Industry vertical updated. Reloading…");
    await refreshOrganizations();
    setTimeout(() => window.location.reload(), 600);
  };

  if (!currentOrganization) return null;

  const currentDef = verticals.find((v) => v.id === current);

  return (
    <Card className="p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-2">
        <Layers className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Industry Vertical</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Tailors modules, terminology and AI context to your industry.
      </p>
      <div className="space-y-3">
        <div>
          <Label>Vertical</Label>
          <Select value={current} onValueChange={setCurrent} disabled={!isOrgAdmin}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {verticals.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentDef && <p className="text-xs text-muted-foreground mt-1">{currentDef.description}</p>}
        </div>
        {isOrgAdmin && (
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save vertical"}</Button>
        )}
        {!isOrgAdmin && <p className="text-xs text-muted-foreground">Only organization admins can change this.</p>}
      </div>
    </Card>
  );
}
