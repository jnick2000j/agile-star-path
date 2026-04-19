import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Send, Trash2, Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface OrgUser {
  user_id: string;
  full_name: string | null;
  email: string;
}

interface CommentRow {
  id: string;
  approval_id: string;
  author_id: string;
  comment: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  approvalId: string;
  organizationId: string | null;
  orgUsers: OrgUser[];
}

function getInitials(name?: string | null, email?: string | null) {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  if (email) return email[0].toUpperCase();
  return "?";
}

export function DecisionComments({ approvalId, organizationId, orgUsers }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  const queryKey = ["workflow-approval-comments", approvalId];

  const { data: comments = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_approval_comments")
        .select("*")
        .eq("approval_id", approvalId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as CommentRow[];
    },
    enabled: !!approvalId && open,
  });

  // Always fetch the count for the toggle badge
  const { data: count = 0 } = useQuery({
    queryKey: [...queryKey, "count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("workflow_approval_comments")
        .select("id", { count: "exact", head: true })
        .eq("approval_id", approvalId);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!approvalId,
  });

  const addComment = useMutation({
    mutationFn: async () => {
      const text = newComment.trim();
      if (!text) throw new Error("Comment is empty");
      const { error } = await supabase.from("workflow_approval_comments").insert({
        approval_id: approvalId,
        author_id: user!.id,
        organization_id: organizationId,
        comment: text,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewComment("");
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: [...queryKey, "count"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateComment = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      const { error } = await supabase
        .from("workflow_approval_comments")
        .update({ comment: text })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditingId(null);
      setEditingText("");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("workflow_approval_comments")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: [...queryKey, "count"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const userName = (uid: string) => {
    const u = orgUsers.find((o) => o.user_id === uid);
    return u?.full_name || u?.email || uid.slice(0, 8);
  };

  return (
    <div className="pt-2 border-t border-border">
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs"
        onClick={() => setOpen((o) => !o)}
      >
        <MessageSquare className="h-3.5 w-3.5 mr-1" />
        Comments {count > 0 && <span className="ml-1 text-muted-foreground">({count})</span>}
      </Button>

      {open && (
        <div className="mt-2 space-y-2">
          {comments.map((c) => {
            const u = orgUsers.find((o) => o.user_id === c.author_id);
            const isAuthor = c.author_id === user?.id;
            const isEditing = editingId === c.id;
            return (
              <div key={c.id} className="flex gap-2 rounded-md bg-muted/40 p-2">
                <Avatar className="h-6 w-6 mt-0.5">
                  <AvatarFallback className="text-[10px]">
                    {getInitials(u?.full_name, u?.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium">{userName(c.author_id)}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(c.created_at), "PPp")}
                        {c.updated_at !== c.created_at && " · edited"}
                      </span>
                    </div>
                    {isAuthor && !isEditing && (
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => {
                            setEditingId(c.id);
                            setEditingText(c.comment);
                          }}
                          aria-label="Edit comment"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => deleteComment.mutate(c.id)}
                          aria-label="Delete comment"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="mt-1 space-y-1">
                      <Textarea
                        rows={2}
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                      />
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          className="h-7 px-2"
                          onClick={() =>
                            updateComment.mutate({ id: c.id, text: editingText.trim() })
                          }
                          disabled={!editingText.trim()}
                        >
                          <Check className="h-3 w-3 mr-1" /> Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => {
                            setEditingId(null);
                            setEditingText("");
                          }}
                        >
                          <X className="h-3 w-3 mr-1" /> Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs mt-0.5 whitespace-pre-wrap break-words">
                      {c.comment}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {comments.length === 0 && (
            <p className="text-xs text-muted-foreground italic px-1">
              No comments yet — start the discussion.
            </p>
          )}

          <div className="flex gap-2">
            <Textarea
              rows={2}
              placeholder="Add a comment to this decision…"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="text-sm"
            />
            <Button
              size="sm"
              onClick={() => addComment.mutate()}
              disabled={!newComment.trim() || addComment.isPending}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
