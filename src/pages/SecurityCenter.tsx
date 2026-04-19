import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SSOConfigCard } from "@/components/sso/SSOConfigCard";
import { AuditLogViewer } from "@/components/admin/AuditLogViewer";
import { ShieldCheck, Activity } from "lucide-react";

export default function SecurityCenter() {
  return (
    <AppLayout
      title="Security & Access"
      subtitle="Single sign-on, audit logs, and access controls for your organization"
    >
      <Tabs defaultValue="sso" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sso" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            SSO / SAML
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <Activity className="h-4 w-4" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sso" className="space-y-4">
          <SSOConfigCard />
        </TabsContent>

        <TabsContent value="audit">
          <AuditLogViewer scope="org" />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
