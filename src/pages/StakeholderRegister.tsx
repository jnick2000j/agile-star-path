import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Search, 
  Filter,
  Users,
  ArrowUpRight,
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

interface Stakeholder {
  id: string;
  name: string;
  role: string;
  organization: string;
  programmes: string[];
  influence: "high" | "medium" | "low";
  interest: "high" | "medium" | "low";
  engagement: "champion" | "supporter" | "neutral" | "critic" | "blocker";
  communicationFrequency: "weekly" | "bi-weekly" | "monthly" | "quarterly";
  email: string;
  lastContact: string;
}

const stakeholders: Stakeholder[] = [
  { id: "STK001", name: "Jane Smith", role: "Executive Sponsor", organization: "Executive Board", programmes: ["Digital Transformation"], influence: "high", interest: "high", engagement: "champion", communicationFrequency: "weekly", email: "jane.smith@company.com", lastContact: "Jan 22, 2024" },
  { id: "STK002", name: "Robert Johnson", role: "Business Owner", organization: "Customer Services", programmes: ["Customer Experience"], influence: "high", interest: "high", engagement: "supporter", communicationFrequency: "weekly", email: "robert.johnson@company.com", lastContact: "Jan 20, 2024" },
  { id: "STK003", name: "Emily Davis", role: "CTO", organization: "Technology", programmes: ["Infrastructure Modernization", "Security Enhancement"], influence: "high", interest: "medium", engagement: "supporter", communicationFrequency: "bi-weekly", email: "emily.davis@company.com", lastContact: "Jan 18, 2024" },
  { id: "STK004", name: "David Brown", role: "Head of Analytics", organization: "Data & Analytics", programmes: ["Data Analytics Platform"], influence: "medium", interest: "high", engagement: "champion", communicationFrequency: "weekly", email: "david.brown@company.com", lastContact: "Jan 21, 2024" },
  { id: "STK005", name: "Patricia Miller", role: "CISO", organization: "Security", programmes: ["Security Enhancement"], influence: "high", interest: "high", engagement: "supporter", communicationFrequency: "weekly", email: "patricia.miller@company.com", lastContact: "Jan 19, 2024" },
  { id: "STK006", name: "Thomas White", role: "Head of Operations", organization: "Operations", programmes: ["Digital Transformation", "Infrastructure Modernization"], influence: "medium", interest: "medium", engagement: "neutral", communicationFrequency: "monthly", email: "thomas.white@company.com", lastContact: "Jan 10, 2024" },
  { id: "STK007", name: "Susan Clark", role: "CFO", organization: "Finance", programmes: ["Digital Transformation", "Data Analytics Platform"], influence: "high", interest: "low", engagement: "critic", communicationFrequency: "monthly", email: "susan.clark@company.com", lastContact: "Jan 5, 2024" },
  { id: "STK008", name: "Mark Wilson", role: "Union Representative", organization: "Employee Union", programmes: ["Digital Transformation"], influence: "medium", interest: "high", engagement: "neutral", communicationFrequency: "quarterly", email: "mark.wilson@company.com", lastContact: "Dec 15, 2023" },
];

const influenceConfig = {
  high: { label: "High", className: "bg-destructive/10 text-destructive" },
  medium: { label: "Medium", className: "bg-warning/10 text-warning" },
  low: { label: "Low", className: "bg-success/10 text-success" },
};

const engagementConfig = {
  champion: { label: "Champion", className: "bg-success/10 text-success" },
  supporter: { label: "Supporter", className: "bg-success/10 text-success" },
  neutral: { label: "Neutral", className: "bg-muted text-muted-foreground" },
  critic: { label: "Critic", className: "bg-warning/10 text-warning" },
  blocker: { label: "Blocker", className: "bg-destructive/10 text-destructive" },
};

export default function StakeholderRegister() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredStakeholders = stakeholders.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.organization.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Stakeholder
          </Button>
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
              <TableHead>Programmes</TableHead>
              <TableHead>Influence</TableHead>
              <TableHead>Interest</TableHead>
              <TableHead>Engagement</TableHead>
              <TableHead>Comm. Freq.</TableHead>
              <TableHead>Last Contact</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStakeholders.map((stakeholder, index) => (
              <TableRow 
                key={stakeholder.id} 
                className="animate-fade-in cursor-pointer hover:bg-muted/50"
                style={{ animationDelay: `${index * 0.03}s` }}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                      {stakeholder.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="font-medium">{stakeholder.name}</p>
                      <p className="text-xs text-muted-foreground">{stakeholder.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{stakeholder.role}</TableCell>
                <TableCell className="text-muted-foreground">{stakeholder.organization}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {stakeholder.programmes.slice(0, 2).map((prog) => (
                      <Badge key={prog} variant="outline" className="text-xs">
                        {prog.length > 15 ? prog.substring(0, 15) + '...' : prog}
                      </Badge>
                    ))}
                    {stakeholder.programmes.length > 2 && (
                      <Badge variant="outline" className="text-xs">+{stakeholder.programmes.length - 2}</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={cn("text-xs", influenceConfig[stakeholder.influence].className)}>
                    {influenceConfig[stakeholder.influence].label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={cn("text-xs", influenceConfig[stakeholder.interest].className)}>
                    {influenceConfig[stakeholder.interest].label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={cn("text-xs", engagementConfig[stakeholder.engagement].className)}>
                    {engagementConfig[stakeholder.engagement].label}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground capitalize">
                  {stakeholder.communicationFrequency.replace('-', ' ')}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{stakeholder.lastContact}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Mail className="h-4 w-4" />
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
