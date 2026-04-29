import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Package, Sparkles, Clock, ShieldCheck } from "lucide-react";

export default function PortalCatalog() {
  const { currentOrganization } = useOrganization();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const { data: categories = [] } = useQuery({
    queryKey: ["portal-svc-categories", currentOrganization?.id],
    enabled: !!currentOrganization?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("service_catalog_categories")
        .select("id, name, color")
        .eq("organization_id", currentOrganization!.id)
        .eq("is_active", true)
        .order("sort_order");
      return data ?? [];
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["portal-svc-items", currentOrganization?.id],
    enabled: !!currentOrganization?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("service_catalog_items")
        .select(
          "id, name, short_description, category_id, approval_policy, cost_estimate, estimated_fulfillment_hours, service_catalog_categories(name, color)"
        )
        .eq("organization_id", currentOrganization!.id)
        .eq("is_active", true)
        .order("sort_order");
      return data ?? [];
    },
  });

  const filtered = useMemo(
    () =>
      items.filter((i: any) => {
        if (activeCategory !== "all" && i.category_id !== activeCategory) return false;
        if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    [items, search, activeCategory]
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Package className="h-6 w-6" /> Service Catalog
        </h1>
        <p className="text-sm text-muted-foreground">
          Browse available services. Pick one and the assistant will gather the details and submit your request.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search services…"
            className="pl-8"
          />
        </div>
        <Link to="/portal/new">
          <Button variant="outline" className="gap-2">
            <Sparkles className="h-4 w-4" /> Not sure? Ask the assistant
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge
          variant={activeCategory === "all" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setActiveCategory("all")}
        >
          All
        </Badge>
        {categories.map((c: any) => (
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
          No services available right now.
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((item: any) => (
            <Card
              key={item.id}
              className="p-4 flex flex-col gap-3 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{item.name}</h3>
                  {item.service_catalog_categories?.name && (
                    <Badge
                      variant="outline"
                      className="mt-1 text-[10px]"
                      style={{ borderColor: item.service_catalog_categories.color }}
                    >
                      {item.service_catalog_categories.name}
                    </Badge>
                  )}
                </div>
              </div>
              {item.short_description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{item.short_description}</p>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-auto flex-wrap">
                {item.cost_estimate != null && (
                  <Badge variant="secondary">${Number(item.cost_estimate).toLocaleString()}</Badge>
                )}
                {item.estimated_fulfillment_hours != null && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {item.estimated_fulfillment_hours}h
                  </span>
                )}
                {item.approval_policy !== "none" && (
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" /> Approval
                  </span>
                )}
              </div>
              <Button
                size="sm"
                className="gap-1"
                onClick={() =>
                  navigate(
                    `/portal/new?service=${encodeURIComponent(item.name)}`
                  )
                }
              >
                <Sparkles className="h-3.5 w-3.5" /> Request via chat
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
