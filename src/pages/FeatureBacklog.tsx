import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Plus,
  GripVertical,
  Filter,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";
import { FeatureDetailDialog } from "@/components/dialogs/FeatureDetailDialog";

interface Feature {
  id: string;
  name: string;
  reference_number: string | null;
  description: string | null;
  status: string;
  priority: string;
  moscow: string | null;
  product_id: string;
  target_release: string | null;
  reach_score: number | null;
  impact_score: number | null;
  confidence_score: number | null;
  effort_score: number | null;
  story_points?: number | null;
  sprint_id?: string | null;
}

interface Product {
  id: string;
  name: string;
}

const statusColumns = [
  { id: "backlog", label: "Backlog", color: "bg-muted" },
  { id: "planned", label: "Planned", color: "bg-info/10" },
  { id: "in_progress", label: "In Progress", color: "bg-warning/10" },
  { id: "review", label: "Review", color: "bg-primary/10" },
  { id: "done", label: "Done", color: "bg-success/10" },
];

const priorityConfig: Record<string, { label: string; color: string }> = {
  high: { label: "High", color: "bg-destructive/10 text-destructive border-destructive/30" },
  medium: { label: "Medium", color: "bg-warning/10 text-warning border-warning/30" },
  low: { label: "Low", color: "bg-muted text-muted-foreground border-border" },
};

const moscowConfig: Record<string, { label: string; color: string }> = {
  must: { label: "Must Have", color: "bg-success/10 text-success" },
  should: { label: "Should Have", color: "bg-primary/10 text-primary" },
  could: { label: "Could Have", color: "bg-warning/10 text-warning" },
  wont: { label: "Won't Have", color: "bg-muted text-muted-foreground" },
};

