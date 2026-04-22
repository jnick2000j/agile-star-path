import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EntityLinksFieldsProps {
  organizationId: string | null | undefined;
  programmeId: string;
  projectId: string;
  productId: string;
  onChange: (next: { programmeId: string; projectId: string; productId: string }) => void;
  disabled?: boolean;
}

/**
 * Reusable field group for editing the programme / project / product association
 * on a register item (risk, issue, benefit, etc.).
 */
export function EntityLinksFields({
  organizationId,
  programmeId,
  projectId,
  productId,
  onChange,
  disabled,
}: EntityLinksFieldsProps) {
  const { data: programmes = [] } = useQuery({
    queryKey: ["entity-links-programmes", organizationId],
    queryFn: async () => {
      const q = supabase.from("programmes").select("id, name").order("name");
      const { data } = organizationId
        ? await q.or(`organization_id.eq.${organizationId},organization_id.is.null`)
        : await q;
      return data || [];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["entity-links-projects", organizationId],
    queryFn: async () => {
      const q = supabase
        .from("projects")
        .select("id, name, programme_id")
        .order("name");
      const { data } = organizationId
        ? await q.or(`organization_id.eq.${organizationId},organization_id.is.null`)
        : await q;
      return data || [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["entity-links-products", organizationId],
    queryFn: async () => {
      const q = supabase
        .from("products")
        .select("id, name, programme_id, project_id")
        .order("name");
      const { data } = organizationId
        ? await q.or(`organization_id.eq.${organizationId},organization_id.is.null`)
        : await q;
      return data || [];
    },
  });

  const filteredProjects = programmeId
    ? projects.filter((p: any) => !p.programme_id || p.programme_id === programmeId)
    : projects;

  const filteredProducts = products.filter(
    (p: any) =>
      (!programmeId || !p.programme_id || p.programme_id === programmeId) &&
      (!projectId || !p.project_id || p.project_id === projectId)
  );

  return (
    <div className="grid gap-3 sm:grid-cols-3 sm:col-span-2">
      <div className="space-y-1">
        <Label className="text-xs">Programme</Label>
        <Select
          value={programmeId || "none"}
          onValueChange={(v) =>
            onChange({
              programmeId: v === "none" ? "" : v,
              projectId,
              productId,
            })
          }
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="No programme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Programme</SelectItem>
            {programmes.map((p: any) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Project</Label>
        <Select
          value={projectId || "none"}
          onValueChange={(v) =>
            onChange({
              programmeId,
              projectId: v === "none" ? "" : v,
              productId,
            })
          }
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="No project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Project</SelectItem>
            {filteredProjects.map((p: any) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Product</Label>
        <Select
          value={productId || "none"}
          onValueChange={(v) =>
            onChange({
              programmeId,
              projectId,
              productId: v === "none" ? "" : v,
            })
          }
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="No product" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Product</SelectItem>
            {filteredProducts.map((p: any) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
