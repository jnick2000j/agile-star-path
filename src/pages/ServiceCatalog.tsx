import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useNavigate, Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Package, Settings2, Clock, ShieldCheck } from "lucide-react";
import { RequestCatalogItemDialog } from "@/components/catalog/RequestCatalogItemDialog";
import { useOrgAccessLevel } from "@/hooks/useOrgAccessLevel";

export default function ServiceCatalog() {
  const { currentOrganization } = useOrganization();
  const { accessLevel } = useOrgAccessLevel();
  const isManager = accessLevel === "admin" || accessLevel === "manager";
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [requestItemId, setRequestItemId] = useState<string | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["svc-categories-public", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data } = await supabase
        .from("service_catalog_categories")
        .select("id, name, color")
        .eq("organization_id", currentOrganization.id)
        .eq("is_active", true)
        .order("sort_order");
      return data ?? [];
    },
    enabled: !!currentOrganization?.id,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["svc-items-public", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data } = await supabase
        .from("service_catalog_items")
        .select("id, name, short_description, category_id, approval_policy, cost_estimate, estimated_fulfillment_hours, service_catalog_categories(name, color)")
        .eq("organization_id", currentOrganization.id)
        .eq("is_active", true)
        .order("sort_order");
      return data ?? [];
    },
    enabled: !!currentOrganization?.id,
  });

  const filtered = useMemo(() => items.filter((i: any) => {
    if (activeCategory !== "all" && i.category_id !== activeCategory) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [items, search, activeCategory]);

  return (
    <AppLayout title="Service Catalog" subtitle="Order services, access, and equipment">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search services…" className="pl-8" />
          </div>
          {isManager && (
            <Button variant="outline" onClick={() => navigate("/catalog/admin")} className="gap-2">
              <Settings2 className="h-4 w-4" /> Manage catalog
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge
            variant={activeCategory === "all" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setActiveCategory("all")}
          >
            All
          </Badge>
          {categories.map((c) => (
            <Badge
              key={c.id}
              variant={activeCategory === c.id ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setActiveCategory(c.id)}
              style={activeCategory === c.id ? undefined : { borderColor: c.color }}
            >
              {c.name}
            </Badge>
          ))}
        </div>

        {filtered.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />
            No services available yet. {isManager && <Link to="/catalog/admin" className="text-primary hover:underline">Set up the catalog</Link>}
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((item: any) => (
              <Card key={item.id} className="p-4 flex flex-col gap-3 hover:border-primary/40 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{item.name}</h3>
                    {item.service_catalog_categories?.name && (
                      <Badge variant="outline" className="mt-1 text-[10px]" style={{ borderColor: item.service_catalog_categories.color }}>
                        {item.service_catalog_categories.name}
                      </Badge>
                    )}
                  </div>
                </div>
                {item.short_description && <p className="text-sm text-muted-foreground line-clamp-2">{item.short_description}</p>}
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-auto">
                  {item.cost_estimate != null && <Badge variant="secondary">${Number(item.cost_estimate).toLocaleString()}</Badge>}
                  {item.estimated_fulfillment_hours != null && (
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {item.estimated_fulfillment_hours}h</span>
                  )}
                  {item.approval_policy !== "none" && (
                    <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Approval</span>
                  )}
                </div>
                <Button size="sm" onClick={() => setRequestItemId(item.id)}>Request</Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      {requestItemId && (
        <RequestCatalogItemDialog
          itemId={requestItemId}
          open={!!requestItemId}
          onOpenChange={(v) => !v && setRequestItemId(null)}
          onCreated={(ticketId) => navigate(`/support/tickets/${ticketId}`)}
        />
      )}
    </AppLayout>
  );
}
