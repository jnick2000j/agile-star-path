import { ReactNode, useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { TrialBanner } from "@/components/TrialBanner";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

interface AppLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function AppLayout({ children, title, subtitle }: AppLayoutProps) {
  const { currentOrganization } = useOrganization();
  const [appName, setAppName] = useState<string | null>(null);

  useEffect(() => {
    const fetchBrandingTitle = async () => {
      // Get branding from org or global
      let query = supabase.from("branding_settings").select("app_name");
      query = currentOrganization?.id
        ? query.eq("organization_id", currentOrganization.id)
        : query.is("organization_id", null);

      const { data } = await query.maybeSingle();
      setAppName(data?.app_name ?? null);
    };
    fetchBrandingTitle();
  }, [currentOrganization?.id]);

  useEffect(() => {
    const base = appName || "TaskMaster";
    document.title = title ? `${title} – ${base}` : base;
  }, [title, appName]);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="pl-64">
        <TrialBanner />
        <Header title={title} subtitle={subtitle} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
