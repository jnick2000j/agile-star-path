import { useState, useMemo, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Sparkles, Send, BookOpen } from "lucide-react";
import { toast } from "sonner";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function HelpSubmit() {
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [step, setStep] = useState<"compose" | "deflect" | "review">("compose");

  const debouncedSubject = useDebounce(subject, 400);

  // Live KB suggestions while user types subject
  const { data: suggestions = [] } = useQuery({
    queryKey: ["help-deflect-suggestions", debouncedSubject],
    queryFn: async () => {
      if (debouncedSubject.trim().length < 4) return [];
      const { data } = await supabase
        .from("kb_articles")
        .select("id, title, summary, category")
        .eq("visibility", "public")
        .eq("status", "published")
        .or(`title.ilike.%${debouncedSubject}%,summary.ilike.%${debouncedSubject}%,body.ilike.%${debouncedSubject}%`)
        .limit(5);
      return data ?? [];
    },
    enabled: debouncedSubject.trim().length >= 4,
  });

  const submitTicket = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Please sign in to submit a request");
      if (!currentOrganization?.id) throw new Error("Organization context missing");
      const { data, error } = await supabase
        .from("helpdesk_tickets")
        .insert({
          organization_id: currentOrganization.id,
          subject,
          description,
          priority,
          status: "open",
          ticket_type: "incident",
          reporter_user_id: user.user.id,
          source: "portal",
        } as any)
        .select("id, reference_number")
        .single();
      if (error) throw error;
      // log deflection (no resolution)
      await supabase.from("kb_ticket_deflections").insert({
        organization_id: currentOrganization.id,
        search_query: subject,
        user_id: user.user.id,
        resolved_without_ticket: false,
        ticket_id: data.id,
      } as any);
      return data;
    },
    onSuccess: (t: any) => {
      toast.success(`Request ${t.reference_number} submitted`);
      navigate("/help/my-tickets");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const proceedFromCompose = () => {
    if (!subject.trim()) {
      toast.error("Please enter a subject");
      return;
    }
    if (suggestions.length > 0) {
      setStep("deflect");
    } else {
      setStep("review");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/help")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Help Center
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold mb-2">Submit a Request</h1>
        <p className="text-sm text-muted-foreground mb-8">
          {step === "compose" && "Tell us what you need help with"}
          {step === "deflect" && "We found articles that might answer your question"}
          {step === "review" && "Review and submit your request"}
        </p>

        {step === "compose" && (
          <Card className="p-6 space-y-4">
            <div>
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief summary" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} placeholder="What's happening? Include any error messages or steps you've already tried." />
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={proceedFromCompose} disabled={!subject.trim()}>
              Continue <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Card>
        )}

        {step === "deflect" && (
          <div className="space-y-4">
            <Card className="p-6 bg-primary/5 border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">These might help</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Before submitting, take a look at these articles. You may find your answer right away.
              </p>
              <div className="space-y-2">
                {suggestions.map((a: any) => (
                  <Link
                    key={a.id}
                    to={`/help/article/${a.id}`}
                    className="flex items-center justify-between p-3 bg-card border rounded hover:border-primary/40 transition"
                  >
                    <div className="flex items-start gap-3">
                      <BookOpen className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <div className="font-medium text-sm">{a.title}</div>
                        {a.summary && <div className="text-xs text-muted-foreground line-clamp-1">{a.summary}</div>}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </Card>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("compose")}>Back</Button>
              <Button onClick={() => setStep("review")}>None of these helped — continue</Button>
            </div>
          </div>
        )}

        {step === "review" && (
          <Card className="p-6 space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Subject</Label>
              <p className="font-medium">{subject}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Priority</Label>
              <p className="font-medium capitalize">{priority}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <p className="text-sm whitespace-pre-wrap">{description || <em className="text-muted-foreground">No description</em>}</p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep("compose")}>Edit</Button>
              <Button onClick={() => submitTicket.mutate()} disabled={submitTicket.isPending}>
                <Send className="h-4 w-4 mr-2" />
                {submitTicket.isPending ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
