import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Paperclip, Upload, Download, Trash2, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const BUCKET = "helpdesk-attachments";
const MAX_BYTES = 25 * 1024 * 1024; // 25MB

function formatSize(bytes?: number | null) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface Props {
  ticketId: string;
  organizationId: string;
}

export function TicketAttachments({ ticketId, organizationId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ["helpdesk-attachments", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("helpdesk_ticket_attachments")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!ticketId,
  });

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name} exceeds 25MB limit`);
          continue;
        }
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${organizationId}/${ticketId}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) {
          toast.error(`Failed to upload ${file.name}: ${upErr.message}`);
          continue;
        }
        const { error: insErr } = await supabase.from("helpdesk_ticket_attachments").insert({
          ticket_id: ticketId,
          organization_id: organizationId,
          uploaded_by: user.id,
          storage_path: path,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type || null,
        });
        if (insErr) {
          await supabase.storage.from(BUCKET).remove([path]);
          toast.error(`Failed to record ${file.name}: ${insErr.message}`);
          continue;
        }
      }
      toast.success("Attachments uploaded");
      qc.invalidateQueries({ queryKey: ["helpdesk-attachments", ticketId] });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownload = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
    if (error || !data?.signedUrl) {
      toast.error("Could not generate download link");
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = name;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleDelete = async (id: string, path: string) => {
    if (!confirm("Delete this attachment?")) return;
    const { error: delErr } = await supabase.from("helpdesk_ticket_attachments").delete().eq("id", id);
    if (delErr) {
      toast.error(delErr.message);
      return;
    }
    await supabase.storage.from(BUCKET).remove([path]);
    toast.success("Attachment removed");
    qc.invalidateQueries({ queryKey: ["helpdesk-attachments", ticketId] });
  };

  const isImage = (mime?: string | null) => !!mime && mime.startsWith("image/");

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Paperclip className="h-4 w-4" /> Attachments
          {attachments.length > 0 && <Badge variant="secondary">{attachments.length}</Badge>}
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          Upload
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No attachments yet. Max 25MB per file.</p>
      ) : (
        <div className="space-y-2">
          {attachments.map((a: any) => (
            <div
              key={a.id}
              className={cn(
                "flex items-center gap-3 p-2 rounded-md border bg-background hover:bg-muted/40 transition"
              )}
            >
              <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                {isImage(a.mime_type) ? (
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <FileText className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{a.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(a.file_size)} · {format(new Date(a.created_at), "PP")}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => handleDownload(a.storage_path, a.file_name)}>
                <Download className="h-4 w-4" />
              </Button>
              {a.uploaded_by === user?.id && (
                <Button size="icon" variant="ghost" onClick={() => handleDelete(a.id, a.storage_path)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
