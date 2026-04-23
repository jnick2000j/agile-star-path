import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitBranch, Sparkles, Lock, ListChecks, Inbox } from "lucide-react";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { AIIntakeChat } from "@/components/intake/AIIntakeChat";
import { useOrgAccessLevel } from "@/hooks/useOrgAccessLevel";

export default function ChangeControlPortal() {
  const { accessLevel, loading: accessLoading } = useOrgAccessLevel();

  const canRaise = ["admin", "manager", "editor"].includes(accessLevel ?? "");

  return (
    <AppLayout title="Change Control Portal" subtitle="Raise and track your change requests">
      <div className="space-y-6 max-w-4xl">
        <ViewSwitcher
          current="portal"
          tabs={[
            { key: "register", label: "Change Register", to: "/change-management", icon: ListChecks },
            { key: "portal", label: "Raise a change (AI)", to: "/change-management/portal", icon: Sparkles },
            { key: "mine", label: "My changes", to: "/change-management/my-changes", icon: Inbox },
          ]}
        />
        <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <GitBranch className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                Need to raise a change?
                <Badge variant="secondary" className="text-xs">
                  <Sparkles className="h-3 w-3 mr-1" /> AI-assisted
                </Badge>
              </h2>
              <p className="text-sm text-muted-foreground">
                Chat with the assistant — it'll capture the details and draft a CAB-ready change request.
              </p>
            </div>
          </div>
        </Card>

        {accessLoading ? (
          <Card className="p-6 text-center text-muted-foreground text-sm">Loading…</Card>
        ) : canRaise ? (
          <AIIntakeChat
            intent="change_request"
            greeting="Hi! I'll help you draft a change request. What change are you proposing, and why is it needed?"
          />
        ) : (
          <Card className="p-6 flex items-center gap-3 border-warning/30 bg-warning/5">
            <Lock className="h-5 w-5 text-warning" />
            <div>
              <p className="font-medium text-sm">You don't have permission to raise change requests.</p>
              <p className="text-xs text-muted-foreground">
                Ask an organization admin or manager to grant you editor access.
              </p>
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
