import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, FileUp, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import {
  parseUpload, runImport, downloadText, SAMPLE_CSV, SAMPLE_JSON,
  type ImportSource, type ImportResult,
} from "@/lib/lmsImport";
import { toast } from "sonner";

type Step = "upload" | "preview" | "running" | "done";

export function LmsImportWizard({
  open, onOpenChange, onImported,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: () => void;
}) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("upload");
  const [parsing, setParsing] = useState(false);
  const [source, setSource] = useState<ImportSource | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0, message: "" });
  const [result, setResult] = useState<ImportResult | null>(null);

  const reset = () => {
    setStep("upload");
    setSource(null);
    setParseError(null);
    setProgress({ done: 0, total: 0, message: "" });
    setResult(null);
    setParsing(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setParseError(null);
    setParsing(true);
    try {
      const parsed = await parseUpload(file);
      if (!parsed.manifest.courses.length) {
        throw new Error("No courses found in the manifest.");
      }
      setSource(parsed);
      setStep("preview");
    } catch (e: any) {
      setParseError(e?.message ?? String(e));
    } finally {
      setParsing(false);
    }
  };

  const startImport = async () => {
    if (!source || !currentOrganization?.id || !user?.id) return;
    setStep("running");
    const res = await runImport(source, {
      organizationId: currentOrganization.id,
      userId: user.id,
      onProgress: (done, total, message) => setProgress({ done, total, message }),
    });
    setResult(res);
    setStep("done");
    if (res.errors.length === 0) {
      toast.success(`Imported ${res.createdCourses} course(s)`);
    } else {
      toast.warning(`Imported with ${res.errors.length} issue(s)`);
    }
    onImported();
  };

  const totals = source ? {
    courses: source.manifest.courses.length,
    modules: source.manifest.courses.reduce((s, c) => s + c.modules.length, 0),
    lessons: source.manifest.courses.reduce((s, c) => s + c.modules.reduce((ms, m) => ms + m.lessons.length, 0), 0),
    assets: source.assets.size,
  } : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import courses</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 overflow-y-auto pr-1">
            <p className="text-sm text-muted-foreground">
              Upload a <strong>.csv</strong>, <strong>.json</strong>, or <strong>.zip</strong> bundle.
              ZIPs must contain a <code>manifest.csv</code> or <code>manifest.json</code> at the root and any referenced media/document files.
              Each import always creates new courses.
            </p>

            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Templates</Label>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => downloadText("lms-import-template.csv", SAMPLE_CSV, "text/csv")}>
                  <Download className="h-4 w-4 mr-2" /> CSV template
                </Button>
                <Button size="sm" variant="outline" onClick={() => downloadText("lms-import-template.json", SAMPLE_JSON, "application/json")}>
                  <Download className="h-4 w-4 mr-2" /> JSON template
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Supported lesson types: <code>video_embed</code>, <code>video_upload</code>, <code>document</code>, <code>quiz</code>.
                Set <code>file_path</code> on a lesson to reference a file inside the ZIP (uploaded videos / documents).
                Quiz questions are not imported &mdash; create them in the quiz editor after import.
              </p>
            </div>

            <div>
              <Label htmlFor="lms-import-file">Choose file</Label>
              <Input
                id="lms-import-file"
                type="file"
                accept=".csv,.json,.zip,application/zip,text/csv,application/json"
                disabled={parsing}
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {parsing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Parsing upload…
              </div>
            )}
            {parseError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Could not parse file</AlertTitle>
                <AlertDescription className="text-xs">{parseError}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {step === "preview" && source && totals && (
          <div className="space-y-4 overflow-hidden flex flex-col">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{totals.courses} course(s)</Badge>
              <Badge variant="secondary">{totals.modules} module(s)</Badge>
              <Badge variant="secondary">{totals.lessons} lesson(s)</Badge>
              {totals.assets > 0 && <Badge variant="secondary">{totals.assets} asset file(s)</Badge>}
            </div>
            <ScrollArea className="flex-1 max-h-[50vh] border rounded-md p-2">
              <Accordion type="multiple" className="w-full">
                {source.manifest.courses.map((c, ci) => (
                  <AccordionItem key={ci} value={`c-${ci}`}>
                    <AccordionTrigger className="text-sm">
                      <span className="truncate">{c.title}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {c.modules.length} module(s) · {c.modules.reduce((s, m) => s + m.lessons.length, 0)} lesson(s)
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-2 pl-3 text-sm">
                        {c.modules.map((m, mi) => (
                          <li key={mi}>
                            <p className="font-medium">{m.title}</p>
                            <ul className="pl-4 text-xs text-muted-foreground space-y-0.5">
                              {m.lessons.map((l, li) => (
                                <li key={li} className="flex items-center gap-2">
                                  <Badge variant="outline" className="capitalize text-[10px]">{l.lesson_type.replace("_", " ")}</Badge>
                                  <span className="truncate">{l.title}</span>
                                  {l.file_path && <span className="italic">(file: {l.file_path})</span>}
                                </li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </ScrollArea>
            <DialogFooter>
              <Button variant="ghost" onClick={reset}>Start over</Button>
              <Button onClick={startImport}>
                <FileUp className="h-4 w-4 mr-2" /> Import {totals.courses} course(s)
              </Button>
            </DialogFooter>
          </div>
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

        {step === "done" && result && (
          <div className="space-y-3 overflow-y-auto">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Import complete</AlertTitle>
              <AlertDescription className="text-xs">
                Created {result.createdCourses} course(s), {result.createdModules} module(s),{" "}
                {result.createdLessons} lesson(s); uploaded {result.uploadedAssets} asset file(s).
              </AlertDescription>
            </Alert>
            {result.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{result.errors.length} issue(s)</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4 text-xs space-y-0.5 max-h-40 overflow-y-auto">
                    {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={reset}>Import another</Button>
              <Button onClick={() => handleClose(false)}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
