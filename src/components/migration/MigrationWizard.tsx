import { useCallback, useState } from "react";
import { MappingEditor, type MappingValidationResult } from "./MappingEditor";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, CheckCircle2, Loader2, ChevronRight, ChevronLeft, Plug } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { listMigrationSources, getMigrationSource } from "@/lib/migration/registry";
import type {
  FieldMapping,
  ImportSummary,
  MigrationCredentials,
  MigrationFiles,
  MigrationScope,
  RemoteProject,
} from "@/lib/migration/types";
import { createMigrationJob, runMigrationJob } from "@/lib/migration/runner";
import { toast } from "sonner";

type Step = "source" | "connect" | "scope" | "mapping" | "preview" | "running" | "done";

export function MigrationWizard({
  open,
  onOpenChange,
  onCompleted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCompleted?: () => void;
}) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>("source");
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [creds, setCreds] = useState<MigrationCredentials>({});
  const [files, setFiles] = useState<MigrationFiles>({});
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [remoteProjects, setRemoteProjects] = useState<RemoteProject[]>([]);
  const [scope, setScope] = useState<MigrationScope>({ selectedProjectIds: [], includeClosed: false });
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [mappingValid, setMappingValid] = useState<MappingValidationResult>({ ok: true, errors: [] });
  const handleValidate = useCallback((r: MappingValidationResult) => setMappingValid(r), []);
  const [progress, setProgress] = useState({ done: 0, total: 0, message: "" });
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const reset = () => {
    setStep("source");
    setSourceId(null);
    setCreds({});
    setFiles({});
    setTestError(null);
    setRemoteProjects([]);
    setScope({ selectedProjectIds: [], includeClosed: false });
    setMapping({});
    setProgress({ done: 0, total: 0, message: "" });
    setSummary(null);
    setRunError(null);
    setTesting(false);
  };

  const close = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const adapter = sourceId ? getMigrationSource(sourceId) : undefined;

  const handleTest = async () => {
    if (!adapter) return;
    setTesting(true);
    setTestError(null);
    try {
      const projects = await adapter.testConnection(creds, files);
      setRemoteProjects(projects);
      const sug = await adapter.suggestMapping(creds, scope, files);
      setMapping(sug);
      setStep("scope");
    } catch (e: unknown) {
      setTestError(e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  };

  const start = async () => {
    if (!adapter || !currentOrganization?.id || !user?.id) return;
    setStep("running");
    setRunError(null);
    try {
      const job = await createMigrationJob({
        organizationId: currentOrganization.id,
        userId: user.id,
        source: adapter.id,
        sourceLabel: adapter.label,
        scope,
        mapping,
      });
      const res = await runMigrationJob(
        job.id,
        {
          organizationId: currentOrganization.id,
          userId: user.id,
          source: adapter.id,
          sourceLabel: adapter.label,
          scope,
          mapping,
          creds,
          files,
        },
        (done, total, message) => setProgress({ done, total, message }),
      );
      setSummary(res);
      setStep("done");
      if (res.errors.length) toast.warning(`Imported with ${res.errors.length} issue(s)`);
      else toast.success("Migration complete");
      onCompleted?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setRunError(msg);
      setStep("done");
      toast.error(msg);
    }
  };

  const sources = listMigrationSources();

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Migrate from another system</DialogTitle>
        </DialogHeader>

        {step === "source" && (
          <div className="space-y-3 overflow-y-auto pr-1">
            <p className="text-sm text-muted-foreground">
              Choose the system to import from. Each new run always creates new records — existing data is never overwritten.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {sources.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSourceId(s.id);
                    setStep("connect");
                  }}
                  className="text-left rounded-lg border p-4 hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-2 font-medium">
                    <Plug className="h-4 w-4 text-primary" />
                    {s.label}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "connect" && adapter && (
          <div className="space-y-4 overflow-y-auto pr-1">
            {adapter.id !== "csv" && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Browser-based connection</AlertTitle>
                <AlertDescription className="text-xs">
                  For larger imports we recommend running through a backend proxy to avoid CORS and rate limits.
                  Credentials are kept in memory only and never stored.
                </AlertDescription>
              </Alert>
            )}
            {adapter.credentialFields.map((f) => (
              <div key={f.name} className="space-y-1">
                <Label htmlFor={`mig-${f.name}`}>
                  {f.label}
                  {f.required && <span className="text-destructive"> *</span>}
                </Label>
                {f.type === "file" ? (
                  <>
                    <Input
                      id={`mig-${f.name}`}
                      type="file"
                      accept={f.accept}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) {
                          const next = { ...files };
                          delete next[f.name];
                          setFiles(next);
                          return;
                        }
                        const text = await file.text();
                        setFiles({ ...files, [f.name]: { name: file.name, text } });
                      }}
                    />
                    {files[f.name] && (
                      <p className="text-[11px] text-muted-foreground">
                        Loaded: {files[f.name].name}
                      </p>
                    )}
                  </>
                ) : (
                  <Input
                    id={`mig-${f.name}`}
                    type={f.type === "password" ? "password" : "text"}
                    placeholder={f.placeholder}
                    value={creds[f.name] ?? ""}
                    onChange={(e) => setCreds({ ...creds, [f.name]: e.target.value })}
                  />
                )}
                {f.helpText && <p className="text-[11px] text-muted-foreground">{f.helpText}</p>}
              </div>
            ))}
            {testError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Connection failed</AlertTitle>
                <AlertDescription className="text-xs">{testError}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep("source")}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={handleTest} disabled={testing}>
                {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Test & continue
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "scope" && (
          <div className="space-y-3 overflow-hidden flex flex-col">
            <p className="text-sm text-muted-foreground">
              Pick which projects/boards to import. {remoteProjects.length} found.
            </p>
            <div className="flex items-center gap-2 text-sm">
              <Checkbox
                id="include-closed"
                checked={!!scope.includeClosed}
                onCheckedChange={(v) => setScope({ ...scope, includeClosed: !!v })}
              />
              <Label htmlFor="include-closed" className="cursor-pointer">Include closed/done items</Label>
            </div>
            <ScrollArea className="flex-1 max-h-[45vh] border rounded-md p-2">
              <ul className="space-y-1">
                {remoteProjects.map((p) => {
                  const checked = scope.selectedProjectIds?.includes(p.id);
                  return (
                    <li key={p.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          const set = new Set(scope.selectedProjectIds ?? []);
                          if (v) set.add(p.id);
                          else set.delete(p.id);
                          setScope({ ...scope, selectedProjectIds: Array.from(set) });
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        {p.key && <p className="text-xs text-muted-foreground">{p.key}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep("connect")}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button
                disabled={!scope.selectedProjectIds?.length}
                onClick={() => setStep("mapping")}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "mapping" && adapter && (
          <div className="space-y-3 overflow-y-auto pr-1">
            <p className="text-sm text-muted-foreground">
              Review and adjust how source values map into the platform. Required fields must all be mapped before continuing.
            </p>
            <MappingEditor
              source={adapter.id}
              knownStatuses={
                ((mapping.extra as { discovered?: { statuses?: string[] } } | undefined)?.discovered?.statuses) ??
                Object.keys(mapping.status ?? {})
              }
              knownPriorities={
                ((mapping.extra as { discovered?: { priorities?: string[] } } | undefined)?.discovered?.priorities) ??
                Object.keys(mapping.priority ?? {})
              }
              knownIssueTypes={
                ((mapping.extra as { discovered?: { issueTypes?: string[] } } | undefined)?.discovered?.issueTypes)
              }
              showIssueTypeMapping={adapter.id === "jira"}
              value={mapping}
              onChange={setMapping}
              onValidate={handleValidate}
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep("scope")}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={() => setStep("preview")} disabled={!mappingValid.ok}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "preview" && adapter && (
          <PreviewStep
            onBack={() => setStep("mapping")}
            onStart={start}
            adapter={adapter}
            creds={creds}
            files={files}
            scope={scope}
          />
        )}

        {step === "running" && (
          <div className="space-y-3 py-4">
            <p className="text-sm">Importing… please don't close this window.</p>
            <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} className="h-2" />
            <p className="text-xs text-muted-foreground truncate">
              {progress.done} / {progress.total} — {progress.message}
            </p>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-3 overflow-y-auto">
            {runError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Migration failed</AlertTitle>
                <AlertDescription className="text-xs">{runError}</AlertDescription>
              </Alert>
            ) : summary ? (
              <>
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Migration complete</AlertTitle>
                  <AlertDescription className="text-xs">
                    Created {summary.createdProjects} project(s), {summary.createdTasks} task(s),{" "}
                    {summary.createdIssues} issue(s), {summary.createdRisks} risk(s).
                  </AlertDescription>
                </Alert>
                {summary.errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{summary.errors.length} issue(s)</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-4 text-xs space-y-0.5 max-h-40 overflow-y-auto">
                        {summary.errors.slice(0, 50).map((e, i) => (
                          <li key={i}>
                            <Badge variant="outline" className="mr-1 text-[10px]">{e.entity}</Badge>
                            {e.externalId}: {e.message}
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={reset}>Start another</Button>
              <Button onClick={() => close(false)}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PreviewStep({
  adapter,
  creds,
  files,
  scope,
  onBack,
  onStart,
}: {
  adapter: ReturnType<typeof getMigrationSource>;
  creds: MigrationCredentials;
  files?: MigrationFiles;
  scope: MigrationScope;
  onBack: () => void;
  onStart: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!adapter) return;
    setLoading(true);
    setError(null);
    try {
      const r = await adapter.preview(creds, scope, files);
      setCounts(r.counts as Record<string, number>);
      setWarnings(r.warnings ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 overflow-y-auto pr-1">
      <p className="text-sm text-muted-foreground">
        Estimate what will be imported. Click Run to start.
      </p>
      <Button variant="outline" size="sm" onClick={load} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        Estimate counts
      </Button>
      {Object.keys(counts).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(counts).map(([k, v]) => (
            <Badge key={k} variant="secondary" className="capitalize">{k}: {v}</Badge>
          ))}
        </div>
      )}
      {warnings.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{warnings.length} warning(s)</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 text-xs space-y-0.5">
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Preview failed</AlertTitle>
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}
      <DialogFooter>
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button onClick={onStart}>Run migration</Button>
      </DialogFooter>
    </div>
  );
}
