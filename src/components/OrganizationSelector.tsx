import { Building2, ChevronDown, Check } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useSignedLogo } from "@/hooks/useSignedLogo";

function OrgLogo({ stored, name, primaryColor, size = "h-5 w-5" }: { stored?: string | null; name?: string; primaryColor?: string | null; size?: string }) {
  const url = useSignedLogo(stored);
  if (url) {
    return <img src={url} alt={name || ""} className={`${size} rounded object-contain`} />;
  }
  return (
    <div className={`${size} rounded flex items-center justify-center`} style={{ backgroundColor: primaryColor || "#2563eb" }}>
      <Building2 className="h-3 w-3 text-white" />
    </div>
  );
}

export function OrganizationSelector() {
  const { organizations, currentOrganization, setCurrentOrganization, loading } = useOrganization();

  if (loading) {
    return (
      <div className="h-9 w-48 bg-secondary animate-pulse rounded-md" />
    );
  }

  if (organizations.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 w-full justify-between bg-sidebar-accent/60 hover:bg-sidebar-accent text-sidebar-foreground border-sidebar-border"
        >
          <div className="flex items-center gap-2">
            <OrgLogo stored={currentOrganization?.logo_url} name={currentOrganization?.name} primaryColor={currentOrganization?.primary_color} />
            <span className="truncate">
              {currentOrganization?.name || "Select Organization"}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 bg-popover z-50">
        <DropdownMenuLabel>Switch Organization</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => setCurrentOrganization(org)}
            className={cn(
              "cursor-pointer gap-2",
              currentOrganization?.id === org.id && "bg-accent"
            )}
          >
            {org.logo_url ? (
              <img
                src={org.logo_url}
                alt={org.name}
                className="h-5 w-5 rounded object-contain"
              />
            ) : (
              <div
                className="h-5 w-5 rounded flex items-center justify-center"
                style={{ backgroundColor: org.primary_color || "#2563eb" }}
              >
                <Building2 className="h-3 w-3 text-white" />
              </div>
            )}
            <span className="flex-1 truncate">{org.name}</span>
            {currentOrganization?.id === org.id && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}