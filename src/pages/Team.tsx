import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Search, 
  Filter,
  Mail,
  MoreVertical
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "admin" | "programme-owner" | "project-manager" | "team-member" | "stakeholder";
  department: string;
  programmes: string[];
  avatar?: string;
  status: "active" | "away" | "offline";
}

const teamMembers: TeamMember[] = [
  { id: "1", name: "Jane Smith", email: "jane.smith@company.com", role: "admin", department: "Executive", programmes: ["Digital Transformation"], status: "active" },
  { id: "2", name: "Michael Chen", email: "michael.chen@company.com", role: "programme-owner", department: "Technology", programmes: ["Digital Transformation"], status: "active" },
  { id: "3", name: "Sarah Wilson", email: "sarah.wilson@company.com", role: "programme-owner", department: "Customer Services", programmes: ["Customer Experience"], status: "active" },
  { id: "4", name: "James Taylor", email: "james.taylor@company.com", role: "programme-owner", department: "Infrastructure", programmes: ["Infrastructure Modernization"], status: "away" },
  { id: "5", name: "Lisa Anderson", email: "lisa.anderson@company.com", role: "programme-owner", department: "Data & Analytics", programmes: ["Data Analytics Platform"], status: "active" },
  { id: "6", name: "Alex Turner", email: "alex.turner@company.com", role: "project-manager", department: "Technology", programmes: ["Digital Transformation"], status: "active" },
  { id: "7", name: "Rachel Green", email: "rachel.green@company.com", role: "project-manager", department: "Technology", programmes: ["Digital Transformation"], status: "offline" },
  { id: "8", name: "Chris Martin", email: "chris.martin@company.com", role: "project-manager", department: "Customer Services", programmes: ["Customer Experience"], status: "active" },
  { id: "9", name: "Frank Castle", email: "frank.castle@company.com", role: "project-manager", department: "Security", programmes: ["Security Enhancement"], status: "active" },
  { id: "10", name: "Irene Adler", email: "irene.adler@company.com", role: "project-manager", department: "Data & Analytics", programmes: ["Data Analytics Platform"], status: "away" },
];

const roleConfig = {
  admin: { label: "Administrator", className: "bg-destructive/10 text-destructive" },
  "programme-owner": { label: "Programme Owner", className: "bg-primary/10 text-primary" },
  "project-manager": { label: "Project Manager", className: "bg-success/10 text-success" },
  "team-member": { label: "Team Member", className: "bg-muted text-muted-foreground" },
  stakeholder: { label: "Stakeholder", className: "bg-info/10 text-info" },
};

const statusColors = {
  active: "bg-success",
  away: "bg-warning",
  offline: "bg-muted-foreground",
};

const departments = ["Executive", "Technology", "Customer Services", "Infrastructure", "Data & Analytics", "Security"];

export default function Team() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilters, setRoleFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [departmentFilters, setDepartmentFilters] = useState<string[]>([]);

  const toggleFilter = (value: string, filters: string[], setFilters: React.Dispatch<React.SetStateAction<string[]>>) => {
    setFilters(prev => 
      prev.includes(value) 
        ? prev.filter(s => s !== value)
        : [...prev, value]
    );
  };

  const clearFilters = () => {
    setRoleFilters([]);
    setStatusFilters([]);
    setDepartmentFilters([]);
  };

  const filteredMembers = teamMembers.filter((m) => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilters.length === 0 || roleFilters.includes(m.role);
    const matchesStatus = statusFilters.length === 0 || statusFilters.includes(m.status);
    const matchesDept = departmentFilters.length === 0 || departmentFilters.includes(m.department);
    return matchesSearch && matchesRole && matchesStatus && matchesDept;
  });

  const activeFilterCount = roleFilters.length + statusFilters.length + departmentFilters.length;

  return (
    <AppLayout title="Team" subtitle="Manage programme team members">
      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search team members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
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
                  <Label className="text-xs text-muted-foreground">Role</Label>
                  {Object.entries(roleConfig).map(([key, config]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`role-${key}`} 
                        checked={roleFilters.includes(key)}
                        onCheckedChange={() => toggleFilter(key, roleFilters, setRoleFilters)}
                      />
                      <label htmlFor={`role-${key}`} className="text-sm cursor-pointer flex-1">
                        {config.label}
                      </label>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  {Object.keys(statusColors).map((status) => (
                    <div key={status} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`status-${status}`} 
                        checked={statusFilters.includes(status)}
                        onCheckedChange={() => toggleFilter(status, statusFilters, setStatusFilters)}
                      />
                      <label htmlFor={`status-${status}`} className="text-sm cursor-pointer flex-1 capitalize">
                        {status}
                      </label>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Department</Label>
                  {departments.map((dept) => (
                    <div key={dept} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`dept-${dept}`} 
                        checked={departmentFilters.includes(dept)}
                        onCheckedChange={() => toggleFilter(dept, departmentFilters, setDepartmentFilters)}
                      />
                      <label htmlFor={`dept-${dept}`} className="text-sm cursor-pointer flex-1">
                        {dept}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Member
          </Button>
        </div>
      </div>

      {/* Team Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredMembers.map((member, index) => (
          <div 
            key={member.id} 
            className="metric-card animate-slide-up"
            style={{ animationDelay: `${index * 0.03}s` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-medium text-primary">
                    {member.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card",
                    statusColors[member.status]
                  )} />
                </div>
                <div>
                  <p className="font-medium">{member.name}</p>
                  <p className="text-sm text-muted-foreground">{member.department}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <Badge variant="secondary" className={cn("text-xs", roleConfig[member.role].className)}>
                {roleConfig[member.role].label}
              </Badge>

              <div className="flex flex-wrap gap-1">
                {member.programmes.map((prog) => (
                  <Badge key={prog} variant="outline" className="text-xs">
                    {prog.length > 20 ? prog.substring(0, 20) + '...' : prog}
                  </Badge>
                ))}
              </div>

              <div className="pt-3 border-t border-border">
                <Button variant="ghost" size="sm" className="w-full gap-2 justify-start text-muted-foreground hover:text-foreground">
                  <Mail className="h-4 w-4" />
                  {member.email}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
