import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Save, AlertCircle, BookmarkPlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import type { FieldMapping } from "@/lib/migration/types";
import { toast } from "sonner";

const INTERNAL_STATUSES = ["not_started", "in_progress", "blocked", "completed"] as const;
const INTERNAL_PRIORITIES = ["low", "medium", "high"] as const;
const INTERNAL_ENTITIES = ["task", "issue", "risk"] as const;
/** Where a JSM request type can land. */
const JSM_TARGETS = ["issue", "incident", "problem", "change", "task", "risk"] as const;

export interface MappingValidationResult {
  ok: boolean;
  errors: string[];
}

interface SavedTemplate {
  id: string;
  name: string;
  mapping: FieldMapping;
  is_default: boolean;
}

interface Props {
  source: string; // e.g. "jira"
  /** External status keys discovered from the source (lowercased). */
  knownStatuses?: string[];
  /** External priority keys discovered from the source (lowercased). */
  knownPriorities?: string[];
  /** External issue/work types discovered from the source (lowercased). */
  knownIssueTypes?: string[];
  /** Whether to render the Jira issue-type → internal entity panel. */
  showIssueTypeMapping?: boolean;
  /** External JSM request type keys (ids) discovered from the source. */
  knownRequestTypes?: string[];
  /** Display labels for request type ids. */
  requestTypeLabels?: Record<string, string>;
  /** Whether to render the JSM request-type → register panel. */
  showRequestTypeMapping?: boolean;
  value: FieldMapping;
  onChange: (m: FieldMapping) => void;
  onValidate?: (result: MappingValidationResult) => void;
}

const DEFAULT_JIRA_TYPES = ["task", "story", "bug", "incident", "epic", "subtask", "risk"];

