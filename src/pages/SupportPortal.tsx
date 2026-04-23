import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LifeBuoy, Sparkles, Headset, Inbox } from "lucide-react";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { AIIntakeChat } from "@/components/intake/AIIntakeChat";
import { KBAssistant } from "@/components/kb/KBAssistant";

export default function SupportPortal() {
  return (
    <AppLayout title="Support Portal" subtitle="Get help and track your support requests">
      <div className="space-y-6 max-w-4xl">
        <ViewSwitcher
          current="portal"
          tabs={[
            { key: "console", label: "Agent console", to: "/support", icon: Headset },
            { key: "portal", label: "Get support (AI)", to: "/support/portal", icon: Sparkles },
            { key: "mine", label: "My tickets", to: "/support/my-tickets", icon: Inbox },
          ]}
        />
        <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <LifeBuoy className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                Need help?
                <Badge variant="secondary" className="text-xs">
                  <Sparkles className="h-3 w-3 mr-1" /> AI-assisted
                </Badge>
              </h2>
              <p className="text-sm text-muted-foreground">
                Describe your issue and the assistant will draft a ticket for you to review and submit.
              </p>
            </div>
          </div>
        </Card>

        <KBAssistant surface="portal" placeholder="Search the knowledgebase first…" />

        <AIIntakeChat
          intent="ticket"
          greeting="Hi! I'll help you raise a support ticket. In a sentence or two, what's going on?"
        />
      </div>
    </AppLayout>
  );
}
