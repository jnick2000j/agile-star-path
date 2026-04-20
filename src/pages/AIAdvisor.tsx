import { useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, Sparkles, Wrench, Plus, Loader2, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { formatDistanceToNow } from "date-fns";

interface Conversation { id: string; title: string | null; updated_at: string; }
interface ChatMessage {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  tool_calls?: Array<{ name: string; args: unknown; result: unknown }> | null;
  created_at?: string;
}

export default function AIAdvisor() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConvos = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("ai_advisor_conversations").select("id,title,updated_at")
      .eq("user_id", user.id).order("updated_at", { ascending: false }).limit(50);
    setConvos((data ?? []) as Conversation[]);
    if (!activeId && data && data.length > 0) setActiveId(data[0].id);
  };

  const loadMessages = async (convoId: string) => {
    const { data } = await supabase
      .from("ai_advisor_messages").select("*")
      .eq("conversation_id", convoId).order("created_at");
    setMessages((data ?? []) as unknown as ChatMessage[]);
  };

  useEffect(() => { loadConvos(); /* eslint-disable-next-line */ }, [user?.id]);
  useEffect(() => { if (activeId) loadMessages(activeId); }, [activeId]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  const newConversation = async () => {
    if (!user || !currentOrganization?.id) return;
    const { data, error } = await supabase
      .from("ai_advisor_conversations")
      .insert({ user_id: user.id, organization_id: currentOrganization.id, title: "New chat" })
      .select().single();
    if (error) { toast.error("Couldn't create conversation"); return; }
    setActiveId(data.id);
    setMessages([]);
    loadConvos();
  };

  const send = async () => {
    if (!input.trim() || !user || !currentOrganization?.id) return;
    let convoId = activeId;
    if (!convoId) {
      const { data, error } = await supabase
        .from("ai_advisor_conversations")
        .insert({ user_id: user.id, organization_id: currentOrganization.id, title: input.slice(0, 60) })
        .select().single();
      if (error) { toast.error("Couldn't start conversation"); return; }
      convoId = data.id;
      setActiveId(convoId);
    }
    const userMsg: ChatMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    const sentInput = input;
    setInput("");
    setSending(true);

    const { data, error } = await supabase.functions.invoke("ai-advisor", {
      body: {
        conversation_id: convoId,
        organization_id: currentOrganization.id,
        messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
      },
    });
    setSending(false);
    if (error || data?.error) {
      toast.error(data?.error ?? "AI Advisor failed");
      setMessages((prev) => prev.filter((m) => m !== userMsg));
      setInput(sentInput);
      return;
    }
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: data.content ?? "", tool_calls: data.tool_calls ?? null },
    ]);
    loadConvos();
  };

  return (
    <AppLayout title="AI Advisor" subtitle="Chat with an AI agent that can analyse your portfolio and take actions on your behalf.">
      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-180px)]">
        <div className="col-span-3 flex flex-col gap-2">
          <Button onClick={newConversation} size="sm" className="w-full">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New chat
          </Button>
          <ScrollArea className="flex-1">
            <div className="space-y-1">
              {convos.map((c) => (
                <button
                  key={c.id} onClick={() => setActiveId(c.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-start gap-2 ${
                    activeId === c.id ? "bg-secondary" : "hover:bg-muted"
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{c.title || "Untitled"}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(c.updated_at), { addSuffix: true })}
                    </p>
                  </div>
                </button>
              ))}
              {convos.length === 0 && (
                <p className="text-xs text-muted-foreground p-3">No conversations yet.</p>
              )}
            </div>
          </ScrollArea>
        </div>

        <Card className="col-span-9 flex flex-col">
          <CardContent className="flex-1 flex flex-col p-0">
            <ScrollArea className="flex-1 p-6" ref={scrollRef as never}>
              <div className="space-y-4 max-w-3xl mx-auto">
                {messages.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    <Bot className="h-10 w-10 mx-auto mb-3 text-primary/50" />
                    Ask anything about your portfolio. I can read data and take actions for you.
                  </div>
                )}
                {messages.map((m, idx) => (
                  <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-lg px-4 py-3 ${
                      m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}>
                      {m.role === "assistant" && m.tool_calls && Array.isArray(m.tool_calls) && m.tool_calls.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1">
                          {m.tool_calls.map((tc, i) => (
                            <Badge key={i} variant="outline" className="text-xs gap-1">
                              <Wrench className="h-2.5 w-2.5" /> {tc.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="prose prose-sm dark:prose-invert max-w-none break-words">
                        <ReactMarkdown>{m.content || "*(no response)*"}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-4 py-3 flex items-center gap-2 text-sm">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="border-t p-3">
              <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 max-w-3xl mx-auto">
                <Input
                  value={input} onChange={(e) => setInput(e.target.value)}
                  placeholder="e.g. List my unowned high-score risks, then create a task to review them."
                  disabled={sending}
                />
                <Button type="submit" disabled={sending || !input.trim()}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
              <p className="text-xs text-muted-foreground text-center mt-2 flex items-center justify-center gap-1">
                <Sparkles className="h-3 w-3" /> Actions are logged to AI Audit. Writes appear immediately and can be reverted from agent history.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
