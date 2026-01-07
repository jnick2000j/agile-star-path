import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

interface Entity {
  id: string;
  name: string;
}

interface EntitySelectorProps {
  programmeId: string;
  projectId: string;
  productId: string;
  onProgrammeChange: (value: string) => void;
  onProjectChange: (value: string) => void;
  onProductChange: (value: string) => void;
  showProgramme?: boolean;
  showProject?: boolean;
  showProduct?: boolean;
  programmeLabel?: string;
  projectLabel?: string;
  productLabel?: string;
  className?: string;
}

export function EntitySelector({
  programmeId,
  projectId,
  productId,
  onProgrammeChange,
  onProjectChange,
  onProductChange,
  showProgramme = true,
  showProject = true,
  showProduct = true,
  programmeLabel = "Programme",
  projectLabel = "Project",
  productLabel = "Product",
  className = "",
}: EntitySelectorProps) {
  const [programmes, setProgrammes] = useState<Entity[]>([]);
  const [projects, setProjects] = useState<Entity[]>([]);
  const [products, setProducts] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    const fetchEntities = async () => {
      setLoading(true);

      // Build queries with optional org filtering
      let programmeQuery = supabase.from("programmes").select("id, name").order("name");
      let projectQuery = supabase.from("projects").select("id, name, programme_id").order("name");
      let productQuery = supabase.from("products").select("id, name, programme_id").order("name");

      if (currentOrganization) {
        programmeQuery = programmeQuery.eq("organization_id", currentOrganization.id);
        projectQuery = projectQuery.eq("organization_id", currentOrganization.id);
        productQuery = productQuery.eq("organization_id", currentOrganization.id);
      }

      const [programmesRes, projectsRes, productsRes] = await Promise.all([
        programmeQuery,
        projectQuery,
        productQuery,
      ]);

      if (programmesRes.data) setProgrammes(programmesRes.data);
      if (projectsRes.data) setProjects(projectsRes.data);
      if (productsRes.data) setProducts(productsRes.data);

      setLoading(false);
    };

    fetchEntities();
  }, [currentOrganization]);

  // Filter projects and products based on selected programme
  const filteredProjects = programmeId
    ? projects.filter((p: any) => p.programme_id === programmeId || !p.programme_id)
    : projects;

  const filteredProducts = programmeId
    ? products.filter((p: any) => p.programme_id === programmeId || !p.programme_id)
    : products;

  if (loading) {
    return (
      <div className={`grid gap-4 sm:grid-cols-3 ${className}`}>
        {showProgramme && (
          <div>
            <Label>{programmeLabel}</Label>
            <div className="h-10 bg-muted animate-pulse rounded-md mt-1" />
          </div>
        )}
        {showProject && (
          <div>
            <Label>{projectLabel}</Label>
            <div className="h-10 bg-muted animate-pulse rounded-md mt-1" />
          </div>
        )}
        {showProduct && (
          <div>
            <Label>{productLabel}</Label>
            <div className="h-10 bg-muted animate-pulse rounded-md mt-1" />
          </div>
        )}
      </div>
    );
  }

  const visibleCount = [showProgramme, showProject, showProduct].filter(Boolean).length;
  const gridCols = visibleCount === 1 ? "sm:grid-cols-1" : visibleCount === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3";

  return (
    <div className={`grid gap-4 ${gridCols} ${className}`}>
      {showProgramme && (
        <div>
          <Label>{programmeLabel}</Label>
          <Select value={programmeId || "none"} onValueChange={(v) => onProgrammeChange(v === "none" ? "" : v)}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select programme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {programmes.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {showProject && (
        <div>
          <Label>{projectLabel}</Label>
          <Select value={projectId || "none"} onValueChange={(v) => onProjectChange(v === "none" ? "" : v)}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {filteredProjects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {showProduct && (
        <div>
          <Label>{productLabel}</Label>
          <Select value={productId || "none"} onValueChange={(v) => onProductChange(v === "none" ? "" : v)}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select product" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {filteredProducts.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}