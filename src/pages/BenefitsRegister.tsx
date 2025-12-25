import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Search, 
  Filter,
  Target,
  ArrowUpRight,
  Download,
  TrendingUp
} from "lucide-react";
import { CreateBenefitDialog } from "@/components/dialogs/CreateBenefitDialog";
import { DocumentUpload } from "@/components/DocumentUpload";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface Benefit {
  id: string;
  name: string;
  description: string;
  programme: string;
  category: "financial" | "operational" | "strategic" | "compliance" | "customer";
  type: "quantitative" | "qualitative";
  targetValue: string;
  currentValue: string;
  realization: number;
  owner: string;
  status: "identified" | "measuring" | "realized" | "sustaining";
  startDate: string;
  endDate: string;
}

const benefits: Benefit[] = [
  { id: "BEN001", name: "Operational cost reduction", description: "Reduction in manual processing costs through automation", programme: "Digital Transformation", category: "financial", type: "quantitative", targetValue: "£500K/year", currentValue: "£320K/year", realization: 64, owner: "Michael Chen", status: "measuring", startDate: "Jan 2024", endDate: "Dec 2025" },
  { id: "BEN002", name: "Customer satisfaction improvement", description: "Increase in NPS score through enhanced digital experience", programme: "Customer Experience", category: "customer", type: "quantitative", targetValue: "+15 NPS", currentValue: "+8 NPS", realization: 53, owner: "Sarah Wilson", status: "measuring", startDate: "Mar 2024", endDate: "Sep 2025" },
  { id: "BEN003", name: "System availability increase", description: "Improvement in overall system uptime", programme: "Infrastructure Modernization", category: "operational", type: "quantitative", targetValue: "99.9%", currentValue: "99.7%", realization: 85, owner: "James Taylor", status: "measuring", startDate: "Jun 2023", endDate: "Mar 2025" },
  { id: "BEN004", name: "Data-driven decision making", description: "Enable real-time analytics for business decisions", programme: "Data Analytics Platform", category: "strategic", type: "qualitative", targetValue: "Fully enabled", currentValue: "Partially enabled", realization: 40, owner: "Lisa Anderson", status: "identified", startDate: "Sep 2024", endDate: "Jun 2026" },
  { id: "BEN005", name: "Regulatory compliance", description: "Full compliance with new security regulations", programme: "Security Enhancement", category: "compliance", type: "qualitative", targetValue: "100% compliant", currentValue: "100% compliant", realization: 100, owner: "Frank Castle", status: "realized", startDate: "Jan 2023", endDate: "Dec 2024" },
  { id: "BEN006", name: "Revenue growth from digital channels", description: "Increase in revenue through new digital services", programme: "Digital Transformation", category: "financial", type: "quantitative", targetValue: "£2M/year", currentValue: "£1.2M/year", realization: 60, owner: "Jane Smith", status: "measuring", startDate: "Jan 2024", endDate: "Dec 2025" },
  { id: "BEN007", name: "Employee productivity", description: "Increase in employee productivity through better tools", programme: "Digital Transformation", category: "operational", type: "quantitative", targetValue: "+20%", currentValue: "+12%", realization: 60, owner: "Michael Chen", status: "measuring", startDate: "Jan 2024", endDate: "Dec 2025" },
];

const categoryConfig = {
  financial: { label: "Financial", className: "bg-success/10 text-success" },
  operational: { label: "Operational", className: "bg-primary/10 text-primary" },
  strategic: { label: "Strategic", className: "bg-info/10 text-info" },
  compliance: { label: "Compliance", className: "bg-warning/10 text-warning" },
  customer: { label: "Customer", className: "bg-accent text-accent-foreground" },
};

const statusConfig = {
  identified: { label: "Identified", className: "bg-muted text-muted-foreground" },
  measuring: { label: "Measuring", className: "bg-primary/10 text-primary" },
  realized: { label: "Realized", className: "bg-success/10 text-success" },
  sustaining: { label: "Sustaining", className: "bg-info/10 text-info" },
};