export function MappingEditor({
  source,
  knownStatuses,
  knownPriorities,
  knownIssueTypes,
  showIssueTypeMapping,
  knownRequestTypes,
  requestTypeLabels,
  showRequestTypeMapping,
  value,
  onChange,
  onValidate,
}: Props) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();

  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templateName, setTemplateName] = useState("");

  // Load templates for this org+source
  useEffect(() => {
    if (!currentOrganization?.id) return;
    setLoadingTemplates(true);
    supabase
      .from("migration_field_mappings")
      .select("id,name,mapping,is_default")
      .eq("organization_id", currentOrganization.id)
      .eq("source", source)
      .eq("entity_type", "all")
      .order("is_default", { ascending: false })
      .order("name")
      .then(({ data }) => {
        setTemplates((data ?? []) as SavedTemplate[]);
        setLoadingTemplates(false);
      });
  }, [currentOrganization?.id, source]);

  // Combine known + user-added keys for display rows
  const statusKeys = useMemo(() => {
    const set = new Set<string>([
      ...(knownStatuses ?? []),
      ...Object.keys(value.status ?? {}),
    ]);
    return Array.from(set).sort();
  }, [knownStatuses, value.status]);

  const priorityKeys = useMemo(() => {
    const set = new Set<string>([
      ...(knownPriorities ?? []),
      ...Object.keys(value.priority ?? {}),
    ]);
    return Array.from(set).sort();
  }, [knownPriorities, value.priority]);

  const issueTypeKeys = useMemo(() => {
    const set = new Set<string>([
      ...(knownIssueTypes ?? DEFAULT_JIRA_TYPES),
      ...Object.keys((value.extra?.issueType as Record<string, string>) ?? {}),
    ]);
    return Array.from(set).sort();
  }, [knownIssueTypes, value.extra]);

  const requestTypeKeys = useMemo(() => {
    const set = new Set<string>([
      ...(knownRequestTypes ?? []),
      ...Object.keys((value.extra?.requestType as Record<string, string>) ?? {}),
    ]);
    return Array.from(set).sort();
  }, [knownRequestTypes, value.extra]);

  // Validation
  const validation = useMemo<MappingValidationResult>(() => {
    const errors: string[] = [];
    const statusMap = value.status ?? {};
    const priorityMap = value.priority ?? {};

    // Required: every known status/priority must be mapped to a valid internal value
    for (const k of knownStatuses ?? []) {
      const v = statusMap[k];
      if (!v) errors.push(`Status "${k}" is not mapped.`);
      else if (!INTERNAL_STATUSES.includes(v as never))
        errors.push(`Status "${k}" maps to invalid value "${v}".`);
    }
    for (const k of knownPriorities ?? []) {
      const v = priorityMap[k];
      if (!v) errors.push(`Priority "${k}" is not mapped.`);
      else if (!INTERNAL_PRIORITIES.includes(v as never))
        errors.push(`Priority "${k}" maps to invalid value "${v}".`);
    }
    if (showIssueTypeMapping) {
      const itMap = (value.extra?.issueType as Record<string, string>) ?? {};
      for (const k of knownIssueTypes ?? []) {
        const v = itMap[k];
        if (!v) errors.push(`Issue type "${k}" is not mapped.`);
        else if (!INTERNAL_ENTITIES.includes(v as never))
          errors.push(`Issue type "${k}" maps to invalid entity "${v}".`);
      }
    }
    if (showRequestTypeMapping) {
      const rtMap = (value.extra?.requestType as Record<string, string>) ?? {};
      for (const k of knownRequestTypes ?? []) {
        const label = requestTypeLabels?.[k] ?? k;
        const v = rtMap[k];
        if (!v) errors.push(`Request type "${label}" is not mapped to a register.`);
        else if (!JSM_TARGETS.includes(v as never))
          errors.push(`Request type "${label}" maps to invalid target "${v}".`);
      }
    }
    return { ok: errors.length === 0, errors };
  }, [
    value,
    knownStatuses,
    knownPriorities,
    knownIssueTypes,
    showIssueTypeMapping,
    knownRequestTypes,
    requestTypeLabels,
    showRequestTypeMapping,
  ]);

  useEffect(() => {
    onValidate?.(validation);
  }, [validation, onValidate]);

  // Mutators
  const setStatus = (k: string, v: string) =>
    onChange({ ...value, status: { ...(value.status ?? {}), [k]: v } });
  const removeStatus = (k: string) => {
    const next = { ...(value.status ?? {}) };
    delete next[k];
    onChange({ ...value, status: next });
  };
  const setPriority = (k: string, v: string) =>
    onChange({ ...value, priority: { ...(value.priority ?? {}), [k]: v } });
  const removePriority = (k: string) => {
    const next = { ...(value.priority ?? {}) };
    delete next[k];
    onChange({ ...value, priority: next });
  };
  const setIssueType = (k: string, v: string) => {
    const cur = (value.extra?.issueType as Record<string, string>) ?? {};
    onChange({
      ...value,
      extra: { ...(value.extra ?? {}), issueType: { ...cur, [k]: v } },
    });
  };
  const removeIssueType = (k: string) => {
    const cur = { ...((value.extra?.issueType as Record<string, string>) ?? {}) };
    delete cur[k];
    onChange({ ...value, extra: { ...(value.extra ?? {}), issueType: cur } });
  };
  const setRequestType = (k: string, v: string) => {
    const cur = (value.extra?.requestType as Record<string, string>) ?? {};
    onChange({
      ...value,
      extra: { ...(value.extra ?? {}), requestType: { ...cur, [k]: v } },
    });
  };
  const removeRequestType = (k: string) => {
    const cur = { ...((value.extra?.requestType as Record<string, string>) ?? {}) };
    delete cur[k];
    onChange({ ...value, extra: { ...(value.extra ?? {}), requestType: cur } });
  };

  const [newStatusKey, setNewStatusKey] = useState("");
  const [newPriorityKey, setNewPriorityKey] = useState("");
  const [newTypeKey, setNewTypeKey] = useState("");
  const [newRequestTypeKey, setNewRequestTypeKey] = useState("");

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    onChange(t.mapping);
    toast.success(`Applied "${t.name}"`);
  };

  const saveTemplate = async () => {
    const name = templateName.trim();
    if (!name) {
      toast.error("Give the template a name first.");
      return;
    }
    if (!currentOrganization?.id || !user?.id) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("migration_field_mappings")
        .insert({
          organization_id: currentOrganization.id,
          created_by: user.id,
          source,
          entity_type: "all",
          name,
          mapping: value as never,
          is_default: false,
        })
        .select("id,name,mapping,is_default")
        .single();
      if (error) throw error;
      setTemplates((prev) => [...prev, data as SavedTemplate]);
      setTemplateName("");
      toast.success("Template saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Templates row */}
      <div className="rounded-md border p-3 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs font-medium flex items-center gap-1.5">
            <BookmarkPlus className="h-3.5 w-3.5" /> Mapping templates
          </p>
          {loadingTemplates && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        {templates.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {templates.map((t) => (
              <Button
                key={t.id}
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => applyTemplate(t.id)}
              >
                {t.name}
                {t.is_default && <Badge variant="secondary" className="ml-1 text-[9px] px-1">default</Badge>}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">No saved templates yet.</p>
        )}
        <div className="flex items-center gap-1.5">
          <Input
            placeholder="Template name"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value.slice(0, 80))}
            className="h-7 text-xs"
          />
          <Button size="sm" variant="secondary" onClick={saveTemplate} disabled={saving} className="h-7">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
            Save
          </Button>
        </div>
      </div>

      {/* Validation summary */}
      {!validation.ok && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{validation.errors.length} unmapped field(s)</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 text-xs space-y-0.5 max-h-24 overflow-y-auto">
              {validation.errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
              {validation.errors.length > 8 && (
                <li className="text-muted-foreground">…and {validation.errors.length - 8} more</li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Status mapping */}
      <MapSection
        title="Status mapping"
        helper="Map each source status to one of: not_started, in_progress, blocked, completed."
        keys={statusKeys}
        knownKeys={knownStatuses}
        getValue={(k) => value.status?.[k] ?? ""}
        onSet={setStatus}
        onRemove={removeStatus}
        options={INTERNAL_STATUSES}
        newKey={newStatusKey}
        setNewKey={setNewStatusKey}
      />

      {/* Priority mapping */}
      <MapSection
        title="Priority mapping"
        helper="Map each source priority to one of: low, medium, high."
        keys={priorityKeys}
        knownKeys={knownPriorities}
        getValue={(k) => value.priority?.[k] ?? ""}
        onSet={setPriority}
        onRemove={removePriority}
        options={INTERNAL_PRIORITIES}
        newKey={newPriorityKey}
        setNewKey={setNewPriorityKey}
      />

      {/* Jira issue type → internal entity */}
      {showIssueTypeMapping && (
        <MapSection
          title="Issue type → internal entity"
          helper="Where each Jira issue type lands. Tasks become tasks; issues land in the issue register; risks land in the risk register."
          keys={issueTypeKeys}
          knownKeys={knownIssueTypes}
          getValue={(k) => (value.extra?.issueType as Record<string, string> | undefined)?.[k] ?? ""}
          onSet={setIssueType}
          onRemove={removeIssueType}
          options={INTERNAL_ENTITIES}
          newKey={newTypeKey}
          setNewKey={setNewTypeKey}
        />
      )}

      {/* JSM request type → register */}
      {showRequestTypeMapping && (
        <MapSection
          title="Request type → register"
          helper="Route each Jira Service Management request type to the matching internal register and workflow. Incidents go to Major Incidents, Problems to the Problem register, Changes to Change Requests, and so on."
          keys={requestTypeKeys}
          knownKeys={knownRequestTypes}
          displayLabels={requestTypeLabels}
          getValue={(k) => (value.extra?.requestType as Record<string, string> | undefined)?.[k] ?? ""}
          onSet={setRequestType}
          onRemove={removeRequestType}
          options={JSM_TARGETS}
          newKey={newRequestTypeKey}
          setNewKey={setNewRequestTypeKey}
        />
      )}
    </div>
  );
}

interface MapSectionProps {
  title: string;
  helper: string;
  keys: string[];
  knownKeys?: string[];
  /** Optional human-readable label per key (e.g. for opaque ids). */
  displayLabels?: Record<string, string>;
  getValue: (k: string) => string;
  onSet: (k: string, v: string) => void;
  onRemove: (k: string) => void;
  options: readonly string[];
  newKey: string;
  setNewKey: (v: string) => void;
}

function MapSection({
  title,
  helper,
  keys,
  knownKeys,
  displayLabels,
  getValue,
  onSet,
  onRemove,
  options,
  newKey,
  setNewKey,
}: MapSectionProps) {
  const knownSet = new Set(knownKeys ?? []);
  return (
    <div className="rounded-md border p-3 space-y-2">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-[11px] text-muted-foreground">{helper}</p>
      </div>
      <div className="space-y-1.5">
        {keys.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No keys yet — add one below.</p>
        )}
        {keys.map((k) => {
          const required = knownSet.has(k);
          const v = getValue(k);
          const missing = required && !v;
          return (
            <div key={k} className="flex items-center gap-1.5">
              <Label className="flex-1 text-xs truncate flex items-center gap-1">
                <span className="truncate">{displayLabels?.[k] ?? k}</span>
                {required && <span className="text-destructive">*</span>}
                {missing && <Badge variant="destructive" className="h-4 text-[9px] px-1">missing</Badge>}
              </Label>
              <Select value={v} onValueChange={(nv) => onSet(k, nv)}>
                <SelectTrigger className="h-7 w-40 text-xs">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!required && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => onRemove(k)}
                  aria-label={`Remove ${k}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-1.5 pt-1 border-t">
        <Input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value.slice(0, 80))}
          placeholder="Add custom key…"
          className="h-7 text-xs"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-7"
          onClick={() => {
            const k = newKey.trim().toLowerCase();
            if (!k) return;
            onSet(k, options[0]);
            setNewKey("");
          }}
        >
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </div>
    </div>
  );
}
