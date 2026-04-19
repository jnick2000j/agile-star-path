import { useState, useEffect } from "react";
import { Search, HelpCircle, Settings, Shield, ChevronDown, LogOut, Palette, User, Globe, Sparkles, CreditCard } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { NotificationBell } from "@/components/notifications/NotificationBell";
import { OrganizationSelector } from "@/components/OrganizationSelector";
import { AskSupportDialog } from "@/components/AskSupportDialog";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { user, signOut, userRole, userProfile } = useAuth();
  const { currentOrganization } = useOrganization();
  const navigate = useNavigate();
  const isAdmin = userRole === "admin";
  const [globalLogoUrl, setGlobalLogoUrl] = useState<string | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);

  const getDisplayName = () => {
    if (userProfile?.first_name && userProfile?.last_name) {
      return `${userProfile.first_name} ${userProfile.last_name}`;
    }
    if (userProfile?.full_name) return userProfile.full_name;
    return user?.email?.split("@")[0] || "User";
  };

  const getInitials = () => {
    if (userProfile?.first_name && userProfile?.last_name) {
      return `${userProfile.first_name[0]}${userProfile.last_name[0]}`.toUpperCase();
    }
    if (userProfile?.full_name) {
      const parts = userProfile.full_name.split(" ");
      return parts.length >= 2
        ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
        : userProfile.full_name.substring(0, 2).toUpperCase();
    }
    return user?.email?.substring(0, 2).toUpperCase() || "U";
  };

  // Fetch global branding logo for unassigned/global admins
  useEffect(() => {
    const fetchGlobalLogo = async () => {
      const { data } = await supabase
        .from("branding_settings")
        .select("logo_url")
        .is("organization_id", null)
        .maybeSingle();
      
      if (data?.logo_url) {
        setGlobalLogoUrl(data.logo_url);
      }
    };
    
    // Only fetch if no organization is selected
    if (!currentOrganization) {
      fetchGlobalLogo();
    }
  }, [currentOrganization]);

  // Determine which logo to show
  const logoUrl = currentOrganization?.logo_url || globalLogoUrl;

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
      <div className="flex items-center gap-5">
        {/* Organization Logo in Header - left of title */}
        {logoUrl && (
          <img 
            src={logoUrl} 
            alt="Organization logo"
            className="h-14 w-auto object-contain drop-shadow-sm"
          />
        )}
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:block w-56">
          <OrganizationSelector />
        </div>
        
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search programmes, projects..."
            className="w-64 pl-9 bg-secondary border-0"
          />
        </div>

        <NotificationBell />

        <Button
          variant="outline"
          size="sm"
          onClick={() => setSupportOpen(true)}
          title="Ask the Task Master"
          aria-label="Ask the Task Master"
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">Ask the Task Master</span>
          <HelpCircle className="h-4 w-4 sm:hidden" />
        </Button>

        <AskSupportDialog open={supportOpen} onOpenChange={setSupportOpen} />

        {/* Quick link to Support inside menu too */}

        {/* User Menu Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:inline text-sm font-medium max-w-[140px] truncate">{getDisplayName()}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{getDisplayName()}</p>
              <p className="text-xs text-muted-foreground capitalize">{userRole?.replace("_", " ") || "User"}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
                <User className="h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/branding" className="flex items-center gap-2 cursor-pointer">
                <Palette className="h-4 w-4" />
                Branding
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/security" className="flex items-center gap-2 cursor-pointer">
                <Shield className="h-4 w-4" />
                Security
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/billing" className="flex items-center gap-2 cursor-pointer">
                <CreditCard className="h-4 w-4" />
                Billing
              </Link>
            </DropdownMenuItem>
            {(isAdmin || userRole === "org_admin") && (
              <DropdownMenuItem asChild>
                <Link to="/admin" className="flex items-center gap-2 cursor-pointer">
                  <Shield className="h-4 w-4" />
                  Admin Panel
                </Link>
              </DropdownMenuItem>
            )}
            {isAdmin && (
              <DropdownMenuItem asChild>
                <Link to="/platform-admin" className="flex items-center gap-2 cursor-pointer">
                  <Globe className="h-4 w-4" />
                  Platform Admin
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="flex items-center gap-2 cursor-pointer text-destructive">
              <LogOut className="h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