export default function FeatureBacklog() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [draggedFeature, setDraggedFeature] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();

  const [newFeature, setNewFeature] = useState({
    name: "",
    description: "",
    product_id: "",
    priority: "medium",
    moscow: "",
    target_release: "",
  });

  const fetchData = async () => {
    setLoading(true);
    
    const [featuresRes, productsRes] = await Promise.all([
      supabase.from("product_features").select("*").order("priority"),
      supabase.from("products").select("id, name").order("name"),
    ]);

    if (featuresRes.error) console.error("Features error:", featuresRes.error);
    if (productsRes.error) console.error("Products error:", productsRes.error);

    setFeatures(featuresRes.data || []);
    setProducts(productsRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDragStart = (featureId: string) => {
    setDraggedFeature(featureId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (newStatus: string) => {
    if (!draggedFeature) return;

    try {
      await supabase
        .from("product_features")
        .update({ status: newStatus })
        .eq("id", draggedFeature);
      
      setFeatures(prev =>
        prev.map(f =>
          f.id === draggedFeature ? { ...f, status: newStatus } : f
        )
      );
      toast.success("Feature status updated");
    } catch (error) {
      toast.error("Failed to update status");
    }

    setDraggedFeature(null);
  };

  const handleCreateFeature = async () => {
    if (!newFeature.name || !newFeature.product_id) {
      toast.error("Please fill in required fields");
      return;
    }

    const { error } = await supabase.from("product_features").insert({
      name: newFeature.name,
      description: newFeature.description || null,
      product_id: newFeature.product_id,
      priority: newFeature.priority,
      moscow: newFeature.moscow || null,
      target_release: newFeature.target_release || null,
      status: "backlog",
      created_by: user?.id,
      organization_id: currentOrganization?.id ?? null,
    });

    if (error) {
      toast.error("Failed to create feature");
      console.error(error);
    } else {
      toast.success("Feature created successfully");
      setIsCreateOpen(false);
      setNewFeature({
        name: "",
        description: "",
        product_id: "",
        priority: "medium",
        moscow: "",
        target_release: "",
      });
      fetchData();
    }
  };

  const filteredFeatures = features.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProduct = productFilter === "all" || f.product_id === productFilter;
    return matchesSearch && matchesProduct;
  });

  const getFeaturesForStatus = (status: string) => {
    return filteredFeatures.filter(f => f.status === status);
  };

  const getProductName = (productId: string) => {
    return products.find(p => p.id === productId)?.name || "Unknown";
  };

  const calculateRICEScore = (feature: Feature) => {
    const { reach_score, impact_score, confidence_score, effort_score } = feature;
    if (!reach_score || !impact_score || !confidence_score || !effort_score) return null;
    return Math.round((reach_score * impact_score * confidence_score) / effort_score);
  };

  return (
    <AppLayout title="Feature Backlog" subtitle="Kanban board for tracking feature status">
      <div className="space-y-6">
        {/* Header Controls */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex gap-4 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search features..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by product" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                {products.map(product => (
                  <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Feature
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Feature</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Feature Name *</Label>
                  <Input
                    value={newFeature.name}
                    onChange={(e) => setNewFeature({ ...newFeature, name: e.target.value })}
                    placeholder="Enter feature name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={newFeature.description}
                    onChange={(e) => setNewFeature({ ...newFeature, description: e.target.value })}
                    placeholder="Describe the feature"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Product *</Label>
                  <Select
                    value={newFeature.product_id}
                    onValueChange={(v) => setNewFeature({ ...newFeature, product_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map(product => (
                        <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select
                      value={newFeature.priority}
                      onValueChange={(v) => setNewFeature({ ...newFeature, priority: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>MoSCoW</Label>
                    <Select
                      value={newFeature.moscow}
                      onValueChange={(v) => setNewFeature({ ...newFeature, moscow: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="must">Must Have</SelectItem>
                        <SelectItem value="should">Should Have</SelectItem>
                        <SelectItem value="could">Could Have</SelectItem>
                        <SelectItem value="wont">Won't Have</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Target Release</Label>
                  <Select
                    value={newFeature.target_release}
                    onValueChange={(v) => setNewFeature({ ...newFeature, target_release: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select quarter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Q1">Q1</SelectItem>
                      <SelectItem value="Q2">Q2</SelectItem>
                      <SelectItem value="Q3">Q3</SelectItem>
                      <SelectItem value="Q4">Q4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreateFeature} className="w-full">
                  Create Feature
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Kanban Board */}
        <div className="flex gap-4 overflow-x-auto pb-4">
          {statusColumns.map(column => (
            <div
              key={column.id}
              className="flex-shrink-0 w-[300px]"
            >
              <div className={`rounded-t-lg p-3 ${column.color}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{column.label}</h3>
                  <Badge variant="secondary">{getFeaturesForStatus(column.id).length}</Badge>
                </div>
              </div>
              <div
                className="bg-secondary/30 rounded-b-lg p-3 min-h-[500px] space-y-3"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(column.id)}
                style={{
                  backgroundColor: draggedFeature ? "hsl(var(--accent) / 0.2)" : undefined,
                }}
              >
                {loading ? (
                  <div className="text-center text-muted-foreground py-8">Loading...</div>
                ) : (
                  getFeaturesForStatus(column.id).map(feature => {
                    const priorityConf = priorityConfig[feature.priority] || priorityConfig.medium;
                    const moscowConf = feature.moscow ? moscowConfig[feature.moscow] : null;
                    const riceScore = calculateRICEScore(feature);

                    return (
                      <div
                        key={feature.id}
                        draggable
                        onDragStart={() => handleDragStart(feature.id)}
                        onClick={() => {
                          setSelectedFeature(feature);
                          setFeatureDialogOpen(true);
                        }}
                        className={`p-3 rounded-lg bg-card border-2 cursor-move transition-all hover:shadow-md ${priorityConf.color}`}
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical className="h-4 w-4 mt-0.5 opacity-50 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            {feature.reference_number && (
                              <p className="font-mono text-[10px] text-muted-foreground mb-0.5">
                                {feature.reference_number}
                              </p>
                            )}
                            <p className="font-medium text-sm">{feature.name}</p>
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {getProductName(feature.product_id)}
                            </p>
                            {feature.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {feature.description}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-1 mt-2">
                              <Badge variant="outline" className="text-xs capitalize">
                                {feature.priority}
                              </Badge>
                              {moscowConf && (
                                <Badge className={`text-xs ${moscowConf.color}`}>
                                  {moscowConf.label}
                                </Badge>
                              )}
                              {feature.target_release && (
                                <Badge variant="secondary" className="text-xs">
                                  {feature.target_release}
                                </Badge>
                              )}
                              {riceScore !== null && (
                                <Badge variant="secondary" className="text-xs">
                                  RICE: {riceScore}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                {!loading && getFeaturesForStatus(column.id).length === 0 && (
                  <div className="text-center text-muted-foreground py-8 text-sm">
                    Drop features here
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <FeatureDetailDialog
        feature={selectedFeature}
        open={featureDialogOpen}
        onOpenChange={setFeatureDialogOpen}
        onUpdate={fetchData}
        products={products}
      />
    </AppLayout>
  );
}
