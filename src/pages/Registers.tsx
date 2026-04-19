import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { QuickActionTabs } from "@/components/QuickActionTabs";
import {
  AlertTriangle,
  Bug,
  Target,
  Users,
  FileText,
  Wrench,
  BookOpen,
} from "lucide-react";
import RiskRegister from "./RiskRegister";
import IssueRegister from "./IssueRegister";
import BenefitsRegister from "./BenefitsRegister";
import StakeholderRegister from "./StakeholderRegister";
import BusinessRequirements from "./BusinessRequirements";
import TechnicalRequirements from "./TechnicalRequirements";
import LessonsLearned from "./LessonsLearned";

const REGISTER_TABS = [
  { value: "risks", label: "Risks", icon: AlertTriangle },
  { value: "issues", label: "Issues", icon: Bug },
  { value: "benefits", label: "Benefits", icon: Target },
  { value: "stakeholders", label: "Stakeholders", icon: Users },
  { value: "business-req", label: "Business Req.", icon: FileText },
  { value: "technical-req", label: "Technical Req.", icon: Wrench },
  { value: "lessons", label: "Lessons", icon: BookOpen },
];

export default function Registers() {
  return (
    <AppLayout title="Registers" subtitle="PRINCE2 MSP registers and requirements management">
      <Tabs defaultValue="risks" className="space-y-6">
        <QuickActionTabs
          items={REGISTER_TABS}
          className="grid-cols-7 sm:grid-cols-7 md:grid-cols-7 lg:grid-cols-7"
        />

        <TabsContent value="risks">
          <RiskRegister embedded />
        </TabsContent>
        <TabsContent value="issues">
          <IssueRegister embedded />
        </TabsContent>
        <TabsContent value="benefits">
          <BenefitsRegister embedded />
        </TabsContent>
        <TabsContent value="stakeholders">
          <StakeholderRegister embedded />
        </TabsContent>
        <TabsContent value="business-req">
          <BusinessRequirements embedded />
        </TabsContent>
        <TabsContent value="technical-req">
          <TechnicalRequirements embedded />
        </TabsContent>
        <TabsContent value="lessons">
          <LessonsLearned embedded />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
