// Upload one or more files. For each, upload to kb-attachments bucket then call
// kb-ingest-upload to create a draft article (text files are auto-extracted).
import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded?: () => void;
}

interface FileResult {
  name: string;
  status: "uploading" | "parsing" | "done" | "error";
  message?: string;
}

export function KBUploadDialog({ open, onOpenChange, onUploaded }: Props) {
  const { currentOrganization } = useOrganization();
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileResult[]>([]);
  const [busy, setBusy] = useState(false);

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentOrganization?.id) return;
    const list = Array.from(e.target.files ?? []);
    if (!list.length) return;
    setBusy(true);
    const results: FileResult[] = list.map((f) => ({ name: f.name, status: "uploading" }));
    setFiles(results);

    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      const path = `${currentOrganization.id}/${Date.now()}-${file.name}`;
      try {
        const { error: upErr } = await supabase.storage
          .from("kb-attachments")
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) throw new Error(upErr.message);

        results[i] = { name: file.name, status: "parsing" };
        setFiles([...results]);

        const { data, error } = await supabase.functions.invoke("kb-ingest-upload", {
          body: {
            storage_path: path,
            file_name: file.name,
            organization_id: currentOrganization.id,
            mime_type: file.type,
          },
        });
        if (error) throw new Error(error.message);

        // Trigger embedding for parsed text files
        if (data?.parsed && data?.article?.id) {
          supabase.functions.invoke("kb-embed", { body: { article_id: data.article.id } })
            .catch(() => {});
        }

        results[i] = {
          name: file.name,
          status: "done",
          message: data?.parsed ? "Parsed & draft created" : "Draft created (add text body to enable AI search)",
        };
        setFiles([...results]);
      } catch (e: any) {
        results[i] = { name: file.name, status: "error", message: e.message };
        setFiles([...results]);
      }
    }
    setBusy(false);
    onUploaded?.();
    if (fileRef.current) fileRef.current.value = "";
    toast.success("Upload complete — review drafts in the knowledgebase");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload knowledgebase documents</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload .md, .txt, or .html files for automatic text extraction and AI indexing. PDF/DOCX
            files are stored as attachments — paste the text into the article body to enable AI search.
          </p>
          <Label
            htmlFor="kb-files"
            className="flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 cursor-pointer hover:bg-accent/30 transition"
          >
            <Upload className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm font-medium">Click to choose files</span>
            <span className="text-xs text-muted-foreground">Multiple files supported</span>
          </Label>
          <input
            id="kb-files"
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            accept=".md,.markdown,.txt,.html,.htm,.json,.pdf,.docx"
            onChange={handleSelect}
          />

          {files.length > 0 && (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {files.map((f) => (
                <div key={f.name} className="flex items-center gap-2 rounded border p-2 text-sm">
                  {f.status === "done" && <CheckCircle2 className="h-4 w-4 text-success shrink-0" />}
                  {f.status === "error" && <AlertCircle className="h-4 w-4 text-destructive shrink-0" />}
                  {(f.status === "uploading" || f.status === "parsing") && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                  )}
                  {!["done", "error", "uploading", "parsing"].includes(f.status) && (
                    <FileText className="h-4 w-4 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{f.name}</p>
                    {f.message && <p className="text-xs text-muted-foreground">{f.message}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {busy ? "Uploading…" : "Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
