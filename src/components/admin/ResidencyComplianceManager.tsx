import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { Lock, Unlock, MapPin, ShieldCheck, Download, Plus, Trash2, AlertTriangle } from "lucide-react";

const REGIONS = [
  { value: "global", label: "Global (no restriction)" },
  { value: "eu", label: "European Union" },
  { value: "us", label: "United States" },
  { value: "uk", label: "United Kingdom" },
  { value: "apac", label: "Asia-Pacific" },
  { value: "ca", label: "Canada" },
];

const STANDARDS = ["GDPR", "SOC2", "ISO27001", "HIPAA", "FedRAMP", "CCPA", "PIPEDA"];

interface OrgResidency {
  id: string;
  data_region: string;
  residency_enforcement: "warn" | "block";
  residency_locked_at: string | null;
  residency_locked_by: string | null;
  allow_cross_region_ai: boolean;
}

interface AuditEntry {
  id: string;
  operation: string;
  org_region: string;
  processing_region: string | null;
  decision: "allowed" | "warned" | "blocked";
  enforcement_mode: "warn" | "block";
  resource_type: string | null;
  created_at: string;
}

interface Attestation {
  id: string;
  standard: string;
  status: string;
  effective_from: string;
  expires_at: string | null;
  evidence_url: string | null;
  notes: string | null;
}

