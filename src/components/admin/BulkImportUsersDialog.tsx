import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle, CheckCircle2, Download, FileUp, Loader2, Upload, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { rowsToCsv as _unused, downloadBlob } from "@/lib/migration/runner";

// Re-export tiny CSV parser (RFC4180-ish) inlined to avoid pulling all of csv.ts.
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQ) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") { cur.push(field); field = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && src[i + 1] === "\n") i++;
        cur.push(field); rows.push(cur); cur = []; field = "";
      } else field += ch;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).filter((r) => r.some((c) => c.trim() !== "")).map((r) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => { o[h] = (r[i] ?? "").trim(); });
    return o;
  });
}

interface RowResult {
  index: number;
  email: string;
  status: "created" | "linked" | "skipped" | "error";
  user_id?: string;
  message?: string;
  email_sent?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function BulkImportUsersDialog({ onSuccess }: { onSuccess?: () => void }) {
  const { currentOrganization } = useOrganization();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<RowResult[] | null>(null);

  const reset = () => {
    setRows([]);
    setFileName(null);
    setResults(null);
    setRunning(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseCsv(text);
    setFileName(file.name);
    setRows(parsed);
    setResults(null);
  };

  const validation = useMemo(() => {
    const seen = new Set<string>();
    return rows.map((r) => {
      const issues: string[] = [];
      const email = (r.email ?? "").trim().toLowerCase();
      if (!email) issues.push("missing email");
      else if (!EMAIL_RE.test(email)) issues.push("invalid email");
      if (email && seen.has(email)) issues.push("duplicate in file");
      else if (email) seen.add(email);
      if (!r.first_name && !r.last_name) issues.push("missing name");
      const lvl = (r.access_level ?? "").toLowerCase();
      if (lvl && !["admin", "editor", "viewer"].includes(lvl)) {
        issues.push(`unknown access_level "${r.access_level}"`);
      }
      return { row: r, issues };
    });
  }, [rows]);

  const validCount = validation.filter((v) => v.issues.length === 0).length;
  const invalidCount = validation.length - validCount;

  const run = async () => {
    if (!validCount) return;
    setRunning(true);
    try {
      const goodRows = validation.filter((v) => v.issues.length === 0).map((v) => v.row);
      const { data, error } = await supabase.functions.invoke("bulk-create-users", {
        body: {
          rows: goodRows,
          organization_id: currentOrganization?.id,
          redirect_to: `${window.location.origin}/auth/confirm`,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const out = (data as any).rows as RowResult[];
      setResults(out);
      const s = (data as any).summary;
      toast.success(
        `Imported: ${s.created} created, ${s.linked} linked, ${s.errored} errored`,
      );
      onSuccess?.();
    } catch (e: any) {
      toast.error(e.message || "Bulk import failed");
    } finally {
      setRunning(false);
    }
  };

  const downloadResults = () => {
    if (!results) return;
    const headers = ["email", "status", "user_id", "email_sent", "message"];
    const lines = [headers.join(",")];
    for (const r of results) {
      lines.push([
        r.email,
        r.status,
        r.user_id ?? "",
        r.email_sent ? "true" : "",
        (r.message ?? "").replace(/"/g, '""'),
      ].map((v) => /[",\n]/.test(String(v)) ? `"${v}"` : String(v)).join(","));
    }
    downloadBlob(`bulk-import-results.csv`, lines.join("\n"), "text/csv");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Bulk import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Bulk import users
          </DialogTitle>
          <DialogDescription>
            Upload a CSV. Each valid row creates a user (or links an existing one) in
            your current organization and sends an invite email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto pr-1">
          <div className="rounded-md border bg-accent/30 p-3 flex items-start gap-3">
            <FileUp className="h-4 w-4 text-primary mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-medium">Need a starting point?</p>
              <p className="text-[11px] text-muted-foreground">
                Required headers: email, first_name, last_name. Optional: job_title,
                department, phone_number, location, organization_slug (platform admin
                only), access_level (admin/editor/viewer), custom_roles
                (semicolon-separated names), send_invite.
              </p>
              <Button asChild size="sm" variant="secondary" className="h-7 text-xs mt-2">
                <a href="/migration-templates/users.csv" download>
                  <Download className="h-3 w-3 mr-1" /> users.csv template
                </a>
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="bulk-file">CSV file</Label>
            <Input
              id="bulk-file"
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {fileName && (
              <p className="text-[11px] text-muted-foreground">Loaded: {fileName} — {rows.length} row(s)</p>
            )}
          </div>

          {rows.length > 0 && !results && (
            <>
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="secondary">{validCount} valid</Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive">{invalidCount} invalid</Badge>
                )}
              </div>
              <ScrollArea className="max-h-[35vh] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Access</TableHead>
                      <TableHead>Issues</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validation.map((v, i) => (
                      <TableRow key={i} className={v.issues.length ? "opacity-70" : ""}>
                        <TableCell>
                          {v.issues.length === 0
                            ? <CheckCircle2 className="h-4 w-4 text-success" />
                            : <AlertCircle className="h-4 w-4 text-destructive" />}
                        </TableCell>
                        <TableCell className="text-xs">{v.row.email}</TableCell>
                        <TableCell className="text-xs">
                          {[v.row.first_name, v.row.last_name].filter(Boolean).join(" ") || "—"}
                        </TableCell>
                        <TableCell className="text-xs">{v.row.access_level || "viewer"}</TableCell>
                        <TableCell className="text-xs text-destructive">
                          {v.issues.join("; ") || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </>
          )}

          {results && (
            <>
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Import complete</AlertTitle>
                <AlertDescription className="text-xs">
                  {results.filter((r) => r.status === "created").length} created,{" "}
                  {results.filter((r) => r.status === "linked").length} linked,{" "}
                  {results.filter((r) => r.status === "error").length} errored.
                </AlertDescription>
              </Alert>
              <ScrollArea className="max-h-[35vh] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Email sent</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{r.email}</TableCell>
                        <TableCell>
                          <Badge
                            variant={r.status === "error" ? "destructive" : r.status === "linked" ? "outline" : "default"}
                            className="text-[10px]"
                          >
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{r.email_sent ? "yes" : "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.message ?? ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter>
          {results ? (
            <>
              <Button variant="outline" onClick={downloadResults}>
                <Download className="h-4 w-4 mr-1" /> Download report
              </Button>
              <Button onClick={() => { setOpen(false); reset(); }}>Done</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={run} disabled={!validCount || running}>
                {running && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Import {validCount} user{validCount === 1 ? "" : "s"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
