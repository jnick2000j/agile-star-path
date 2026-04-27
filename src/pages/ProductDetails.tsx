import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { QuickActionTabs } from "@/components/QuickActionTabs";
import { AISummaryPanel } from "@/components/ai/AISummaryPanel";
import {
  ArrowLeft,
  Package,
  Calendar,
  Target,
  TrendingUp,
  Lightbulb,
  BarChart3,
  History,
  CheckCircle2,
  Clock,
  RefreshCw,
  XCircle,
  Archive,
  AlertTriangle,
  Rocket,
  FlaskConical,
  Layers,
  Sunset,
  Link2,
  ArrowRight,
  MessageSquarePlus,
  Users,
  LifeBuoy,
  Workflow,
  GitPullRequest,
  ListTodo,
} from "lucide-react";
import { AutomationsTab } from "@/components/automations/AutomationsTab";
import { EntityTicketsCard } from "@/components/helpdesk/EntityTicketsCard";
import { EntityChangesCard } from "@/components/changeMgmt/EntityChangesCard";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { EntityStatusActions } from "@/components/EntityStatusActions";
import { EntityUpdates } from "@/components/EntityUpdates";
import { EntityAssignments } from "@/components/EntityAssignments";
import { UpdateFrequencySettings } from "@/components/UpdateFrequencySettings";
import { DocumentUpload } from "@/components/DocumentUpload";
import { EntitySprintsTab } from "@/components/EntitySprintsTab";
import { format } from "date-fns";
import { useTrackRecent } from "@/hooks/useRecents";

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

interface Feature {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  moscow: string | null;
  story_points: number | null;
  reach_score: number | null;
  impact_score: number | null;
  confidence_score: number | null;
  effort_score: number | null;
  target_release: string | null;
}

interface Dependency {
  id: string;
  feature_id: string;
  depends_on_id: string;
  dependency_type: string;
  description: string | null;
}

interface ProductTask {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  feature_id: string | null;
  planned_start: string | null;
  planned_end: string | null;
  story_points: number | null;
  completion_percentage: number | null;
}

interface StatusHistoryEntry {
  id: string;
  old_status: string | null;
  new_status: string;
  action: string;
  reason: string | null;
  changed_by: string | null;
  changed_at: string;
  changer_name?: string;
}

const stageConfig: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  ideation: { label: "Ideation", className: "bg-purple-500/10 text-purple-600", icon: Lightbulb },
  discovery: { label: "Discovery", className: "bg-info/10 text-info", icon: FlaskConical },
  development: { label: "Development", className: "bg-warning/10 text-warning", icon: Layers },
  launch: { label: "Launch", className: "bg-success/10 text-success", icon: Rocket },
  growth: { label: "Growth", className: "bg-primary/10 text-primary", icon: TrendingUp },
  maturity: { label: "Maturity", className: "bg-muted text-muted-foreground", icon: Package },
  sunset: { label: "Sunset", className: "bg-orange-500/10 text-orange-600", icon: Sunset },
};

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-success/10 text-success" },
  "on-hold": { label: "On Hold", className: "bg-warning/10 text-warning" },
  pending: { label: "Pending", className: "bg-info/10 text-info" },
  rejected: { label: "Rejected", className: "bg-destructive/10 text-destructive" },
  closed: { label: "Closed", className: "bg-muted text-muted-foreground" },
};

const featureStatusConfig: Record<string, { label: string; className: string }> = {
  backlog: { label: "Backlog", className: "bg-muted text-muted-foreground" },
  planned: { label: "Planned", className: "bg-info/10 text-info" },
  in_progress: { label: "In Progress", className: "bg-warning/10 text-warning" },
  review: { label: "Review", className: "bg-purple-500/10 text-purple-600" },
  done: { label: "Done", className: "bg-success/10 text-success" },
};

