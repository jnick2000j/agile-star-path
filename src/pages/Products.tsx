import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Search, 
  Package, 
  TrendingUp, 
  Target,
  BarChart3,
  Lightbulb,
  Rocket,
  ArrowUpRight,
  Filter,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { CreateProductDialog } from "@/components/dialogs/CreateProductDialog";
import { EntityStatusActions } from "@/components/EntityStatusActions";
import { DocumentUpload } from "@/components/DocumentUpload";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { useOrgAccessLevel } from "@/hooks/useOrgAccessLevel";

interface Product {
  id: string;
  name: string;
  description: string | null;
  stage: string;
  product_type: string;
  status: string;
  vision: string | null;
  value_proposition: string | null;
  target_market: string | null;
  primary_metric: string | null;
  launch_date: string | null;
  revenue_target: string | null;
  reach_score: number | null;
  impact_score: number | null;
  confidence_score: number | null;
  effort_score: number | null;
  organization_id: string | null;
  created_at: string;
}

const stageConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  discovery: { label: "Discovery", color: "bg-info/10 text-info", icon: Lightbulb },
  definition: { label: "Definition", color: "bg-primary/10 text-primary", icon: Target },
  development: { label: "Development", color: "bg-warning/10 text-warning", icon: Package },
  launch: { label: "Launch", color: "bg-success/10 text-success", icon: Rocket },
  growth: { label: "Growth", color: "bg-success/10 text-success", icon: TrendingUp },
  maturity: { label: "Maturity", color: "bg-muted text-muted-foreground", icon: BarChart3 },
  decline: { label: "Decline", color: "bg-destructive/10 text-destructive", icon: TrendingUp },
  retired: { label: "Retired", color: "bg-muted text-muted-foreground", icon: Package },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  concept: { label: "Concept", color: "bg-info/10 text-info" },
  in_development: { label: "In Development", color: "bg-warning/10 text-warning" },
  active: { label: "Active", color: "bg-success/10 text-success" },
  on_hold: { label: "On Hold", color: "bg-muted text-muted-foreground" },
  deprecated: { label: "Deprecated", color: "bg-destructive/10 text-destructive" },
  retired: { label: "Retired", color: "bg-muted text-muted-foreground" },
};