export function ResidencyComplianceManager() {
  const { currentOrganization } = useOrganization();
  const [org, setOrg] = useState<OrgResidency | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [attestations, setAttestations] = useState<Attestation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attestOpen, setAttestOpen] = useState(false);
  const [attestForm, setAttestForm] = useState({ standard: "GDPR", evidence_url: "", notes: "", expires_at: "" });

  useEffect(() => {
    if (currentOrganization?.id) load();
  }, [currentOrganization?.id]);

  const load = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    const [{ data: orgRow }, { data: auditRows }, { data: attRows }] = await Promise.all([
      supabase
        .from("organizations")
        .select("id, data_region, residency_enforcement, residency_locked_at, residency_locked_by, allow_cross_region_ai")
        .eq("id", currentOrganization.id)
        .maybeSingle(),
      supabase
        .from("residency_audit_log")
        .select("id, operation, org_region, processing_region, decision, enforcement_mode, resource_type, created_at")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("compliance_attestations")
        .select("id, standard, status, effective_from, expires_at, evidence_url, notes")
        .eq("organization_id", currentOrganization.id)
        .order("standard"),
    ]);
    setOrg((orgRow as OrgResidency) ?? null);
    setAudit((auditRows as AuditEntry[]) ?? []);
    setAttestations((attRows as Attestation[]) ?? []);
    setLoading(false);
  };

  const updateOrg = async (patch: Partial<OrgResidency>) => {
    if (!org) return;
    setSaving(true);
    const { error } = await supabase.from("organizations").update(patch).eq("id", org.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Residency settings updated");
    load();
  };

  const toggleLock = async () => {
    if (!org) return;
    const isLocked = !!org.residency_locked_at;
    const { data: { user } } = await supabase.auth.getUser();
    await updateOrg({
      residency_locked_at: isLocked ? null : new Date().toISOString(),
      residency_locked_by: isLocked ? null : user?.id ?? null,
    });
  };

  const createAttestation = async () => {
    if (!currentOrganization?.id) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("compliance_attestations").insert({
      organization_id: currentOrganization.id,
      standard: attestForm.standard,
      evidence_url: attestForm.evidence_url || null,
      notes: attestForm.notes || null,
      expires_at: attestForm.expires_at || null,
      created_by: user?.id ?? null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Attestation added");
    setAttestOpen(false);
    setAttestForm({ standard: "GDPR", evidence_url: "", notes: "", expires_at: "" });
    load();
  };

  const removeAttestation = async (id: string) => {
    const { error } = await supabase.from("compliance_attestations").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Attestation removed");
    load();
  };

  const downloadEvidencePack = () => {
    if (!org || !currentOrganization) return;
    const pack = {
      generated_at: new Date().toISOString(),
      organization: { id: currentOrganization.id, name: currentOrganization.name },
      residency: {
        region: org.data_region,
        enforcement_mode: org.residency_enforcement,
        locked: !!org.residency_locked_at,
        locked_at: org.residency_locked_at,
        allow_cross_region_ai: org.allow_cross_region_ai,
      },
      attestations,
      recent_audit_events: audit.slice(0, 50),
    };
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compliance-evidence-${currentOrganization.name?.replace(/\s+/g, "_")}-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!currentOrganization) {
    return <Card><CardContent className="p-6 text-muted-foreground">Select an organization to manage residency.</CardContent></Card>;
  }
  if (loading || !org) {
    return <Card><CardContent className="p-6 text-muted-foreground">Loading…</CardContent></Card>;
  }

  const isLocked = !!org.residency_locked_at;
  const decisionVariant = (d: string) => d === "blocked" ? "destructive" : d === "warned" ? "secondary" : "outline";

  return (
    <div className="space-y-6">
      {/* Region & enforcement */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Data residency
                {isLocked ? <Badge variant="default" className="gap-1"><Lock className="h-3 w-3" />Locked</Badge>
                          : <Badge variant="outline" className="gap-1"><Unlock className="h-3 w-3" />Unlocked</Badge>}
              </CardTitle>
              <CardDescription>
                Pin this organization's data and AI processing to a single region. Hybrid enforcement: warn (allow + log) or block (refuse + log).
              </CardDescription>
            </div>
            <Button variant="outline" onClick={downloadEvidencePack}>
              <Download className="h-4 w-4 mr-2" />Evidence pack
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Region</Label>
              <Select
                value={org.data_region}
                disabled={isLocked || saving}
                onValueChange={(v) => updateOrg({ data_region: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REGIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {isLocked && <p className="text-xs text-muted-foreground">Region locked. Unlock to change.</p>}
            </div>
            <div className="space-y-2">
              <Label>Enforcement mode</Label>
              <Select
                value={org.residency_enforcement}
                disabled={saving}
                onValueChange={(v) => updateOrg({ residency_enforcement: v as "warn" | "block" })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="warn">Soft warn — allow & log</SelectItem>
                  <SelectItem value="block">Hard block — refuse & log</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Allow cross-region AI processing</p>
              <p className="text-xs text-muted-foreground">
                If off, AI calls processed outside the org region get blocked (or warned, per mode).
              </p>
            </div>
            <Switch
              checked={org.allow_cross_region_ai}
              disabled={saving}
              onCheckedChange={(v) => updateOrg({ allow_cross_region_ai: v })}
            />
          </div>

          {org.data_region !== "global" && org.residency_enforcement === "warn" && org.allow_cross_region_ai && (
            <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <p>Soft-warn mode is active. Off-region AI calls will succeed and be logged to the audit trail. Switch to <strong>block</strong> for strict residency.</p>
            </div>
          )}

          <div className="flex justify-end">
            <Button variant={isLocked ? "outline" : "default"} onClick={toggleLock} disabled={saving}>
              {isLocked ? <><Unlock className="h-4 w-4 mr-2" />Unlock region</> : <><Lock className="h-4 w-4 mr-2" />Lock region</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="audit">
        <TabsList>
          <TabsTrigger value="audit">Residency audit log</TabsTrigger>
          <TabsTrigger value="attestations">Compliance attestations</TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {audit.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">No residency events recorded yet.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Operation</TableHead>
                      <TableHead>Org region</TableHead>
                      <TableHead>Processed in</TableHead>
                      <TableHead>Decision</TableHead>
                      <TableHead>Mode</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audit.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs">{format(new Date(e.created_at), "PPp")}</TableCell>
                        <TableCell className="font-mono text-xs">{e.operation}</TableCell>
                        <TableCell><Badge variant="outline" className="uppercase">{e.org_region}</Badge></TableCell>
                        <TableCell><Badge variant="outline" className="uppercase">{e.processing_region ?? "—"}</Badge></TableCell>
                        <TableCell><Badge variant={decisionVariant(e.decision)}>{e.decision}</Badge></TableCell>
                        <TableCell className="text-xs capitalize">{e.enforcement_mode}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attestations" className="mt-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Compliance frameworks active for this organization.
            </p>
            <Dialog open={attestOpen} onOpenChange={setAttestOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add attestation</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add compliance attestation</DialogTitle>
                  <DialogDescription>Record a standard this organization adheres to.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Standard</Label>
                    <Select value={attestForm.standard} onValueChange={(v) => setAttestForm({ ...attestForm, standard: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STANDARDS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Evidence URL (optional)</Label>
                    <Input value={attestForm.evidence_url} onChange={(e) => setAttestForm({ ...attestForm, evidence_url: e.target.value })} placeholder="https://…" />
                  </div>
                  <div className="space-y-2">
                    <Label>Expires (optional)</Label>
                    <Input type="date" value={attestForm.expires_at} onChange={(e) => setAttestForm({ ...attestForm, expires_at: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Input value={attestForm.notes} onChange={(e) => setAttestForm({ ...attestForm, notes: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={createAttestation}>Add</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardContent className="p-0">
              {attestations.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">No attestations recorded.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Standard</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Effective from</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Evidence</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attestations.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.standard}</TableCell>
                        <TableCell><Badge variant={a.status === "active" ? "default" : "outline"}>{a.status}</Badge></TableCell>
                        <TableCell className="text-xs">{a.effective_from}</TableCell>
                        <TableCell className="text-xs">{a.expires_at ?? "—"}</TableCell>
                        <TableCell className="text-xs">
                          {a.evidence_url ? <a href={a.evidence_url} target="_blank" rel="noreferrer" className="underline">View</a> : "—"}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeAttestation(a.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