const typeOptions = [
  { value: "quantitative", label: "Quantitative" },
  { value: "qualitative", label: "Qualitative" },
];

export default function BenefitsRegister() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);

  const toggleFilter = (value: string, filters: string[], setFilters: React.Dispatch<React.SetStateAction<string[]>>) => {
    setFilters(prev => 
      prev.includes(value) 
        ? prev.filter(s => s !== value)
        : [...prev, value]
    );
  };

  const clearFilters = () => {
    setCategoryFilters([]);
    setStatusFilters([]);
    setTypeFilters([]);
  };

  const filteredBenefits = benefits.filter((b) => {
    const matchesSearch = b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.programme.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilters.length === 0 || categoryFilters.includes(b.category);
    const matchesStatus = statusFilters.length === 0 || statusFilters.includes(b.status);
    const matchesType = typeFilters.length === 0 || typeFilters.includes(b.type);
    return matchesSearch && matchesCategory && matchesStatus && matchesType;
  });

  const activeFilterCount = categoryFilters.length + statusFilters.length + typeFilters.length;

  const totalTarget = "£3.7M";
  const totalRealized = "£2.1M";
  const avgRealization = Math.round(benefits.reduce((acc, b) => acc + b.realization, 0) / benefits.length);

  return (
    <AppLayout title="Benefits Register" subtitle="PRINCE2 MSP benefits management">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{benefits.length}</p>
              <p className="text-sm text-muted-foreground">Total Benefits</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{totalTarget}</p>
              <p className="text-sm text-muted-foreground">Target Value</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <Target className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{totalRealized}</p>
              <p className="text-sm text-muted-foreground">Realized Value</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
              <TrendingUp className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{avgRealization}%</p>
              <p className="text-sm text-muted-foreground">Avg Realization</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search benefits..."
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
                  <Label className="text-xs text-muted-foreground">Category</Label>
                  {Object.entries(categoryConfig).map(([key, config]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`cat-${key}`} 
                        checked={categoryFilters.includes(key)}
                        onCheckedChange={() => toggleFilter(key, categoryFilters, setCategoryFilters)}
                      />
                      <label htmlFor={`cat-${key}`} className="text-sm cursor-pointer flex-1">
                        {config.label}
                      </label>
                    </div>
                  ))}
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
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  {typeOptions.map((t) => (
                    <div key={t.value} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`type-${t.value}`} 
                        checked={typeFilters.includes(t.value)}
                        onCheckedChange={() => toggleFilter(t.value, typeFilters, setTypeFilters)}
                      />
                      <label htmlFor={`type-${t.value}`} className="text-sm cursor-pointer flex-1">
                        {t.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <CreateBenefitDialog onSuccess={() => {}} />
        </div>
      </div>

      {/* Benefits Table */}
      <div className="metric-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">ID</TableHead>
              <TableHead>Benefit Name</TableHead>
              <TableHead>Programme</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Current</TableHead>
              <TableHead className="w-[150px]">Realization</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBenefits.map((benefit, index) => (
              <TableRow 
                key={benefit.id} 
                className="animate-fade-in cursor-pointer hover:bg-muted/50"
                style={{ animationDelay: `${index * 0.03}s` }}
              >
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {benefit.id}
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{benefit.name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{benefit.description}</p>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{benefit.programme}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={cn("text-xs", categoryConfig[benefit.category].className)}>
                    {categoryConfig[benefit.category].label}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">{benefit.targetValue}</TableCell>
                <TableCell className="text-muted-foreground">{benefit.currentValue}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={benefit.realization} className="h-2 flex-1" />
                    <span className="text-sm font-medium w-10">{benefit.realization}%</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{benefit.owner}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={cn("text-xs", statusConfig[benefit.status].className)}>
                    {statusConfig[benefit.status].label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AppLayout>
  );
}
