import { useState, useEffect } from "react";
import { HelpCircle, Settings, Shield, ChevronDown, LogOut, Palette, User, Globe, Sparkles, CreditCard, KeyRound, Receipt, Loader2, Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

import { OrganizationSelector } from "@/components/OrganizationSelector";
import { RegionBadge } from "@/components/RegionBadge";
import { AICreditsMeter } from "@/components/billing/AICreditsMeter";
import { AskSupportDialog } from "@/components/AskSupportDialog";

import { useAuth } from "@/hooks/useAuth";
import { useDeploymentMode } from "@/hooks/useDeploymentMode";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { toast } from "sonner";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useSignedLogo } from "@/hooks/useSignedLogo";
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
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const { currentOrganization } = useOrganization();
  const { isLicenseMode } = useDeploymentMode();
  const navigate = useNavigate();
  const isAdmin = userRole === "admin";
  const [globalLogoUrl, setGlobalLogoUrl] = useState<string | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);

  const handleOpenBillingPortal = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!currentOrganization?.id) {
      toast.error("Select an organization first");
      return;
    }
    setOpeningPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-portal-session", {
        body: {
          organizationId: currentOrganization.id,
          environment: getStripeEnvironment(),
          returnUrl: `${window.location.origin}/billing`,
        },
      });
      const errMsg = (data as any)?.error || error?.message;
      if (errMsg?.toLowerCase().includes("no subscription")) {
        toast.info("No active subscription yet. Visit Billing to choose a plan.");
        return;
      }
      if (errMsg || !data?.url) throw new Error(errMsg || "Could not open billing portal");
      window.open(data.url, "_blank");
    } catch (err: any) {
      toast.error(err.message || "Could not open billing portal");
    } finally {
      setOpeningPortal(false);
    }
  };

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

  // Determine which logo to show (resolve to signed URL since 'logos' bucket is private)
  const storedLogo = currentOrganization?.logo_url || globalLogoUrl;
  const logoUrl = useSignedLogo(storedLogo);

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
        <div className="hidden md:block w-80">
          <OrganizationSelector />
        </div>
        <RegionBadge />

        

        <Button
          variant="outline"
          size="sm"
          onClick={() => setSupportOpen(true)}
          title="Get Help!"
          aria-label="Get Help!"
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">Get Help!</span>
          <HelpCircle className="h-4 w-4 sm:hidden" />
        </Button>

        <AskSupportDialog open={supportOpen} onOpenChange={setSupportOpen} />

        <NotificationBell />

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
          <DropdownMenuContent align="end" className="w-64">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{getDisplayName()}</p>
              <p className="text-xs text-muted-foreground capitalize">{userRole?.replace("_", " ") || "User"}</p>
            </div>
            <DropdownMenuSeparator />
            <AICreditsMeter variant="menu" hideWhenEmpty />
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
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              onClick={toggleTheme}
              className="flex items-center gap-2 cursor-pointer"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {isDark ? "Light mode" : "Dark mode"}
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/billing" className="flex items-center gap-2 cursor-pointer">
                {isLicenseMode ? <KeyRound className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                {isLicenseMode ? "License" : "Billing & Plans"}
              </Link>
            </DropdownMenuItem>
            {!isLicenseMode && (
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                onClick={handleOpenBillingPortal}
                disabled={openingPortal}
                className="flex items-center gap-2 cursor-pointer"
              >
                {openingPortal ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Receipt className="h-4 w-4" />
                )}
                Manage payment & invoices
              </DropdownMenuItem>
            )}
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
