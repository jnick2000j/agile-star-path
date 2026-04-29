import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Star, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const SENTIMENT = ["very_dissatisfied", "dissatisfied", "neutral", "satisfied", "very_satisfied"];

export default function CSATSurvey() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [survey, setSurvey] = useState<any>(null);
  const [ticket, setTicket] = useState<any>(null);
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) return;
      const { data, error } = await (supabase as any)
        .from("helpdesk_csat_surveys")
        .select("*, helpdesk_tickets(reference_number, subject)")
        .eq("token", token)
        .maybeSingle();
      if (error || !data) {
        setError("Survey not found or has expired.");
      } else if (data.status === "completed") {
        setSubmitted(true);
        setSurvey(data);
      } else if (new Date(data.expires_at) < new Date()) {
        setError("This survey has expired.");
      } else {
        setSurvey(data);
        setTicket((data as any).helpdesk_tickets);
      }
      setLoading(false);
    })();
  }, [token]);

  const submit = async () => {
    if (!rating) {
      toast.error("Please select a rating");
      return;
    }
    setSubmitting(true);
    const sentiment = SENTIMENT[rating - 1];
    const { error: insErr } = await (supabase as any).from("helpdesk_csat_responses").insert({
      organization_id: survey.organization_id,
      survey_id: survey.id,
      ticket_id: survey.ticket_id,
      rating,
      sentiment,
      comment: comment || null,
      follow_up_needed: rating <= 2,
    });
    if (insErr) {
      toast.error(insErr.message);
      setSubmitting(false);
      return;
    }
    await supabase
      .from("helpdesk_csat_surveys")
      .update({ status: "completed", responded_at: new Date().toISOString() })
      .eq("id", survey.id);
    setSubmitted(true);
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center text-muted-foreground">{error}</CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
            <h2 className="text-xl font-semibold">Thank you for your feedback!</h2>
            <p className="text-sm text-muted-foreground">
              Your response has been recorded and will help us improve our service.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle>How was your support experience?</CardTitle>
          {ticket && (
            <p className="text-sm text-muted-foreground">
              Ticket {ticket.reference_number}: {ticket.subject}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="mb-3 block">Rate your experience</Label>
            <div className="flex gap-2 justify-center">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onMouseEnter={() => setHoverRating(n)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(n)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={cn(
                      "h-10 w-10",
                      (hoverRating || rating) >= n
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground/40",
                    )}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-center mt-2 text-sm text-muted-foreground capitalize">
                {SENTIMENT[rating - 1].replace(/_/g, " ")}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="comment">Any additional feedback? (optional)</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us what worked well or how we can improve..."
              rows={4}
              className="mt-2"
            />
          </div>

          <Button onClick={submit} disabled={submitting || !rating} className="w-full">
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit Feedback
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
