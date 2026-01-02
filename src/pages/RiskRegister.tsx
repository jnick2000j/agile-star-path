import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Filter,
  AlertTriangle,
  Pencil,
  Download
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CreateRiskDialog } from "@/components/dialogs/CreateRiskDialog";
import { EditRegisterItemDialog } from "@/components/dialogs/EditRegisterItemDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";

interface Risk {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  probability: string;
  impact: string;
  score: number;
  status: string;
  response: string | null;
  date_identified: string | null;
  review_date: string | null;
  owner_id: string | null;
  programme_id: string | null;
  project_id: string | null;
}

const probabilityConfig: Record<string, { label: string; value: number }> = {
  "very-low": { label: "Very Low", value: 1 },
  low: { label: "Low", value: 2 },
  medium: { label: "Medium", value: 3 },
  high: { label: "High", value: 4 },
  "very-high": { label: "Very High", value: 5 },
};

const statusConfig: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-destructive/10 text-destructive" },
  mitigating: { label: "Mitigating", className: "bg-warning/10 text-warning" },
  closed: { label: "Closed", className: "bg-success/10 text-success" },
  accepted: { label: "Accepted", className: "bg-primary/10 text-primary" },
};

const categoryOptions = ["Resource", "Technical", "Compliance", "Financial", "Stakeholder", "Quality", "Commercial"];

const getScoreColor = (score: number) => {
  if (score >= 15) return "bg-destructive text-destructive-foreground";
  if (score >= 10) return "bg-warning text-warning-foreground";
  if (score >= 5) return "bg-info text-info-foreground";
  return "bg-success text-success-foreground";
};

export default function RiskRegister() {
  const { currentOrganization } = useOrganization();
  const { canManage } = usePermissions();
  const [searchQuery, setSearchQuery] = useState("");
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [probabilityFilters, setProbabilityFilters] = useState<string[]>([]);
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);

  useEffect(() => {
    fetchRisks();
  }, [currentOrganization]);

  const fetchRisks = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("risks")
        .select("*")
        .order("created_at", { ascending: false });

      if (currentOrganization) {
        query = query.eq("organization_id", currentOrganization.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setRisks(data || []);
    } catch (error) {
      console.error("Error fetching risks:", error);
      toast.error("Failed to load risks");
    } finally {
      setLoading(false);
    }
  };

  const toggleFilter = (value: string, filters: string[], setFilters: React.Dispatch<React.SetStateAction<string[]>>) => {
    setFilters(prev => 
      prev.includes(value) 
        ? prev.filter(s => s !== value)
        : [...prev, value]
    );
  };

  const clearFilters = () => {
    setStatusFilters([]);
    setCategoryFilters([]);
    setProbabilityFilters([]);
  };

  const filteredRisks = risks.filter((r) => {
    const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilters.length === 0 || statusFilters.includes(r.status);
    const matchesCategory = categoryFilters.length === 0 || (r.category && categoryFilters.includes(r.category));
    const matchesProbability = probabilityFilters.length === 0 || probabilityFilters.includes(r.probability);
    return matchesSearch && matchesStatus && matchesCategory && matchesProbability;
  });

  const activeFilterCount = statusFilters.length + categoryFilters.length + probabilityFilters.length;
  const openRisks = risks.filter(r => r.status === "open" || r.status === "mitigating").length;
  const highRisks = risks.filter(r => r.score >= 15).length;

  const handleEditClick = (risk: Risk) => {
    setSelectedRisk(risk);
    setEditDialogOpen(true);
  };

  return (
    <AppLayout title="Risk Register" subtitle="PRINCE2 MSP risk management">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{risks.length}</p>
              <p className="text-sm text-muted-foreground">Total Risks</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{openRisks}</p>
              <p className="text-sm text-muted-foreground">Open Risks</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{highRisks}</p>
              <p className="text-sm text-muted-foreground">High Priority</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <AlertTriangle className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{risks.filter(r => r.status === "closed").length}</p>
              <p className="text-sm text-muted-foreground">Closed Risks</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search risks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                Filter
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Filters</h4>
                  {activeFilterCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-auto p-0 text-xs text-muted-foreground">
                      Clear all
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`status-${key}`} 
                        checked={statusFilters.includes(key)}
                        onCheckedChange={() => toggleFilter(key, statusFilters, setStatusFilters)}
                      />
                      <label htmlFor={`status-${key}`} className="text-sm cursor-pointer flex-1">
                        {config.label}
                      </label>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Category</Label>
                  {categoryOptions.map((cat) => (
                    <div key={cat} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`cat-${cat}`} 
                        checked={categoryFilters.includes(cat)}
                        onCheckedChange={() => toggleFilter(cat, categoryFilters, setCategoryFilters)}
                      />
                      <label htmlFor={`cat-${cat}`} className="text-sm cursor-pointer flex-1">
                        {cat}
                      </label>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Probability</Label>
                  {Object.entries(probabilityConfig).map(([key, config]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`prob-${key}`} 
                        checked={probabilityFilters.includes(key)}
                        onCheckedChange={() => toggleFilter(key, probabilityFilters, setProbabilityFilters)}
                      />
                      <label htmlFor={`prob-${key}`} className="text-sm cursor-pointer flex-1">
                        {config.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          {canManage("risks") && <CreateRiskDialog onSuccess={fetchRisks} />}
        </div>
      </div>

      {/* Risks Table */}
      <div className="metric-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Risk Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-center">P</TableHead>
              <TableHead className="text-center">I</TableHead>
              <TableHead className="text-center">Score</TableHead>
              <TableHead>Response</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  Loading risks...
                </TableCell>
              </TableRow>
            ) : filteredRisks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  No risks found. Create your first risk to get started.
                </TableCell>
              </TableRow>
            ) : (
              filteredRisks.map((risk, index) => (
                <TableRow 
                  key={risk.id} 
                  className="animate-fade-in cursor-pointer hover:bg-muted/50"
                  style={{ animationDelay: `${index * 0.03}s` }}
                  onClick={() => handleEditClick(risk)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium">{risk.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{risk.description}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{risk.category || "N/A"}</Badge>
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {probabilityConfig[risk.probability]?.value || 3}
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {probabilityConfig[risk.impact]?.value || 3}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={cn("text-xs", getScoreColor(risk.score))}>
                      {risk.score}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{risk.response || "N/A"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn("text-xs", statusConfig[risk.status]?.className || "")}>
                      {statusConfig[risk.status]?.label || risk.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditClick(risk);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Risk Dialog */}
      {selectedRisk && (
        <EditRegisterItemDialog
          item={selectedRisk}
          type="risks"
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={fetchRisks}
        />
      )}
    </AppLayout>
  );
}
