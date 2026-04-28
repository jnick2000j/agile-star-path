import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Show me what's overdue across my projects",
  "Help me start a new programme",
  "Walk me through raising a change request",
  "What should I focus on this week?",
];

const GREETING: Msg = {
  role: "assistant",
  content: "👋 Hi! I'm **the Task Master**. What do you want to do today? Pick a suggestion or type your own question.",
};

export function AskTaskMasterCard({ compact = false }: { compact?: boolean } = {}) {
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setStreaming(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        toast.error("Please sign in to chat with the Task Master");
        setStreaming(false);
        return;
      }

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/task-master-chat`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        // Strip the seeded greeting — it's UI-only context, not part of the model history
        body: JSON.stringify({ messages: next.filter((m) => m !== GREETING) }),
      });

      if (resp.status === 429) {
        toast.error("Rate limit reached. Please wait a moment and try again.");
        setStreaming(false);
        return;
      }
      if (resp.status === 402) {
        toast.error("AI credits exhausted. Please add funds to continue.");
        setStreaming(false);
        return;
      }
      if (!resp.ok || !resp.body) {
        toast.error("Couldn't reach the Task Master. Try again.");
        setStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantText = "";
      let done = false;

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const updateLast = (content: string) => {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content };
          return copy;
        });
      };

      while (!done) {
        const { done: rDone, value } = await reader.read();
        if (rDone) break;
        textBuffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, nl);
          textBuffer = textBuffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantText += delta;
              updateLast(assistantText);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Something went wrong while chatting.");
    } finally {
      setStreaming(false);
    }
  };

  return (
    <Card className={compact ? "p-3" : "p-6"}>
      <div className={`flex items-center gap-2 ${compact ? "mb-2" : "mb-3"}`}>
        <div className={`${compact ? "h-6 w-6" : "h-8 w-8"} rounded-lg bg-primary/10 flex items-center justify-center`}>
          <Sparkles className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} text-primary`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold ${compact ? "text-sm" : ""}`}>Ask the Task Master</h3>
          {!compact && (
            <p className="text-xs text-muted-foreground">Your AI guide to PRINCE2, MSP, Agile and the platform</p>
          )}
        </div>
        {compact && (
          <p className="text-xs text-muted-foreground hidden sm:block">What do you want to do today?</p>
        )}
      </div>

      {(!compact || messages.length > 1) && (
        <div
          ref={scrollRef}
          className={`${compact ? "max-h-48" : "h-64"} overflow-y-auto rounded-md border bg-muted/20 p-3 space-y-3 mb-3`}
        >
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm"
                    : "max-w-[90%] rounded-lg bg-background border px-3 py-2 text-sm prose prose-sm dark:prose-invert prose-p:my-1 prose-ul:my-1 max-w-none"
                }
              >
                {m.role === "assistant" ? (
                  <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))}
          {streaming && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
            </div>
          )}
        </div>
      )}

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {SUGGESTIONS.map((s) => (
            <Button
              key={s}
              type="button"
              size="sm"
              variant="outline"
              className="text-xs h-7"
              onClick={() => send(s)}
              disabled={streaming}
            >
              {s}
            </Button>
          ))}
        </div>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the Task Master anything…"
          className="min-h-[40px] max-h-32 resize-none"
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          disabled={streaming}
        />
        <Button type="submit" size="icon" disabled={streaming || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </Card>
  );
}
