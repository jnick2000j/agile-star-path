import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SSOConfigCard } from "@/components/sso/SSOConfigCard";
import { SCIMTokensCard } from "@/components/sso/SCIMTokensCard";
import { AuditLogViewer } from "@/components/admin/AuditLogViewer";
import { AuditRetentionPolicy } from "@/components/admin/AuditRetentionPolicy";
import { ShieldCheck, Activity, Key } from "lucide-react";

export default function SecurityCenter() {
  return (
    <AppLayout
      title="Security & Access"
      subtitle="Single sign-on, SCIM provisioning, audit logs, and access controls"
    >
      <Tabs defaultValue="sso" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sso" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            SSO / SAML / OIDC
          </TabsTrigger>
          <TabsTrigger value="scim" className="gap-2">
            <Key className="h-4 w-4" />
            SCIM
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <Activity className="h-4 w-4" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sso" className="space-y-4">
          <SSOConfigCard />
        </TabsContent>

        <TabsContent value="scim" className="space-y-4">
          <SCIMTokensCard />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <AuditRetentionPolicy scope="org" />
          <AuditLogViewer scope="org" />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
