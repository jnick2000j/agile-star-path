import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles } from "lucide-react";
import { AIIntakeChat } from "@/components/intake/AIIntakeChat";

export default function PortalNewTicket() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const service = params.get("service");

  const greeting = service
    ? `Hi! You're requesting **${service}** from the Service Catalog. Tell me a bit about why you need it (e.g. who it's for, when, any specifics) and I'll draft the request for you.`
    : "Hi! I can help you raise a support ticket or request a service (new equipment, access, software, etc.). In a sentence or two, what do you need?";

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" /> Get IT Help
          </h1>
          <p className="text-sm text-muted-foreground">
            Describe what you need — the assistant will gather the right details, suggest knowledge-base articles,
            and open a ticket for you to confirm.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/portal")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>

      <AIIntakeChat
        intent="ticket"
        ticketRedirectBase="/portal/tickets"
        ticketSource="portal"
        greeting={greeting}
      />
    </div>
  );
}
