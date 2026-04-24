import { AppLayout } from "@/components/layout/AppLayout";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { ListChecks, Sparkles, Inbox, Settings as SettingsIcon } from "lucide-react";
import { ChangeNotificationSettings } from "@/components/admin/ChangeNotificationSettings";
import { FeatureGate } from "@/components/billing/FeatureGate";

export default function ChangeManagementSettings() {
  return (
    <AppLayout
      title="Change Management Settings"
      subtitle="Configure notifications and required comments for change activity"
    >
      <FeatureGate
        feature="feature_change_management"
        title="Change Management"
        description="Premium module: standalone operational change control with approvals, CAB workflow, and risk scoring."
      >
        <div className="space-y-6">
          <ViewSwitcher
            current="settings"
            tabs={[
              { key: "register", label: "Change Register", to: "/change-management", icon: ListChecks },
              { key: "portal", label: "Raise a change (AI)", to: "/change-management/portal", icon: Sparkles },
              { key: "mine", label: "My changes", to: "/change-management/my-changes", icon: Inbox },
              { key: "settings", label: "Settings", to: "/change-management/settings", icon: SettingsIcon },
            ]}
          />
          <ChangeNotificationSettings />
        </div>
      </FeatureGate>
    </AppLayout>
  );
}
