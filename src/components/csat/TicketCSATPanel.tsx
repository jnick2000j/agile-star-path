import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Send, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Props {
  ticket: { id: string; organization_id: string; status: string; requester_user_id?: string | null; requester_email?: string | null };
}

export function TicketCSATPanel({ ticket }: Props) {
  const [survey, setSurvey] = useState<any>(null);
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const eligible = ticket.status === "resolved" || ticket.status === "closed";

  const load = async () => {
    setLoading(true);
    const { data: s } = await (supabase as any)
      .from("helpdesk_csat_surveys")
      .select("*")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSurvey(s);
    if (s) {
      const { data: r } = await (supabase as any)
        .from("helpdesk_csat_responses")
        .select("*")
        .eq("survey_id", s.id)
        .maybeSingle();
      setResponse(r);
    } else {
      setResponse(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [ticket.id]);

  const sendSurvey = async () => {
    setCreating(true);
    const { data, error } = await (supabase as any)
      .from("helpdesk_csat_surveys")
      .insert({
        organization_id: ticket.organization_id,
        ticket_id: ticket.id,
        requester_user_id: ticket.requester_user_id || null,
        requester_email: ticket.requester_email || null,
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSurvey(data);
    toast.success("Survey created. Share the link with the requester.");
  };

  const copyLink = () => {
    const url = `${window.location.origin}/csat/${survey.token}`;
    navigator.clipboard.writeText(url);
    toast.success("Survey link copied");
  };

  if (!eligible) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Star className="h-4 w-4" /> Customer Satisfaction
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : !survey ? (
          <Button size="sm" onClick={sendSurvey} disabled={creating} className="w-full">
            {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Send CSAT Survey
          </Button>
        ) : response ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={cn(
                    "h-5 w-5",
                    response.rating >= n ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30",
                  )}
                />
              ))}
              <Badge variant="secondary" className="ml-2 capitalize">
                {response.sentiment?.replace(/_/g, " ")}
              </Badge>
            </div>
            {response.comment && (
              <p className="text-muted-foreground italic border-l-2 border-border pl-3">"{response.comment}"</p>
            )}
            <p className="text-xs text-muted-foreground">
              Responded {format(new Date(response.created_at), "PP")}
            </p>
            {response.follow_up_needed && !response.follow_up_resolved && (
              <Badge variant="destructive" className="text-xs">Follow-up needed</Badge>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Badge variant="outline">Survey sent — awaiting response</Badge>
            <Button size="sm" variant="outline" onClick={copyLink} className="w-full">
              <Copy className="h-4 w-4 mr-2" /> Copy Survey Link
            </Button>
            <p className="text-xs text-muted-foreground">
              Sent {survey.sent_at ? format(new Date(survey.sent_at), "PP") : "—"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
