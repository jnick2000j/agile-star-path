import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  Plus, 
  Search, 
  Filter,
  Users,
  Download,
  Mail
} from "lucide-react";
import { cn } from "@/lib/utils";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Stakeholder {
  id: string;
  name: string;
  role: string | null;
  organization: string | null;
  email: string | null;
  influence: string;
  interest: string;
  engagement: string;
  communication_frequency: string | null;
  last_contact: string | null;
}

const influenceConfig: Record<string, { label: string; className: string }> = {
  high: { label: "High", className: "bg-destructive/10 text-destructive" },
  medium: { label: "Medium", className: "bg-warning/10 text-warning" },
  low: { label: "Low", className: "bg-success/10 text-success" },
};

const engagementConfig: Record<string, { label: string; className: string }> = {
  champion: { label: "Champion", className: "bg-success/10 text-success" },
  supporter: { label: "Supporter", className: "bg-success/10 text-success" },
  neutral: { label: "Neutral", className: "bg-muted text-muted-foreground" },
  critic: { label: "Critic", className: "bg-warning/10 text-warning" },
  blocker: { label: "Blocker", className: "bg-destructive/10 text-destructive" },
};

export default function StakeholderRegister() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [influenceFilters, setInfluenceFilters] = useState<string[]>([]);
  const [engagementFilters, setEngagementFilters] = useState<string[]>([]);
  const [interestFilters, setInterestFilters] = useState<string[]>([]);
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    organization: "",
    email: "",
    influence: "medium",
    interest: "medium",
    engagement: "neutral",
    communication_frequency: "monthly",
  });

  useEffect(() => {
    fetchStakeholders();
  }, [currentOrganization]);

  const fetchStakeholders = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("stakeholders")
        .select("*")
        .order("created_at", { ascending: false });

      if (currentOrganization) {
        query = query.eq("organization_id", currentOrganization.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setStakeholders(data || []);
    } catch (error) {
      console.error("Error fetching stakeholders:", error);
      toast.error("Failed to load stakeholders");
    } finally {
      setLoading(false);
    }
  };

  const handleAddStakeholder = async () => {
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase
        .from("stakeholders")
        .insert({
          ...formData,
          organization_id: currentOrganization?.id,
          created_by: user?.id,
        });

      if (error) throw error;
      toast.success("Stakeholder added successfully");
      setDialogOpen(false);
      setFormData({
        name: "",
        role: "",
        organization: "",
        email: "",
        influence: "medium",
        interest: "medium",
        engagement: "neutral",
        communication_frequency: "monthly",
      });
      fetchStakeholders();
    } catch (error: any) {
      console.error("Error adding stakeholder:", error);
      toast.error(error.message || "Failed to add stakeholder");
    } finally {
      setAdding(false);
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
    setInfluenceFilters([]);
    setEngagementFilters([]);
    setInterestFilters([]);
  };

  const filteredStakeholders = stakeholders.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.organization?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesInfluence = influenceFilters.length === 0 || influenceFilters.includes(s.influence);
    const matchesEngagement = engagementFilters.length === 0 || engagementFilters.includes(s.engagement);
    const matchesInterest = interestFilters.length === 0 || interestFilters.includes(s.interest);
    return matchesSearch && matchesInfluence && matchesEngagement && matchesInterest;
  });

  const activeFilterCount = influenceFilters.length + engagementFilters.length + interestFilters.length;

  return (
    <AppLayout title="Stakeholder Register" subtitle="PRINCE2 MSP stakeholder engagement">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{stakeholders.length}</p>
              <p className="text-sm text-muted-foreground">Total Stakeholders</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <Users className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{stakeholders.filter(s => s.engagement === "champion" || s.engagement === "supporter").length}</p>
              <p className="text-sm text-muted-foreground">Supporters</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <Users className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{stakeholders.filter(s => s.engagement === "critic" || s.engagement === "blocker").length}</p>
              <p className="text-sm text-muted-foreground">Need Attention</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <Users className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{stakeholders.filter(s => s.influence === "high").length}</p>
              <p className="text-sm text-muted-foreground">High Influence</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search stakeholders..."
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
                  <Label className="text-xs text-muted-foreground">Influence</Label>
                  {Object.entries(influenceConfig).map(([key, config]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`inf-${key}`} 
                        checked={influenceFilters.includes(key)}
                        onCheckedChange={() => toggleFilter(key, influenceFilters, setInfluenceFilters)}
                      />
                      <label htmlFor={`inf-${key}`} className="text-sm cursor-pointer flex-1">
                        {config.label}
                      </label>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Interest</Label>
                  {Object.entries(influenceConfig).map(([key, config]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`int-${key}`} 
                        checked={interestFilters.includes(key)}
                        onCheckedChange={() => toggleFilter(key, interestFilters, setInterestFilters)}
                      />
                      <label htmlFor={`int-${key}`} className="text-sm cursor-pointer flex-1">
                        {config.label}
                      </label>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Engagement</Label>
                  {Object.entries(engagementConfig).map(([key, config]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`eng-${key}`} 
                        checked={engagementFilters.includes(key)}
                        onCheckedChange={() => toggleFilter(key, engagementFilters, setEngagementFilters)}
                      />
                      <label htmlFor={`eng-${key}`} className="text-sm cursor-pointer flex-1">
                        {config.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Stakeholder
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Stakeholder</DialogTitle>
                <DialogDescription>
                  Add a new stakeholder to the register.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Input
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      placeholder="e.g., Executive Sponsor"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Organization</Label>
                    <Input
                      value={formData.organization}
                      onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                      placeholder="Company/Department"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Influence</Label>
                    <Select value={formData.influence} onValueChange={(v) => setFormData({ ...formData, influence: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Interest</Label>
                    <Select value={formData.interest} onValueChange={(v) => setFormData({ ...formData, interest: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Engagement</Label>
                    <Select value={formData.engagement} onValueChange={(v) => setFormData({ ...formData, engagement: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="champion">Champion</SelectItem>
                        <SelectItem value="supporter">Supporter</SelectItem>
                        <SelectItem value="neutral">Neutral</SelectItem>
                        <SelectItem value="critic">Critic</SelectItem>
                        <SelectItem value="blocker">Blocker</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Communication</Label>
                    <Select value={formData.communication_frequency} onValueChange={(v) => setFormData({ ...formData, communication_frequency: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddStakeholder} disabled={adding}>
                  {adding ? "Adding..." : "Add Stakeholder"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stakeholders Table */}
      <div className="metric-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Influence</TableHead>
              <TableHead>Interest</TableHead>
              <TableHead>Engagement</TableHead>
              <TableHead>Comm. Freq.</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  Loading stakeholders...
                </TableCell>
              </TableRow>
            ) : filteredStakeholders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  No stakeholders found. Add your first stakeholder to get started.
                </TableCell>
              </TableRow>
            ) : (
              filteredStakeholders.map((stakeholder, index) => (
                <TableRow 
                  key={stakeholder.id} 
                  className="animate-fade-in cursor-pointer hover:bg-muted/50"
                  style={{ animationDelay: `${index * 0.03}s` }}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                        {stakeholder.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium">{stakeholder.name}</p>
                        <p className="text-xs text-muted-foreground">{stakeholder.email || "No email"}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{stakeholder.role || "N/A"}</TableCell>
                  <TableCell className="text-muted-foreground">{stakeholder.organization || "N/A"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn("text-xs", influenceConfig[stakeholder.influence]?.className || "")}>
                      {influenceConfig[stakeholder.influence]?.label || stakeholder.influence}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn("text-xs", influenceConfig[stakeholder.interest]?.className || "")}>
                      {influenceConfig[stakeholder.interest]?.label || stakeholder.interest}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn("text-xs", engagementConfig[stakeholder.engagement]?.className || "")}>
                      {engagementConfig[stakeholder.engagement]?.label || stakeholder.engagement}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground capitalize">
                    {stakeholder.communication_frequency?.replace('-', ' ') || "N/A"}
                  </TableCell>
                  <TableCell>
                    {stakeholder.email && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <a href={`mailto:${stakeholder.email}`}>
                          <Mail className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </AppLayout>
  );
}