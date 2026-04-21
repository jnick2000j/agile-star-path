import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SSOConfigCard } from "@/components/sso/SSOConfigCard";
import { SCIMTokensCard } from "@/components/sso/SCIMTokensCard";
import { SCIMGroupMappingsCard } from "@/components/security/SCIMGroupMappingsCard";
import { AuditLogViewer } from "@/components/admin/AuditLogViewer";
import { AuditRetentionPolicy } from "@/components/admin/AuditRetentionPolicy";
import { OrgMFAPolicyCard } from "@/components/security/OrgMFAPolicyCard";
import { OrgSessionPolicyCard } from "@/components/security/OrgSessionPolicyCard";
import { ActiveSessionsCard } from "@/components/security/ActiveSessionsCard";
import { SIEMExportersCard } from "@/components/security/SIEMExportersCard";
import { useOrganization } from "@/hooks/useOrganization";
import { ShieldCheck, Activity, Key, Lock, Monitor, Cable } from "lucide-react";

export default function SecurityCenter() {
  const { currentOrganization } = useOrganization();
  return (
    <AppLayout
      title="Security & Access"
      subtitle="SSO, MFA, sessions, SCIM provisioning, audit logs, and SIEM streaming"
    >
      <Tabs defaultValue="sso" className="space-y-6">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="sso" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            SSO
          </TabsTrigger>
          <TabsTrigger value="mfa" className="gap-2">
            <Lock className="h-4 w-4" />
            MFA
          </TabsTrigger>
          <TabsTrigger value="sessions" className="gap-2">
            <Monitor className="h-4 w-4" />
            Sessions
          </TabsTrigger>
          <TabsTrigger value="scim" className="gap-2">
            <Key className="h-4 w-4" />
            SCIM
          </TabsTrigger>
          <TabsTrigger value="siem" className="gap-2">
            <Cable className="h-4 w-4" />
            SIEM Export
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <Activity className="h-4 w-4" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sso" className="space-y-4">
          <SSOConfigCard />
        </TabsContent>

        <TabsContent value="mfa" className="space-y-4">
          <OrgMFAPolicyCard />
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <OrgSessionPolicyCard />
          {currentOrganization && (
            <ActiveSessionsCard scope="org" organizationId={currentOrganization.id} />
          )}
        </TabsContent>

        <TabsContent value="scim" className="space-y-4">
          <SCIMTokensCard />
          <SCIMGroupMappingsCard />
        </TabsContent>

        <TabsContent value="siem" className="space-y-4">
          <SIEMExportersCard />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <AuditRetentionPolicy scope="org" />
          <AuditLogViewer scope="org" />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