const moscowConfig: Record<string, { label: string; className: string }> = {
  must: { label: "Must Have", className: "bg-destructive/10 text-destructive" },
  should: { label: "Should Have", className: "bg-warning/10 text-warning" },
  could: { label: "Could Have", className: "bg-info/10 text-info" },
  wont: { label: "Won't Have", className: "bg-muted text-muted-foreground" },
};

const actionIcons: Record<string, React.ElementType> = {
  created: CheckCircle2,
  approved: CheckCircle2,
  rejected: XCircle,
  deferred: Clock,
  reopened: RefreshCw,
  closed: Archive,
  on_hold: Clock,
};

const actionLabels: Record<string, string> = {
  created: "Created",
  approved: "Approved",
  rejected: "Rejected",
  deferred: "Deferred",
  reopened: "Reopened",
  closed: "Closed",
  on_hold: "Put On Hold",
};

export default function ProductDetails() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const productId = searchParams.get("id");

  const [product, setProduct] = useState<Product | null>(null);

  useTrackRecent({
    entityType: "product",
    entityId: product?.id,
    label: product?.name,
    href: product ? `/products/details?id=${product.id}` : undefined,
    enabled: !!product,
  });
  const [features, setFeatures] = useState<Feature[]>([]);
  const [tasks, setTasks] = useState<ProductTask[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("features");

  const fetchProduct = async () => {
    if (!productId) return;

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (!error && data) {
      setProduct(data);
    }
  };

  const fetchFeatures = async () => {
    if (!productId) return;

    const { data } = await supabase
      .from("product_features")
      .select("*")
      .eq("product_id", productId)
      .order("priority", { ascending: true });

    setFeatures(data || []);
  };

  const fetchTasks = async () => {
    if (!productId) return;

    // Tasks linked directly to product OR to any feature of this product
    const { data: featRows } = await supabase
      .from("product_features")
      .select("id")
      .eq("product_id", productId);
    const featureIdList = (featRows || []).map((f) => f.id);

    const orParts = [`product_id.eq.${productId}`];
    if (featureIdList.length > 0) {
      orParts.push(`feature_id.in.(${featureIdList.join(",")})`);
    }

    const { data } = await supabase
      .from("tasks")
      .select(
        "id, name, description, status, priority, feature_id, planned_start, planned_end, story_points, completion_percentage",
      )
      .or(orParts.join(","))
      .order("created_at", { ascending: false });

    setTasks((data || []) as ProductTask[]);
  };

  const fetchDependencies = async () => {
    if (!productId) return;
    
    // Get feature IDs for this product first
    const { data: featureIds } = await supabase
      .from("product_features")
      .select("id")
      .eq("product_id", productId);
    
    if (!featureIds || featureIds.length === 0) {
      setDependencies([]);
      return;
    }

    const ids = featureIds.map(f => f.id);
    const { data } = await supabase
      .from("feature_dependencies")
      .select("*")
      .or(`feature_id.in.(${ids.join(",")}),depends_on_id.in.(${ids.join(",")})`);

    setDependencies(data || []);
  };

  const fetchStatusHistory = async () => {
    if (!productId) return;

    const { data } = await supabase
      .from("status_history")
      .select("*")
      .eq("entity_type", "product")
      .eq("entity_id", productId)
      .order("changed_at", { ascending: false });

    if (data) {
      const userIds = [...new Set(data.map((h) => h.changed_by).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, first_name, last_name")
          .in("id", userIds);

        const profileMap = new Map(
          profiles?.map((p) => [
            p.id,
            p.full_name || `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Unknown",
          ])
        );

        setStatusHistory(
          data.map((h) => ({
            ...h,
            changer_name: h.changed_by ? profileMap.get(h.changed_by) || "Unknown" : "System",
          }))
        );
      } else {
        setStatusHistory(data);
      }
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([fetchProduct(), fetchFeatures(), fetchTasks(), fetchDependencies(), fetchStatusHistory()]);
    setLoading(false);
  };

  useEffect(() => {
    if (productId) {
      fetchAllData();
    }
  }, [productId]);

  const calculateRICE = (item: { reach_score: number | null; impact_score: number | null; confidence_score: number | null; effort_score: number | null }) => {
    if (!item.reach_score || !item.impact_score || !item.confidence_score || !item.effort_score) {
      return null;
    }
    return Math.round((item.reach_score * item.impact_score * item.confidence_score) / item.effort_score);
  };

  if (!productId) {
    return (
      <AppLayout title="Product Details" subtitle="View product information">
        <div className="flex flex-col items-center justify-center py-12">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No product selected</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/products")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Products
          </Button>
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout title="Product Details" subtitle="Loading...">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  if (!product) {
    return (
      <AppLayout title="Product Details" subtitle="Product not found">
        <div className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-muted-foreground">Product not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/products")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Products
          </Button>
        </div>
      </AppLayout>
    );
  }

  const stage = stageConfig[product.stage] || stageConfig.ideation;
  const status = statusConfig[product.status] || statusConfig.pending;
  const StageIcon = stage.icon;
  const productRICE = calculateRICE(product);
  const completedFeatures = features.filter((f) => f.status === "done").length;
  const inProgressFeatures = features.filter((f) => f.status === "in_progress" || f.status === "review").length;

  // Group features by MoSCoW
  const featuresByMoscow = {
    must: features.filter((f) => f.moscow === "must"),
    should: features.filter((f) => f.moscow === "should"),
    could: features.filter((f) => f.moscow === "could"),
    wont: features.filter((f) => f.moscow === "wont"),
    unclassified: features.filter((f) => !f.moscow),
  };

  return (
    <AppLayout title={product.name} subtitle="Product Details">
      <div className="space-y-6">
        {/* Header with actions */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/products")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Products
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/timesheets?productId=${product.id}`)}
            >
              <Clock className="h-4 w-4 mr-2" />
              Log Time
            </Button>
            <DocumentUpload
              entityType="product"
              entityId={product.id}
              entityName={product.name}
            />
            <EntityStatusActions
              entityType="product"
              entityId={product.id}
              entityName={product.name}
              currentStatus={product.status}
              onStatusChange={fetchAllData}
            />
          </div>
        </div>

        {/* Product Overview Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className={cn("p-3 rounded-lg", stage.className)}>
                  <StageIcon className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-2xl">{product.name}</CardTitle>
                  <CardDescription className="mt-2">{product.description}</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn("text-sm", stage.className)}>
                  {stage.label}
                </Badge>
                <Badge className={cn("text-sm", status.className)}>
                  {status.label}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Target className="h-4 w-4" />
                  Primary Metric
                </div>
                <p className="font-medium">{product.primary_metric || "Not defined"}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  Revenue Target
                </div>
                <p className="font-medium">{product.revenue_target || "Not set"}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Launch Date
                </div>
                <p className="font-medium">
                  {product.launch_date ? format(new Date(product.launch_date), "MMM d, yyyy") : "Not set"}
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <BarChart3 className="h-4 w-4" />
                  RICE Score
                </div>
                <p className="font-medium text-xl">{productRICE ?? "N/A"}</p>
              </div>
            </div>

            {/* Vision & Value Proposition */}
            {(product.vision || product.value_proposition) && (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {product.vision && (
                  <div className="p-4 rounded-lg bg-muted/50">
                    <h4 className="font-medium mb-2">Vision</h4>
                    <p className="text-sm text-muted-foreground">{product.vision}</p>
                  </div>
                )}
                {product.value_proposition && (
                  <div className="p-4 rounded-lg bg-muted/50">
                    <h4 className="font-medium mb-2">Value Proposition</h4>
                    <p className="text-sm text-muted-foreground">{product.value_proposition}</p>
                  </div>
                )}
              </div>
            )}

            {/* RICE Breakdown */}
            {(product.reach_score || product.impact_score || product.confidence_score || product.effort_score) && (
              <div className="mt-6 grid gap-4 md:grid-cols-4">
                <div className="p-3 rounded-lg bg-primary/5 text-center">
                  <p className="text-xs text-muted-foreground">Reach</p>
                  <p className="text-2xl font-bold">{product.reach_score ?? "-"}</p>
                </div>
                <div className="p-3 rounded-lg bg-success/5 text-center">
                  <p className="text-xs text-muted-foreground">Impact</p>
                  <p className="text-2xl font-bold">{product.impact_score ?? "-"}</p>
                </div>
                <div className="p-3 rounded-lg bg-warning/5 text-center">
                  <p className="text-xs text-muted-foreground">Confidence</p>
                  <p className="text-2xl font-bold">{product.confidence_score ?? "-"}</p>
                </div>
                <div className="p-3 rounded-lg bg-destructive/5 text-center">
                  <p className="text-xs text-muted-foreground">Effort</p>
                  <p className="text-2xl font-bold">{product.effort_score ?? "-"}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <AISummaryPanel
          scopeType="product"
          scopeId={product.id}
          summaryKind="entity_overview"
          title="AI Product Overview"
        />

        {/* Tabs for different sections */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <QuickActionTabs
            items={[
              { value: "features", label: "Features", icon: Lightbulb, count: features.length },
              { value: "tasks", label: "Tasks", icon: ListTodo, count: tasks.length },
              { value: "roadmap", label: "Roadmap", icon: Calendar },
              { value: "metrics", label: "Metrics", icon: BarChart3 },
              { value: "dependencies", label: "Dependencies", icon: Link2, count: dependencies.length },
              { value: "sprints", label: "Sprints", icon: Calendar },
              { value: "team", label: "Team", icon: Users },
              { value: "updates", label: "Updates", icon: MessageSquarePlus },
              { value: "tickets", label: "Tickets", icon: LifeBuoy },
              { value: "changes", label: "Changes", icon: GitPullRequest },
              { value: "automations", label: "Automations", icon: Workflow },
              { value: "history", label: "Status Timeline", icon: History },
            ]}
          />

          {/* Features Tab */}
          <TabsContent value="features">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Product Features</CardTitle>
                    <CardDescription>
                      {completedFeatures} completed, {inProgressFeatures} in progress
                    </CardDescription>
                  </div>
                  <Button variant="outline" onClick={() => navigate("/products/features")}>
                    <Lightbulb className="h-4 w-4 mr-2" />
                    Manage Features
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {features.length === 0 ? (
                  <div className="text-center py-8">
                    <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No features defined for this product</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(featuresByMoscow).map(([key, items]) => {
                      if (items.length === 0) return null;
                      const moscowLabel = key === "unclassified" ? "Unclassified" : moscowConfig[key]?.label || key;
                      const moscowClass = key === "unclassified" ? "bg-muted text-muted-foreground" : moscowConfig[key]?.className;

                      return (
                        <div key={key}>
                          <div className="flex items-center gap-2 mb-3">
                            <Badge className={cn("text-xs", moscowClass)}>{moscowLabel}</Badge>
                            <span className="text-sm text-muted-foreground">({items.length} features)</span>
                          </div>
                          <div className="space-y-3">
                            {items.map((feature) => {
                              const featureStatus = featureStatusConfig[feature.status] || featureStatusConfig.backlog;
                              const featureRICE = calculateRICE(feature);

                              return (
                                <div key={feature.id} className="p-4 rounded-lg border bg-card">
                                  <div className="flex items-start justify-between mb-2">
                                    <h4 className="font-medium">{feature.name}</h4>
                                    <div className="flex items-center gap-2">
                                      {featureRICE && (
                                        <Badge variant="outline" className="text-xs">
                                          RICE: {featureRICE}
                                        </Badge>
                                      )}
                                      <Badge className={cn("text-xs", featureStatus.className)}>
                                        {featureStatus.label}
                                      </Badge>
                                    </div>
                                  </div>
                                  <p className="text-sm text-muted-foreground mb-3">
                                    {feature.description || "No description"}
                                  </p>
                                  <div className="flex items-center gap-4 text-sm flex-wrap">
                                    <div>
                                      <span className="text-muted-foreground">Priority: </span>
                                      <span className="capitalize">{feature.priority}</span>
                                    </div>
                                    {feature.story_points && (
                                      <div>
                                        <span className="text-muted-foreground">Points: </span>
                                        <span>{feature.story_points}</span>
                                      </div>
                                    )}
                                    {feature.target_release && (
                                      <div>
                                        <span className="text-muted-foreground">Release: </span>
                                        <span>{feature.target_release}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tasks Tab — grouped by Feature (workstreams) */}
          <TabsContent value="tasks">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Linked Tasks</CardTitle>
                    <CardDescription>
                      Tasks linked to this product or any of its features. Group by feature to see parallel workstreams.
                    </CardDescription>
                  </div>
                  <Button variant="outline" onClick={() => navigate("/tasks")}>
                    <ListTodo className="h-4 w-4 mr-2" />
                    Manage Tasks
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {tasks.length === 0 ? (
                  <div className="text-center py-8">
                    <ListTodo className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No tasks linked to this product yet</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {(() => {
                      const taskStatusMap: Record<string, { label: string; className: string }> = {
                        not_started: { label: "Not Started", className: "bg-muted text-muted-foreground" },
                        in_progress: { label: "In Progress", className: "bg-warning/10 text-warning" },
                        completed: { label: "Completed", className: "bg-success/10 text-success" },
                        on_hold: { label: "On Hold", className: "bg-info/10 text-info" },
                        cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive" },
                      };

                      // Build groups: one per feature (in feature priority order), plus an
                      // "Unassigned" group for tasks linked only at product level.
                      const groups: Array<{ key: string; title: string; subtitle?: string; items: ProductTask[] }> = [];
                      features.forEach((f) => {
                        const items = tasks.filter((t) => t.feature_id === f.id);
                        if (items.length > 0) {
                          groups.push({
                            key: `feat-${f.id}`,
                            title: f.name,
                            subtitle: featureStatusConfig[f.status]?.label ?? f.status,
                            items,
                          });
                        }
                      });
                      const unassigned = tasks.filter((t) => !t.feature_id);
                      if (unassigned.length > 0) {
                        groups.push({
                          key: "no-feature",
                          title: "No Feature (Product-level)",
                          subtitle: "Tasks linked directly to the product",
                          items: unassigned,
                        });
                      }

                      return groups.map((group) => (
                        <div key={group.key} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Lightbulb className="h-4 w-4 text-primary" />
                            <h4 className="font-semibold">{group.title}</h4>
                            {group.subtitle && (
                              <Badge variant="outline" className="text-xs">{group.subtitle}</Badge>
                            )}
                            <span className="text-xs text-muted-foreground ml-auto">
                              {group.items.length} task{group.items.length === 1 ? "" : "s"}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {group.items.map((task) => {
                              const taskStatus = taskStatusMap[task.status] ?? { label: task.status, className: "bg-muted text-muted-foreground" };
                              return (
                                <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                                  <div className="space-y-1 min-w-0">
                                    <p className="font-medium truncate">{task.name}</p>
                                    {task.description && (
                                      <p className="text-sm text-muted-foreground line-clamp-1">{task.description}</p>
                                    )}
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {task.planned_start && task.planned_end && (
                                        <span className="text-xs text-muted-foreground">
                                          {format(new Date(task.planned_start), "MMM d")} – {format(new Date(task.planned_end), "MMM d, yyyy")}
                                        </span>
                                      )}
                                      {task.story_points != null && (
                                        <Badge variant="outline" className="text-xs">{task.story_points} pts</Badge>
                                      )}
                                      {task.completion_percentage != null && task.completion_percentage > 0 && (
                                        <Badge variant="outline" className="text-xs">{task.completion_percentage}%</Badge>
                                      )}
                                    </div>
                                  </div>
                                  <Badge variant="secondary" className={cn("text-xs shrink-0", taskStatus.className)}>
                                    {taskStatus.label}
                                  </Badge>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Roadmap Tab */}
          <TabsContent value="roadmap">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Product Roadmap</CardTitle>
                    <CardDescription>Features organized by release timeline</CardDescription>
                  </div>
                  <Button variant="outline" onClick={() => navigate("/products/roadmap")}>
                    <Calendar className="h-4 w-4 mr-2" />
                    View Full Roadmap
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {features.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No features to display on roadmap</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Group by target release */}
                    {(() => {
                      const releases = [...new Set(features.map((f) => f.target_release).filter(Boolean))].sort();
                      const noRelease = features.filter((f) => !f.target_release);

                      return (
                        <>
                          {releases.map((release) => {
                            const releaseFeatures = features.filter((f) => f.target_release === release);
                            const completed = releaseFeatures.filter((f) => f.status === "done").length;
                            const progress = Math.round((completed / releaseFeatures.length) * 100);

                            return (
                              <div key={release} className="p-4 rounded-lg border bg-card">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="font-medium">{release}</h4>
                                  <Badge variant="outline">{releaseFeatures.length} features</Badge>
                                </div>
                                <div className="space-y-2 mb-3">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Progress</span>
                                    <span>{progress}%</span>
                                  </div>
                                  <Progress value={progress} className="h-2" />
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {releaseFeatures.slice(0, 5).map((f) => (
                                    <Badge key={f.id} variant="secondary" className="text-xs">
                                      {f.name}
                                    </Badge>
                                  ))}
                                  {releaseFeatures.length > 5 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{releaseFeatures.length - 5} more
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {noRelease.length > 0 && (
                            <div className="p-4 rounded-lg border bg-muted/50">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-medium text-muted-foreground">Unscheduled</h4>
                                <Badge variant="outline">{noRelease.length} features</Badge>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {noRelease.slice(0, 5).map((f) => (
                                  <Badge key={f.id} variant="secondary" className="text-xs">
                                    {f.name}
                                  </Badge>
                                ))}
                                {noRelease.length > 5 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{noRelease.length - 5} more
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Metrics Tab */}
          <TabsContent value="metrics">
            <Card>
              <CardHeader>
                <CardTitle>Feature Metrics</CardTitle>
                <CardDescription>RICE scores and prioritization data</CardDescription>
              </CardHeader>
              <CardContent>
                {features.length === 0 ? (
                  <div className="text-center py-8">
                    <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No features to analyze</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Top RICE scored features */}
                    <div>
                      <h4 className="font-medium mb-3">Top Features by RICE Score</h4>
                      <div className="space-y-3">
                        {features
                          .map((f) => ({ ...f, rice: calculateRICE(f) }))
                          .filter((f) => f.rice !== null)
                          .sort((a, b) => (b.rice || 0) - (a.rice || 0))
                          .slice(0, 5)
                          .map((feature, index) => (
                            <div key={feature.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                              <span className="text-lg font-bold text-muted-foreground w-6">#{index + 1}</span>
                              <div className="flex-1">
                                <p className="font-medium">{feature.name}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                  <span>R: {feature.reach_score}</span>
                                  <span>•</span>
                                  <span>I: {feature.impact_score}</span>
                                  <span>•</span>
                                  <span>C: {feature.confidence_score}</span>
                                  <span>•</span>
                                  <span>E: {feature.effort_score}</span>
                                </div>
                              </div>
                              <Badge className="bg-primary/10 text-primary text-lg px-3">
                                {feature.rice}
                              </Badge>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* MoSCoW breakdown */}
                    <div>
                      <h4 className="font-medium mb-3">MoSCoW Breakdown</h4>
                      <div className="grid gap-4 md:grid-cols-4">
                        {Object.entries(featuresByMoscow).map(([key, items]) => {
                          if (key === "unclassified") return null;
                          const config = moscowConfig[key];
                          return (
                            <div key={key} className={cn("p-4 rounded-lg text-center", config?.className)}>
                              <p className="text-2xl font-bold">{items.length}</p>
                              <p className="text-sm">{config?.label}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tickets Tab */}
          <TabsContent value="tickets">
            {product && <EntityTicketsCard scope="product" entityId={product.id} entityName={product.name} />}
          </TabsContent>

          {/* Changes Tab */}
          <TabsContent value="changes">
            {product && <EntityChangesCard scope="product" entityId={product.id} entityName={product.name} />}
          </TabsContent>

          {/* Status Timeline Tab */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Status Timeline</CardTitle>
                <CardDescription>History of status changes for this product</CardDescription>
              </CardHeader>
              <CardContent>
                {statusHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No status changes recorded</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="relative pl-6 space-y-6">
                      <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border" />

                      {statusHistory.map((entry) => {
                        const Icon = actionIcons[entry.action] || CheckCircle2;
                        const actionLabel = actionLabels[entry.action] || entry.action;

                        return (
                          <div key={entry.id} className="relative">
                            <div className="absolute -left-4 top-1 w-4 h-4 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                              <Icon className="h-2.5 w-2.5 text-primary" />
                            </div>

                            <div className="bg-muted/50 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{actionLabel}</span>
                                  {entry.old_status && (
                                    <>
                                      <Badge variant="outline" className="text-xs">
                                        {entry.old_status}
                                      </Badge>
                                      <span className="text-muted-foreground">→</span>
                                    </>
                                  )}
                                  <Badge variant="secondary" className="text-xs">
                                    {entry.new_status}
                                  </Badge>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(entry.changed_at), "MMM d, yyyy 'at' h:mm a")}
                                </span>
                              </div>

                              <div className="text-sm text-muted-foreground">
                                By {entry.changer_name || "Unknown"}
                              </div>

                              {entry.reason && (
                                <div className="mt-2 p-2 bg-background rounded text-sm">
                                  <span className="text-muted-foreground">Reason: </span>
                                  {entry.reason}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Dependencies Tab */}
          <TabsContent value="dependencies">
            <Card>
              <CardHeader>
                <CardTitle>Feature Dependencies</CardTitle>
                <CardDescription>
                  Dependency relationships between features in this product
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dependencies.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Link2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">No dependencies yet</p>
                    <p className="text-sm">
                      Feature dependencies can be managed from the feature backlog
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dependencies.map((dep) => {
                      const feature = features.find(f => f.id === dep.feature_id);
                      const dependsOn = features.find(f => f.id === dep.depends_on_id);
                      const typeConfig: Record<string, { label: string; className: string }> = {
                        blocks: { label: "Blocks", className: "bg-destructive/10 text-destructive" },
                        requires: { label: "Requires", className: "bg-warning/10 text-warning" },
                        related: { label: "Related", className: "bg-info/10 text-info" },
                      };
                      const config = typeConfig[dep.dependency_type] || typeConfig.related;
                      return (
                        <div key={dep.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {feature?.name || "Unknown feature"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge className={cn("text-xs", config.className)}>
                              {config.label}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {dependsOn?.name || "External feature"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team">
            {product && (
              <div className="grid gap-4 md:grid-cols-2">
                <EntityAssignments entityType="product" entityId={product.id} organizationId={product.organization_id} />
                <UpdateFrequencySettings entityType="product" entityId={product.id} organizationId={product.organization_id} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="updates">
            <Card>
              <CardHeader>
                <CardTitle>Progress Updates</CardTitle>
                <CardDescription>Timestamped updates for this product — these feed into reports</CardDescription>
              </CardHeader>
              <CardContent>
                {product && (
                  <EntityUpdates
                    entityType="product"
                    entityId={product.id}
                    organizationId={product.organization_id}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sprints">
            <EntitySprintsTab
              entityType="product"
              entityId={product.id}
              organizationId={product.organization_id}
            />
          </TabsContent>

          <TabsContent value="automations">
            <AutomationsTab module="product" entityId={product.id} entityType="product" />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
