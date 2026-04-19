import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Plus, TrendingUp, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface Props {
  benefitId: string;
  organizationId: string | null;
}

interface Profile {
  id?: string;
  benefit_id: string;
  profile_type: "quantitative" | "qualitative";
  measurement_method: string | null;
  measurement_unit: string | null;
  baseline_value: number | null;
  target_value: number | null;
  baseline_date: string | null;
  target_date: string | null;
  trajectory: Array<{ date: string; value: number }>;
  dis_benefits: string | null;
  dependencies: string | null;
  qualitative_rubric: Array<{ level: string; description: string }>;
  current_maturity_level: string | null;
}

interface Measurement {
  id: string;
  measurement_date: string;
  actual_value: number | null;
  qualitative_status: string | null;
  notes: string | null;
}

const emptyProfile = (benefitId: string): Profile => ({
  benefit_id: benefitId,
  profile_type: "quantitative",
  measurement_method: null,
  measurement_unit: null,
  baseline_value: null,
  target_value: null,
  baseline_date: null,
  target_date: null,
  trajectory: [],
  dis_benefits: null,
  dependencies: null,
  qualitative_rubric: [],
  current_maturity_level: null,
});

export function BenefitProfilePanel({ benefitId, organizationId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Profile>(emptyProfile(benefitId));
  const [newM, setNewM] = useState({ date: format(new Date(), "yyyy-MM-dd"), value: "", status: "", notes: "" });

  const { data: profile } = useQuery({
    queryKey: ["benefit-profile", benefitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("benefit_profiles")
        .select("*")
        .eq("benefit_id", benefitId)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        const p = {
          ...data,
          trajectory: Array.isArray(data.trajectory) ? (data.trajectory as unknown as Profile["trajectory"]) : [],
          qualitative_rubric: Array.isArray(data.qualitative_rubric) ? (data.qualitative_rubric as unknown as Profile["qualitative_rubric"]) : [],
        } as unknown as Profile;
        setForm(p);
        return p;
      }
      return null;
    },
    enabled: !!benefitId,
  });

  const { data: measurements = [] } = useQuery({
    queryKey: ["benefit-measurements", benefitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("benefit_measurements")
        .select("*")
        .eq("benefit_id", benefitId)
        .order("measurement_date");
      if (error) throw error;
      return (data ?? []) as Measurement[];
    },
    enabled: !!benefitId,
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      const payload: any = {
        ...form,
        organization_id: organizationId,
        created_by: user?.id,
      };
      if (profile?.id) {
        const { error } = await supabase.from("benefit_profiles").update(payload).eq("id", profile.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("benefit_profiles").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["benefit-profile", benefitId] });
      setEditing(false);
      toast.success("Profile saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMeasurement = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("benefit_measurements").insert({
        benefit_id: benefitId,
        measurement_date: newM.date,
        actual_value: newM.value ? parseFloat(newM.value) : null,
        qualitative_status: newM.status || null,
        notes: newM.notes || null,
        recorded_by: user?.id,
        organization_id: organizationId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["benefit-measurements", benefitId] });
      setNewM({ date: format(new Date(), "yyyy-MM-dd"), value: "", status: "", notes: "" });
      toast.success("Measurement recorded");
    },
  });

  const deleteMeasurement = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("benefit_measurements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["benefit-measurements", benefitId] }),
  });

  // Build chart data
  const chartData = (() => {
    const trajectory = form.trajectory ?? [];
    const actuals = measurements
      .filter((m) => m.actual_value != null)
      .map((m) => ({ date: m.measurement_date, actual: m.actual_value }));
    const allDates = Array.from(
      new Set([
        ...trajectory.map((t) => t.date),
        ...actuals.map((a) => a.date),
      ]),
    ).sort();
    return allDates.map((d) => ({
      date: d,
      target: trajectory.find((t) => t.date === d)?.value ?? null,
      actual: actuals.find((a) => a.date === d)?.actual ?? null,
    }));
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold flex items-center gap-2">
            Benefit profile
            <Badge variant="outline" className="text-xs">
              {form.profile_type === "qualitative" ? "Qualitative" : "Quantitative"}
            </Badge>
          </h4>
          <p className="text-xs text-muted-foreground">
            Full MSP-style profile with baseline, target, and realisation trajectory
          </p>
        </div>
        <Button size="sm" variant={editing ? "default" : "outline"} onClick={() => editing ? saveProfile.mutate() : setEditing(true)}>
          {editing ? <><Save className="h-3.5 w-3.5 mr-1" /> Save</> : "Edit profile"}
        </Button>
      </div>

      <Tabs defaultValue={form.profile_type}>
        <TabsList>
          <TabsTrigger
            value="quantitative"
            onClick={() => setForm({ ...form, profile_type: "quantitative" })}
          >
            Quantitative
          </TabsTrigger>
          <TabsTrigger
            value="qualitative"
            onClick={() => setForm({ ...form, profile_type: "qualitative" })}
          >
            Qualitative
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quantitative" className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Baseline value</Label>
              <Input
                type="number"
                disabled={!editing}
                value={form.baseline_value ?? ""}
                onChange={(e) => setForm({ ...form, baseline_value: e.target.value ? parseFloat(e.target.value) : null })}
              />
            </div>
            <div>
              <Label className="text-xs">Target value</Label>
              <Input
                type="number"
                disabled={!editing}
                value={form.target_value ?? ""}
                onChange={(e) => setForm({ ...form, target_value: e.target.value ? parseFloat(e.target.value) : null })}
              />
            </div>
            <div>
              <Label className="text-xs">Baseline date</Label>
              <Input
                type="date"
                disabled={!editing}
                value={form.baseline_date ?? ""}
                onChange={(e) => setForm({ ...form, baseline_date: e.target.value || null })}
              />
            </div>
            <div>
              <Label className="text-xs">Target date</Label>
              <Input
                type="date"
                disabled={!editing}
                value={form.target_date ?? ""}
                onChange={(e) => setForm({ ...form, target_date: e.target.value || null })}
              />
            </div>
            <div>
              <Label className="text-xs">Measurement unit</Label>
              <Input
                disabled={!editing}
                placeholder="e.g. £, %, hours"
                value={form.measurement_unit ?? ""}
                onChange={(e) => setForm({ ...form, measurement_unit: e.target.value || null })}
              />
            </div>
            <div>
              <Label className="text-xs">Measurement method</Label>
              <Input
                disabled={!editing}
                value={form.measurement_method ?? ""}
                onChange={(e) => setForm({ ...form, measurement_method: e.target.value || null })}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs flex items-center justify-between">
              Target trajectory
              {editing && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setForm({
                      ...form,
                      trajectory: [...(form.trajectory ?? []), { date: format(new Date(), "yyyy-MM-dd"), value: 0 }],
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add point
                </Button>
              )}
            </Label>
            <div className="space-y-1">
              {(form.trajectory ?? []).map((pt, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    type="date"
                    disabled={!editing}
                    value={pt.date}
                    onChange={(e) => {
                      const next = [...form.trajectory];
                      next[i] = { ...pt, date: e.target.value };
                      setForm({ ...form, trajectory: next });
                    }}
                    className="w-40"
                  />
                  <Input
                    type="number"
                    disabled={!editing}
                    value={pt.value}
                    onChange={(e) => {
                      const next = [...form.trajectory];
                      next[i] = { ...pt, value: parseFloat(e.target.value) || 0 };
                      setForm({ ...form, trajectory: next });
                    }}
                  />
                  {editing && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        setForm({
                          ...form,
                          trajectory: form.trajectory.filter((_, idx) => idx !== i),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {chartData.length > 0 && (
            <div className="h-56 mt-3">
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="target"
                    stroke="hsl(var(--primary))"
                    strokeDasharray="4 4"
                    name="Target"
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke="hsl(var(--success))"
                    name="Actual"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </TabsContent>

        <TabsContent value="qualitative" className="space-y-3">
          <div>
            <Label className="text-xs flex items-center justify-between">
              Maturity rubric
              {editing && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setForm({
                      ...form,
                      qualitative_rubric: [
                        ...(form.qualitative_rubric ?? []),
                        { level: "", description: "" },
                      ],
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add level
                </Button>
              )}
            </Label>
            <div className="space-y-1">
              {(form.qualitative_rubric ?? []).map((r, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    disabled={!editing}
                    placeholder="Level (e.g. Initial)"
                    value={r.level}
                    onChange={(e) => {
                      const next = [...form.qualitative_rubric];
                      next[i] = { ...r, level: e.target.value };
                      setForm({ ...form, qualitative_rubric: next });
                    }}
                    className="w-40"
                  />
                  <Textarea
                    rows={1}
                    disabled={!editing}
                    placeholder="Description"
                    value={r.description}
                    onChange={(e) => {
                      const next = [...form.qualitative_rubric];
                      next[i] = { ...r, description: e.target.value };
                      setForm({ ...form, qualitative_rubric: next });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Current maturity level</Label>
            <Select
              disabled={!editing}
              value={form.current_maturity_level ?? ""}
              onValueChange={(v) => setForm({ ...form, current_maturity_level: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                {(form.qualitative_rubric ?? [])
                  .filter((r) => r.level)
                  .map((r, i) => (
                    <SelectItem key={i} value={r.level}>
                      {r.level}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </TabsContent>
      </Tabs>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Dis-benefits</Label>
          <Textarea
            rows={2}
            disabled={!editing}
            value={form.dis_benefits ?? ""}
            onChange={(e) => setForm({ ...form, dis_benefits: e.target.value || null })}
          />
        </div>
        <div>
          <Label className="text-xs">Dependencies</Label>
          <Textarea
            rows={2}
            disabled={!editing}
            value={form.dependencies ?? ""}
            onChange={(e) => setForm({ ...form, dependencies: e.target.value || null })}
          />
        </div>
      </div>

      {/* Measurements */}
      <div>
        <h5 className="text-sm font-semibold flex items-center gap-2 mb-2">
          <TrendingUp className="h-4 w-4" />
          Measurements
        </h5>
        <div className="grid grid-cols-[140px_1fr_1fr_auto] gap-2 mb-2">
          <Input
            type="date"
            value={newM.date}
            onChange={(e) => setNewM({ ...newM, date: e.target.value })}
          />
          {form.profile_type === "quantitative" ? (
            <Input
              type="number"
              placeholder="Actual value"
              value={newM.value}
              onChange={(e) => setNewM({ ...newM, value: e.target.value })}
            />
          ) : (
            <Input
              placeholder="Status"
              value={newM.status}
              onChange={(e) => setNewM({ ...newM, status: e.target.value })}
            />
          )}
          <Input
            placeholder="Notes (optional)"
            value={newM.notes}
            onChange={(e) => setNewM({ ...newM, notes: e.target.value })}
          />
          <Button size="sm" onClick={() => addMeasurement.mutate()}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        </div>
        <div className="space-y-1">
          {measurements.map((m) => (
            <div key={m.id} className="flex items-center gap-2 text-xs border-b border-border py-1.5">
              <span className="text-muted-foreground w-24">{format(new Date(m.measurement_date), "PP")}</span>
              <span className="font-medium">
                {m.actual_value != null ? `${m.actual_value} ${form.measurement_unit ?? ""}` : m.qualitative_status}
              </span>
              {m.notes && <span className="text-muted-foreground flex-1 truncate">{m.notes}</span>}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => deleteMeasurement.mutate(m.id)}
                aria-label="Remove measurement"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
          {measurements.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No measurements yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