export default function Products() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const { currentOrganization } = useOrganization();
  const { user, userRole } = useAuth();
  const { hasFullOrgAccess } = useOrgAccessLevel();

  const fetchProducts = async () => {
    setLoading(true);
    let query = supabase.from("products").select("*").order("created_at", { ascending: false });
    
    if (currentOrganization) {
      query = query.eq("organization_id", currentOrganization.id);
    }

    // Product managers only see products assigned to them
    if (userRole === "product_manager" && user) {
      query = query.eq("product_owner_id", user.id);
    }
    // Product team members only see products they have access to
    else if (userRole === "product_team_member" && user) {
      const { data: accessData } = await supabase
        .from("user_product_access")
        .select("product_id")
        .eq("user_id", user.id);
      const productIds = accessData?.map(a => a.product_id) || [];
      if (productIds.length > 0) {
        query = query.in("id", productIds);
      } else {
        setProducts([]);
        setLoading(false);
        return;
      }
    }
    // Editors/viewers at org level only see assigned products
    else if (!hasFullOrgAccess && user) {
      const { data: accessData } = await supabase
        .from("user_product_access")
        .select("product_id")
        .eq("user_id", user.id);
      const productIds = accessData?.map(a => a.product_id) || [];
      // Also include products where user is the owner
      const { data: ownedData } = await supabase
        .from("products")
        .select("id")
        .eq("product_owner_id", user.id);
      const ownedIds = ownedData?.map(p => p.id) || [];
      const allIds = [...new Set([...productIds, ...ownedIds])];
      if (allIds.length > 0) {
        query = query.in("id", allIds);
      } else {
        setProducts([]);
        setLoading(false);
        return;
      }
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching products:", error);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, [currentOrganization, user, userRole, hasFullOrgAccess]);

  const calculateRICEScore = (product: Product) => {
    const { reach_score, impact_score, confidence_score, effort_score } = product;
    if (!reach_score || !impact_score || !confidence_score || !effort_score) return null;
    return Math.round((reach_score * impact_score * confidence_score) / effort_score);
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStage = stageFilter === "all" || p.stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  const stageCounts = {
    discovery: products.filter(p => p.stage === "discovery").length,
    definition: products.filter(p => p.stage === "definition").length,
    development: products.filter(p => p.stage === "development").length,
    launch: products.filter(p => p.stage === "launch").length,
    growth: products.filter(p => p.stage === "growth").length,
    maturity: products.filter(p => p.stage === "maturity").length,
  };

  return (
    <AppLayout title="Products" subtitle="Product portfolio and lifecycle management">
      <Tabs defaultValue="portfolio" className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <TabsList className="bg-secondary">
            <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
            <TabsTrigger value="lifecycle">Lifecycle View</TabsTrigger>
            <TabsTrigger value="metrics">Metrics & KPIs</TabsTrigger>
          </TabsList>
          <CreateProductDialog onSuccess={fetchProducts} />
        </div>

        {/* Lifecycle Stage Summary */}
        <div className="grid gap-4 md:grid-cols-6">
          {Object.entries(stageCounts).map(([stage, count]) => {
            const config = stageConfig[stage];
            const Icon = config.icon;
            return (
              <div key={stage} className="metric-card">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-2 rounded-lg ${config.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-2xl font-bold">{count}</span>
                </div>
                <p className="text-sm text-muted-foreground">{config.label}</p>
              </div>
            );
          })}
        </div>

        <TabsContent value="portfolio" className="space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {Object.entries(stageConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Products Table */}
          <div className="metric-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Target Market</TableHead>
                  <TableHead>Launch Date</TableHead>
                  <TableHead>RICE Score</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">Loading products...</TableCell>
                  </TableRow>
                ) : filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      No products found. Create your first product to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => {
                    const stageConf = stageConfig[product.stage] || stageConfig.discovery;
                    const statusConf = statusConfig[product.status] || statusConfig.concept;
                    const StageIcon = stageConf.icon;
                    const riceScore = calculateRICEScore(product);
                    return (
                      <TableRow key={product.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/products/details?id=${product.id}`)}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Package className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{product.name}</p>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {product.value_proposition || product.description || "No description"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={stageConf.color}>
                            <StageIcon className="h-3 w-3 mr-1" />
                            {stageConf.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusConf.color}>
                            {statusConf.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">{product.product_type}</TableCell>
                        <TableCell>{product.target_market || "-"}</TableCell>
                        <TableCell>
                          {product.launch_date ? new Date(product.launch_date).toLocaleDateString() : "-"}
                        </TableCell>
                        <TableCell>
                          {riceScore !== null ? (
                            <Badge variant="secondary">{riceScore}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <DocumentUpload
                              entityType="product"
                              entityId={product.id}
                              entityName={product.name}
                              variant="icon"
                            />
                            <EntityStatusActions
                              entityType="product"
                              entityId={product.id}
                              entityName={product.name}
                              currentStatus={product.status}
                              onStatusChange={fetchProducts}
                              compact
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="lifecycle" className="space-y-4">
          <div className="metric-card">
            <h3 className="font-semibold mb-4">Product Lifecycle Stages</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Based on Stage-Gate methodology. Products move through stages with gate reviews.
            </p>
            <div className="flex items-center gap-2 overflow-x-auto pb-4">
              {Object.entries(stageConfig).map(([stage, config], index) => {
                const Icon = config.icon;
                const count = products.filter(p => p.stage === stage).length;
                return (
                  <div key={stage} className="flex items-center">
                    <div className={`p-4 rounded-lg border-2 min-w-[120px] text-center ${count > 0 ? 'border-primary bg-primary/5' : 'border-border'}`}>
                      <Icon className={`h-6 w-6 mx-auto mb-2 ${count > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
                      <p className="text-sm font-medium">{config.label}</p>
                      <p className="text-2xl font-bold">{count}</p>
                    </div>
                    {index < Object.keys(stageConfig).length - 1 && (
                      <ArrowUpRight className="h-4 w-4 mx-2 text-muted-foreground" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Products by Stage */}
          <div className="grid gap-4 lg:grid-cols-2">
            {Object.entries(stageConfig).slice(0, 4).map(([stage, config]) => {
              const stageProducts = products.filter(p => p.stage === stage);
              const Icon = config.icon;
              return (
                <div key={stage} className="metric-card">
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`p-2 rounded-lg ${config.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <h4 className="font-medium">{config.label} Stage</h4>
                    <Badge variant="secondary">{stageProducts.length}</Badge>
                  </div>
                  {stageProducts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No products in this stage</p>
                  ) : (
                    <div className="space-y-2">
                      {stageProducts.slice(0, 3).map(product => (
                        <div key={product.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/50">
                          <span className="text-sm font-medium">{product.name}</span>
                          <Badge variant="outline" className="text-xs capitalize">{product.product_type}</Badge>
                        </div>
                      ))}
                      {stageProducts.length > 3 && (
                        <p className="text-xs text-muted-foreground">+{stageProducts.length - 3} more</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="metric-card">
              <h3 className="font-semibold mb-4">RICE Prioritization Framework</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Score products based on Reach, Impact, Confidence, and Effort.
              </p>
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-secondary/50">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Reach</span>
                    <span className="text-sm text-muted-foreground">How many users will this impact?</span>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Impact</span>
                    <span className="text-sm text-muted-foreground">How much will it move the needle?</span>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Confidence</span>
                    <span className="text-sm text-muted-foreground">How sure are we about estimates?</span>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Effort</span>
                    <span className="text-sm text-muted-foreground">How much work is required?</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="metric-card">
              <h3 className="font-semibold mb-4">MoSCoW Prioritization</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Categorize features by must-have, should-have, could-have, won't-have.
              </p>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border border-success/50 bg-success/5">
                  <span className="font-medium text-success">Must Have</span>
                  <span className="text-sm text-muted-foreground">Critical requirements</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-primary/50 bg-primary/5">
                  <span className="font-medium text-primary">Should Have</span>
                  <span className="text-sm text-muted-foreground">Important but not critical</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-warning/50 bg-warning/5">
                  <span className="font-medium text-warning">Could Have</span>
                  <span className="text-sm text-muted-foreground">Nice to have if time permits</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-muted bg-muted/5">
                  <span className="font-medium text-muted-foreground">Won't Have</span>
                  <span className="text-sm text-muted-foreground">Out of scope for now</span>
                </div>
              </div>
            </div>
          </div>

          <div className="metric-card">
            <h3 className="font-semibold mb-4">Product Health Dashboard</h3>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="text-center p-4 rounded-lg bg-success/10">
                <p className="text-3xl font-bold text-success">{products.filter(p => p.status === 'active').length}</p>
                <p className="text-sm text-muted-foreground">Active Products</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-warning/10">
                <p className="text-3xl font-bold text-warning">{products.filter(p => p.status === 'in_development').length}</p>
                <p className="text-sm text-muted-foreground">In Development</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-info/10">
                <p className="text-3xl font-bold text-info">{products.filter(p => p.status === 'concept').length}</p>
                <p className="text-sm text-muted-foreground">In Concept</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted">
                <p className="text-3xl font-bold text-muted-foreground">{products.filter(p => ['deprecated', 'retired'].includes(p.status)).length}</p>
                <p className="text-sm text-muted-foreground">Deprecated/Retired</p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
