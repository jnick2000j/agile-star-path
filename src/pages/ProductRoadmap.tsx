import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight,
  GripVertical,
  Package,
  Plus,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { CreateProductDialog } from "@/components/dialogs/CreateProductDialog";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  description: string | null;
  stage: string;
  launch_date: string | null;
  organization_id: string | null;
}

interface Feature {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  target_release: string | null;
  product_id: string;
  moscow: string | null;
}

const quarters = ["Q1", "Q2", "Q3", "Q4"];
const currentYear = new Date().getFullYear();

const stageColors: Record<string, string> = {
  discovery: "bg-info/20 border-info text-info",
  definition: "bg-primary/20 border-primary text-primary",
  development: "bg-warning/20 border-warning text-warning",
  launch: "bg-success/20 border-success text-success",
  growth: "bg-success/20 border-success text-success",
  maturity: "bg-muted border-muted-foreground text-muted-foreground",
};

const priorityColors: Record<string, string> = {
  high: "bg-destructive/10 text-destructive",
  medium: "bg-warning/10 text-warning",
  low: "bg-muted text-muted-foreground",
};

export default function ProductRoadmap() {
  const [products, setProducts] = useState<Product[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [draggedItem, setDraggedItem] = useState<{ type: "product" | "feature"; id: string } | null>(null);
  const { currentOrganization } = useOrganization();

  const fetchData = async () => {
    setLoading(true);
    
    let productQuery = supabase.from("products").select("*").order("name");
    if (currentOrganization) {
      productQuery = productQuery.eq("organization_id", currentOrganization.id);
    }

    const [productsRes, featuresRes] = await Promise.all([
      productQuery,
      supabase.from("product_features").select("*").order("priority"),
    ]);

    if (productsRes.error) console.error("Products error:", productsRes.error);
    if (featuresRes.error) console.error("Features error:", featuresRes.error);

    setProducts(productsRes.data || []);
    setFeatures(featuresRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [currentOrganization]);

  const getQuarterFromDate = (dateStr: string | null): string | null => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (date.getFullYear() !== selectedYear) return null;
    const month = date.getMonth();
    if (month < 3) return "Q1";
    if (month < 6) return "Q2";
    if (month < 9) return "Q3";
    return "Q4";
  };

  const getProductsForQuarter = (quarter: string) => {
    return products.filter(p => getQuarterFromDate(p.launch_date) === quarter);
  };

  const getFeaturesForQuarter = (quarter: string) => {
    return features.filter(f => {
      if (!f.target_release) return false;
      // Check if target_release matches quarter format (Q1, Q2, etc.) or is a date
      if (f.target_release.startsWith("Q")) {
        return f.target_release === quarter;
      }
      return getQuarterFromDate(f.target_release) === quarter;
    });
  };

  const handleDragStart = (type: "product" | "feature", id: string) => {
    setDraggedItem({ type, id });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (quarter: string) => {
    if (!draggedItem) return;

    const targetDate = new Date(selectedYear, quarters.indexOf(quarter) * 3 + 1, 15);
    const dateStr = targetDate.toISOString().split("T")[0];

    try {
      if (draggedItem.type === "product") {
        await supabase
          .from("products")
          .update({ launch_date: dateStr })
          .eq("id", draggedItem.id);
        toast.success("Product launch date updated");
      } else {
        await supabase
          .from("product_features")
          .update({ target_release: quarter })
          .eq("id", draggedItem.id);
        toast.success("Feature target release updated");
      }
      fetchData();
    } catch (error) {
      toast.error("Failed to update");
    }

    setDraggedItem(null);
  };

  const unscheduledProducts = products.filter(p => !p.launch_date || new Date(p.launch_date).getFullYear() !== selectedYear);
  const unscheduledFeatures = features.filter(f => !f.target_release);

  return (
    <AppLayout title="Product Roadmap" subtitle="Visual timeline for product and feature planning">
      <div className="space-y-6">
        {/* Header Controls */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSelectedYear(selectedYear - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-[120px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map(year => (
                  <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSelectedYear(selectedYear + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <CreateProductDialog onSuccess={fetchData} />
        </div>

        {/* Roadmap Timeline */}
        <div className="metric-card overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Quarter Headers */}
            <div className="grid grid-cols-4 gap-4 mb-4">
              {quarters.map(quarter => (
                <div
                  key={quarter}
                  className="text-center p-3 rounded-lg bg-secondary font-semibold"
                >
                  {quarter} {selectedYear}
                </div>
              ))}
            </div>

            {/* Timeline Content */}
            <div className="grid grid-cols-4 gap-4 min-h-[400px]">
              {quarters.map(quarter => (
                <div
                  key={quarter}
                  className="border-2 border-dashed border-border rounded-lg p-3 space-y-3 transition-colors"
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(quarter)}
                  style={{
                    backgroundColor: draggedItem ? "hsl(var(--accent) / 0.1)" : undefined,
                  }}
                >
                  {/* Products */}
                  {getProductsForQuarter(quarter).map(product => (
                    <div
                      key={product.id}
                      draggable
                      onDragStart={() => handleDragStart("product", product.id)}
                      className={`p-3 rounded-lg border-2 cursor-move transition-all hover:shadow-md ${stageColors[product.stage] || stageColors.discovery}`}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="h-4 w-4 mt-0.5 opacity-50" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            <span className="font-medium text-sm truncate">{product.name}</span>
                          </div>
                          <Badge variant="outline" className="mt-1 text-xs capitalize">
                            {product.stage}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Features */}
                  {getFeaturesForQuarter(quarter).map(feature => (
                    <div
                      key={feature.id}
                      draggable
                      onDragStart={() => handleDragStart("feature", feature.id)}
                      className="p-3 rounded-lg bg-card border cursor-move transition-all hover:shadow-md"
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="h-4 w-4 mt-0.5 opacity-50" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{feature.name}</p>
                          <div className="flex gap-1 mt-1">
                            <Badge className={`text-xs ${priorityColors[feature.priority]}`}>
                              {feature.priority}
                            </Badge>
                            {feature.moscow && (
                              <Badge variant="outline" className="text-xs">
                                {feature.moscow}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {getProductsForQuarter(quarter).length === 0 && getFeaturesForQuarter(quarter).length === 0 && (
                    <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
                      Drop items here
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Unscheduled Items */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="metric-card">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Package className="h-5 w-5" />
              Unscheduled Products
            </h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {unscheduledProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">All products are scheduled</p>
              ) : (
                unscheduledProducts.map(product => (
                  <div
                    key={product.id}
                    draggable
                    onDragStart={() => handleDragStart("product", product.id)}
                    className={`p-3 rounded-lg border-2 cursor-move hover:shadow-md ${stageColors[product.stage] || stageColors.discovery}`}
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 opacity-50" />
                      <Package className="h-4 w-4" />
                      <span className="font-medium text-sm">{product.name}</span>
                      <Badge variant="outline" className="ml-auto text-xs capitalize">
                        {product.stage}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="metric-card">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Unscheduled Features
            </h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {unscheduledFeatures.length === 0 ? (
                <p className="text-sm text-muted-foreground">All features are scheduled</p>
              ) : (
                unscheduledFeatures.map(feature => (
                  <div
                    key={feature.id}
                    draggable
                    onDragStart={() => handleDragStart("feature", feature.id)}
                    className="p-3 rounded-lg bg-card border cursor-move hover:shadow-md"
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 opacity-50" />
                      <span className="font-medium text-sm flex-1 truncate">{feature.name}</span>
                      <Badge className={`text-xs ${priorityColors[feature.priority]}`}>
                        {feature.priority}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
