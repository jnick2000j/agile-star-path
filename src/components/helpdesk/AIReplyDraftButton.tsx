import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  ticketId: string;
  onDraft: (text: string) => void;
}

export function AIReplyDraftButton({ ticketId, onDraft }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tone, setTone] = useState("professional");
  const [length, setLength] = useState("medium");
  const [intent, setIntent] = useState("reply");
  const [customInstructions, setCustomInstructions] = useState("");

  const generate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-reply-draft", {
        body: { ticketId, tone, length, intent, customInstructions },
      });
      if (error) {
        const msg = (error as any)?.context?.body || error.message || "Draft failed";
        toast.error(typeof msg === "string" ? msg : "Draft failed");
        return;
      }
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      if (data?.draft) {
        onDraft(data.draft);
        setOpen(false);
        const used = data.kbArticlesUsed?.length ?? 0;
        toast.success(used > 0 ? `Draft inserted (used ${used} KB article${used === 1 ? "" : "s"})` : "Draft inserted");
      } else {
        toast.error("No draft returned");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Draft failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" type="button">
          <Sparkles className="h-4 w-4 mr-2" />
          AI Draft
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 space-y-3" align="end">
        <div className="space-y-1">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <Wand2 className="h-4 w-4" /> Draft a reply
          </h4>
          <p className="text-xs text-muted-foreground">
            AI will use the ticket history and relevant KB articles.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Tone</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="empathetic">Empathetic</SelectItem>
                <SelectItem value="technical">Technical</SelectItem>
                <SelectItem value="apologetic">Apologetic</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Length</Label>
            <Select value={length} onValueChange={setLength}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="short">Short</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="long">Long</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Intent</Label>
          <Select value={intent} onValueChange={setIntent}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="reply">Reply to latest message</SelectItem>
              <SelectItem value="acknowledge">Acknowledge & set expectations</SelectItem>
              <SelectItem value="request_info">Request more information</SelectItem>
              <SelectItem value="resolve">Provide resolution</SelectItem>
              <SelectItem value="escalate">Notify of escalation</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Custom instructions (optional)</Label>
          <Textarea
            rows={2}
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            placeholder="e.g., Mention the maintenance window on Friday"
            className="text-sm"
          />
        </div>

        <Button onClick={generate} disabled={loading} className="w-full" size="sm">
          {loading ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…</>
          ) : (
            <><Sparkles className="h-4 w-4 mr-2" /> Generate draft</>
          )}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
