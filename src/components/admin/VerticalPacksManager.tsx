import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Layers, Plus, Sparkles, Package, Trash2, Building2, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { SEED_PACKS } from "@/lib/verticalSeedPacks";

const ALL_CORE_MODULES = [
  "programmes", "projects", "products", "features", "sprints", "backlog", "tasks",
  "timesheets", "helpdesk", "change_management", "itsm", "risks", "issues",
  "reports", "team", "knowledgebase", "automations",
];

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");

export function VerticalPacksManager() {
  const qc = useQueryClient();

  const { data: verticals = [], refetch } = useQuery({
    queryKey: ["all-verticals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("industry_verticals")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Layers className="h-5 w-5" /> Industry Vertical Packs
        </h3>
        <p className="text-sm text-muted-foreground">
          Manage vertical packs platform-wide. Toggle availability, install starter packs, build custom verticals or assign verticals to organizations.
        </p>
      </div>

      <Tabs defaultValue="manage" className="space-y-4">
        <TabsList>
          <TabsTrigger value="manage"><Package className="h-4 w-4 mr-2" /> Manage Packs</TabsTrigger>
          <TabsTrigger value="orgs"><Building2 className="h-4 w-4 mr-2" /> Organizations</TabsTrigger>
          <TabsTrigger value="wizard"><Wand2 className="h-4 w-4 mr-2" /> Create Vertical</TabsTrigger>
          <TabsTrigger value="seeds"><Sparkles className="h-4 w-4 mr-2" /> Starter Packs</TabsTrigger>
          <TabsTrigger value="entities"><Plus className="h-4 w-4 mr-2" /> Custom Entities</TabsTrigger>
        </TabsList>

        <TabsContent value="manage">
          <ManagePacksTab verticals={verticals} onChange={refetch} />
        </TabsContent>
        <TabsContent value="orgs">
          <OrgAssignmentTab verticals={verticals.filter((v: any) => v.is_active)} />
        </TabsContent>
        <TabsContent value="wizard">
          <CreateVerticalWizard onCreated={refetch} />
        </TabsContent>
        <TabsContent value="seeds">
          <SeedPacksTab installedIds={verticals.map((v: any) => v.id)} onInstalled={refetch} />
        </TabsContent>
        <TabsContent value="entities">
          <CustomEntitiesTab verticals={verticals} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ----------------------------------- Manage tab: enable/disable, delete custom ----------------------------------- */

function ManagePacksTab({ verticals, onChange }: { verticals: any[]; onChange: () => void }) {
  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("industry_verticals").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pack updated");
      onChange();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletePack = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("industry_verticals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pack deleted");
      onChange();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="divide-y">
      {verticals.map((v) => (
        <div key={v.id} className="flex items-center justify-between gap-4 p-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium">{v.name}</span>
              {v.is_seed && <Badge variant="secondary">Built-in</Badge>}
              {!v.is_active && <Badge variant="outline">Disabled</Badge>}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-1">{v.description}</p>
            <div className="text-xs text-muted-foreground mt-1">
              {v.enabled_modules?.length ?? 0} modules · {Object.keys(v.terminology_overrides ?? {}).length} terminology overrides
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <Label htmlFor={`active-${v.id}`} className="text-sm">Available</Label>
              <Switch
                id={`active-${v.id}`}
                checked={v.is_active}
                onCheckedChange={(checked) => toggleActive.mutate({ id: v.id, is_active: checked })}
              />
            </div>
            {!v.is_seed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (confirm(`Delete "${v.name}"? Organizations using it will fall back to the default vertical.`)) {
                    deletePack.mutate(v.id);
                  }
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>
      ))}
      {verticals.length === 0 && <div className="p-8 text-center text-muted-foreground">No vertical packs.</div>}
    </Card>
  );
}

/* ----------------------------------- Org assignment tab ----------------------------------- */

function OrgAssignmentTab({ verticals }: { verticals: any[] }) {
  const qc = useQueryClient();
  const { data: orgs = [] } = useQuery({
    queryKey: ["admin-orgs-verticals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, slug, industry_vertical")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const updateVertical = useMutation({
    mutationFn: async ({ orgId, verticalId }: { orgId: string; verticalId: string }) => {
      const { error } = await supabase.from("organizations").update({ industry_vertical: verticalId }).eq("id", orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vertical updated");
      qc.invalidateQueries({ queryKey: ["admin-orgs-verticals"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="divide-y">
      {orgs.map((org: any) => (
        <div key={org.id} className="flex items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            <div className="font-medium truncate">{org.name}</div>
            <div className="text-xs text-muted-foreground">{org.slug}</div>
          </div>
          <Select
            value={org.industry_vertical || "technology"}
            onValueChange={(v) => updateVertical.mutate({ orgId: org.id, verticalId: v })}
          >
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {verticals.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
      {orgs.length === 0 && <div className="p-8 text-center text-muted-foreground">No organizations.</div>}
    </Card>
  );
}

/* ----------------------------------- Create vertical wizard ----------------------------------- */

function CreateVerticalWizard({ onCreated }: { onCreated: () => void }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    id: "",
    name: "",
    description: "",
    icon: "Layers",
    enabled_modules: [] as string[],
    terminology: [] as { key: string; value: string }[],
    ai_context_prompt: "",
    default_dashboards: "",
  });

  const create = useMutation({
    mutationFn: async () => {
      const id = form.id || slugify(form.name);
      const terminology_overrides = Object.fromEntries(form.terminology.filter(t => t.key && t.value).map(t => [t.key, t.value]));
      const { error } = await supabase.from("industry_verticals").insert({
        id,
        name: form.name,
        description: form.description || null,
        icon: form.icon,
        enabled_modules: form.enabled_modules,
        terminology_overrides,
        default_dashboards: form.default_dashboards.split(",").map(s => s.trim()).filter(Boolean),
        ai_context_prompt: form.ai_context_prompt || null,
        is_seed: false,
        sort_order: 100,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vertical pack created");
      onCreated();
      setStep(0);
      setForm({ id: "", name: "", description: "", icon: "Layers", enabled_modules: [], terminology: [], ai_context_prompt: "", default_dashboards: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleModule = (m: string) => {
    setForm((f) => ({
      ...f,
      enabled_modules: f.enabled_modules.includes(m)
        ? f.enabled_modules.filter(x => x !== m)
        : [...f.enabled_modules, m],
    }));
  };

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        {["Basics", "Modules", "Terminology", "AI & Dashboards", "Review"].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`h-7 w-7 rounded-full text-xs flex items-center justify-center ${
              step === i ? "bg-primary text-primary-foreground" : step > i ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
            }`}>{i + 1}</div>
            <span className={step === i ? "text-sm font-medium" : "text-sm text-muted-foreground"}>{label}</span>
            {i < 4 && <div className="w-6 h-px bg-border" />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-3 max-w-xl">
          <div><Label>Vertical Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Healthcare" /></div>
          <div><Label>Identifier (slug)</Label><Input value={form.id} onChange={(e) => setForm({ ...form, id: slugify(e.target.value) })} placeholder={form.name ? slugify(form.name) : "healthcare"} /></div>
          <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><Label>Icon (lucide name)</Label><Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="Stethoscope, Factory, Scale, ShoppingBag…" /></div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Pick the modules this vertical should expose in the sidebar. You can always change this later.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {ALL_CORE_MODULES.map((m) => (
              <label key={m} className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-accent">
                <input type="checkbox" checked={form.enabled_modules.includes(m)} onChange={() => toggleModule(m)} />
                <span className="text-sm capitalize">{m.replace(/_/g, " ")}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3 max-w-xl">
          <p className="text-sm text-muted-foreground">Optionally rename core terms for this vertical (e.g. <em>Project</em> → <em>Matter</em>).</p>
          <div className="space-y-2">
            {form.terminology.map((t, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Select value={t.key} onValueChange={(v) => setForm(f => ({ ...f, terminology: f.terminology.map((x, j) => j === i ? { ...x, key: v } : x) }))}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Core term" /></SelectTrigger>
                  <SelectContent>
                    {["programme", "project", "product", "work_package", "stakeholder", "task", "sprint"].map(k => (
                      <SelectItem key={k} value={k}>{k}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input value={t.value} onChange={(e) => setForm(f => ({ ...f, terminology: f.terminology.map((x, j) => j === i ? { ...x, value: e.target.value } : x) }))} placeholder="Replacement label" />
                <Button variant="ghost" size="icon" onClick={() => setForm(f => ({ ...f, terminology: f.terminology.filter((_, j) => j !== i) }))}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setForm(f => ({ ...f, terminology: [...f.terminology, { key: "", value: "" }] }))}>
              <Plus className="h-4 w-4 mr-1" /> Add override
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3 max-w-xl">
          <div>
            <Label>AI Context Prompt</Label>
            <Textarea rows={4} value={form.ai_context_prompt} onChange={(e) => setForm({ ...form, ai_context_prompt: e.target.value })}
              placeholder="You are assisting a Healthcare team. Use clinical terminology, HIPAA awareness, patient outcomes." />
            <p className="text-xs text-muted-foreground mt-1">Injected into AI assistant calls for orgs on this vertical.</p>
          </div>
          <div>
            <Label>Default Dashboards (comma-separated keys)</Label>
            <Input value={form.default_dashboards} onChange={(e) => setForm({ ...form, default_dashboards: e.target.value })} placeholder="clinical_overview, hipaa_compliance" />
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-3 max-w-xl text-sm">
          <div><strong>Name:</strong> {form.name || <em className="text-muted-foreground">unnamed</em>}</div>
          <div><strong>Slug:</strong> <code>{form.id || slugify(form.name)}</code></div>
          <div><strong>Description:</strong> {form.description || <em className="text-muted-foreground">none</em>}</div>
          <div><strong>Icon:</strong> {form.icon}</div>
          <div><strong>Modules ({form.enabled_modules.length}):</strong> {form.enabled_modules.join(", ") || <em className="text-muted-foreground">none</em>}</div>
          <div><strong>Terminology overrides:</strong> {form.terminology.filter(t => t.key && t.value).map(t => `${t.key}→${t.value}`).join(", ") || <em className="text-muted-foreground">none</em>}</div>
          <div><strong>AI prompt:</strong> {form.ai_context_prompt || <em className="text-muted-foreground">none</em>}</div>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>Back</Button>
        {step < 4 ? (
          <Button onClick={() => setStep(s => s + 1)} disabled={step === 0 && !form.name}>Next</Button>
        ) : (
          <Button onClick={() => create.mutate()} disabled={!form.name || create.isPending}>
            {create.isPending ? "Creating…" : "Create Vertical"}
          </Button>
        )}
      </div>
    </Card>
  );
}

/* ----------------------------------- Seed packs catalogue ----------------------------------- */

function SeedPacksTab({ installedIds, onInstalled }: { installedIds: string[]; onInstalled: () => void }) {
  const install = useMutation({
    mutationFn: async (packId: string) => {
      const pack = SEED_PACKS.find(p => p.id === packId);
      if (!pack) throw new Error("Pack not found");

      const { error: vErr } = await supabase.from("industry_verticals").insert({
        id: pack.id,
        name: pack.name,
        description: pack.description,
        icon: pack.icon,
        enabled_modules: pack.enabled_modules,
        terminology_overrides: pack.terminology_overrides,
        default_dashboards: pack.default_dashboards,
        ai_context_prompt: pack.ai_context_prompt,
        is_seed: false,
        sort_order: 100,
      });
      if (vErr) throw vErr;

      if (pack.entities?.length) {
        const { error: eErr } = await supabase.from("vertical_entities").insert(
          pack.entities.map(e => ({
            vertical_id: pack.id,
            slug: e.slug,
            name: e.name,
            name_plural: e.name_plural,
            description: e.description,
            icon: e.icon,
            fields: e.fields,
            default_status_options: e.default_status_options,
          }))
        );
        if (eErr) throw eErr;
      }
    },
    onSuccess: () => {
      toast.success("Pack installed");
      onInstalled();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {SEED_PACKS.map((pack) => {
        const installed = installedIds.includes(pack.id);
        return (
          <Card key={pack.id} className="p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h4 className="font-semibold">{pack.name}</h4>
                <p className="text-sm text-muted-foreground">{pack.description}</p>
              </div>
              {installed ? (
                <Badge variant="secondary">Installed</Badge>
              ) : (
                <Button size="sm" onClick={() => install.mutate(pack.id)} disabled={install.isPending}>
                  Install
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {pack.entities?.map(e => <Badge key={e.slug} variant="outline">{e.name_plural}</Badge>)}
              <Badge variant="outline" className="text-xs">{pack.enabled_modules.length} modules</Badge>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ----------------------------------- Custom entities (heavy pack scaffold) ----------------------------------- */

function CustomEntitiesTab({ verticals }: { verticals: any[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    vertical_id: "",
    slug: "",
    name: "",
    name_plural: "",
    description: "",
    icon: "FileText",
    fields: [] as { key: string; label: string; type: string; required?: boolean }[],
    default_status_options: "open, in_progress, closed",
  });

  const { data: entities = [] } = useQuery({
    queryKey: ["vertical-entities-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vertical_entities")
        .select("*, industry_verticals(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vertical_entities").insert({
        vertical_id: form.vertical_id,
        slug: form.slug || slugify(form.name),
        name: form.name,
        name_plural: form.name_plural || form.name + "s",
        description: form.description || null,
        icon: form.icon,
        fields: form.fields,
        default_status_options: form.default_status_options.split(",").map(s => s.trim()).filter(Boolean),
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Custom entity created");
      qc.invalidateQueries({ queryKey: ["vertical-entities-admin"] });
      setOpen(false);
      setForm({ vertical_id: "", slug: "", name: "", name_plural: "", description: "", icon: "FileText", fields: [], default_status_options: "open, in_progress, closed" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vertical_entities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Entity removed");
      qc.invalidateQueries({ queryKey: ["vertical-entities-admin"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Define custom registers (entity types) for any vertical. Records will appear at <code>/verticals/&lt;slug&gt;</code> for orgs on that vertical.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> New Custom Entity</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New Custom Entity</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Vertical</Label>
                  <Select value={form.vertical_id} onValueChange={(v) => setForm({ ...form, vertical_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select vertical" /></SelectTrigger>
                    <SelectContent>
                      {verticals.map((v) => (<SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Icon (lucide)</Label><Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} /></div>
                <div><Label>Singular Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Patient Cohort" /></div>
                <div><Label>Plural Name</Label><Input value={form.name_plural} onChange={(e) => setForm({ ...form, name_plural: e.target.value })} placeholder="Patient Cohorts" /></div>
                <div><Label>URL slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} placeholder={form.name ? slugify(form.name) : "patient-cohorts"} /></div>
                <div><Label>Status options (comma)</Label><Input value={form.default_status_options} onChange={(e) => setForm({ ...form, default_status_options: e.target.value })} /></div>
              </div>
              <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>

              <div>
                <Label>Custom Fields</Label>
                <div className="space-y-2 mt-2">
                  {form.fields.map((f, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input className="w-32" placeholder="key" value={f.key} onChange={(e) => setForm(s => ({ ...s, fields: s.fields.map((x, j) => j === i ? { ...x, key: slugify(e.target.value) } : x) }))} />
                      <Input className="flex-1" placeholder="Label" value={f.label} onChange={(e) => setForm(s => ({ ...s, fields: s.fields.map((x, j) => j === i ? { ...x, label: e.target.value } : x) }))} />
                      <Select value={f.type} onValueChange={(v) => setForm(s => ({ ...s, fields: s.fields.map((x, j) => j === i ? { ...x, type: v } : x) }))}>
                        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="textarea">Long text</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="date">Date</SelectItem>
                        </SelectContent>
                      </Select>
                      <label className="flex items-center gap-1 text-xs">
                        <input type="checkbox" checked={!!f.required} onChange={(e) => setForm(s => ({ ...s, fields: s.fields.map((x, j) => j === i ? { ...x, required: e.target.checked } : x) }))} />
                        req
                      </label>
                      <Button variant="ghost" size="icon" onClick={() => setForm(s => ({ ...s, fields: s.fields.filter((_, j) => j !== i) }))}><X className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => setForm(s => ({ ...s, fields: [...s.fields, { key: "", label: "", type: "text" }] }))}>
                    <Plus className="h-4 w-4 mr-1" /> Add field
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => create.mutate()} disabled={!form.vertical_id || !form.name || create.isPending}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="divide-y">
        {entities.map((e: any) => (
          <div key={e.id} className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">{e.name_plural}</span>
                <Badge variant="outline">{e.industry_verticals?.name ?? e.vertical_id}</Badge>
                <code className="text-xs text-muted-foreground">/verticals/{e.slug}</code>
              </div>
              <p className="text-sm text-muted-foreground">{e.description}</p>
              <div className="text-xs text-muted-foreground">{e.fields?.length ?? 0} fields</div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete "${e.name_plural}" and all its records?`)) remove.mutate(e.id); }}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {entities.length === 0 && <div className="p-8 text-center text-muted-foreground">No custom entities yet.</div>}
      </Card>
    </div>
  );
}
