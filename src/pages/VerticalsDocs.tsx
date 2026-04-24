import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Layers, Wand2, Sparkles, Package, FileCode, Building2, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function VerticalsDocs() {
  const { userRole } = useAuth();
  const isPlatformAdmin = userRole === "admin";

  return (
    <AppLayout title="Industry Verticals" subtitle="How vertical packs work and how to extend them">
      <div className="container mx-auto p-6 max-w-4xl space-y-6">
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Layers className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">What is an industry vertical?</h2>
              <p className="text-muted-foreground">
                A vertical pack tailors the platform to a specific industry — choosing which modules appear
                in the sidebar, renaming core terms (e.g. <em>Project</em> → <em>Matter</em> for Legal),
                priming the AI assistant with domain context, and optionally adding industry-specific registers.
              </p>
            </div>
          </div>
        </Card>

        <div>
          <h3 className="text-xl font-semibold mb-3">The three layers</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <Card className="p-4">
              <Badge variant="secondary" className="mb-2">Layer 1</Badge>
              <h4 className="font-semibold mb-1">Registry entry</h4>
              <p className="text-sm text-muted-foreground">
                A row in <code>industry_verticals</code> with name, modules, terminology, AI prompt and dashboards.
              </p>
            </Card>
            <Card className="p-4">
              <Badge variant="secondary" className="mb-2">Layer 2</Badge>
              <h4 className="font-semibold mb-1">Onboarding & assignment</h4>
              <p className="text-sm text-muted-foreground">
                The vertical appears in onboarding tiles, the org admin's Settings page, and the platform admin's organization assignment grid.
              </p>
            </Card>
            <Card className="p-4">
              <Badge variant="secondary" className="mb-2">Layer 3</Badge>
              <h4 className="font-semibold mb-1">Custom entities (optional)</h4>
              <p className="text-sm text-muted-foreground">
                Define schema-driven registers like RFIs or Patient Cohorts. They render at <code>/verticals/&lt;slug&gt;</code>.
              </p>
            </Card>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-semibold mb-3">Light pack vs heavy pack</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <Card className="p-4">
              <h4 className="font-semibold mb-1">Light pack</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Reuses core entities with different terminology and module visibility. Built in minutes via the Wizard.
              </p>
              <div className="text-xs text-muted-foreground">
                Examples: IT &amp; Infrastructure, Software &amp; SaaS, Retail.
              </div>
            </Card>
            <Card className="p-4">
              <h4 className="font-semibold mb-1">Heavy pack</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Light pack plus bespoke registers (custom entities) with their own fields and statuses.
              </p>
              <div className="text-xs text-muted-foreground">
                Examples: Construction (RFIs, submittals), Healthcare (incidents), Manufacturing (work orders).
              </div>
            </Card>
          </div>
        </div>

        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> How to add a vertical
          </h3>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <strong>Install a starter pack.</strong> Browse the curated list (Healthcare, Manufacturing, Education, Legal, Retail, Non-profit) and install with one click — the registry row and any seed entities are created for you.
              </div>
            </li>
            <li className="flex gap-3">
              <Wand2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <strong>Use the Create Vertical wizard.</strong> A 5-step flow: basics → modules → terminology overrides → AI prompt &amp; dashboards → review.
              </div>
            </li>
            <li className="flex gap-3">
              <FileCode className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <strong>Add custom entities.</strong> For any vertical, define a register (singular/plural name, slug, fields, statuses). The page <code>/verticals/&lt;slug&gt;</code> renders it automatically.
              </div>
            </li>
            <li className="flex gap-3">
              <Package className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <strong>Toggle availability.</strong> Disable a pack from <em>Manage Packs</em> to hide it from onboarding and admin pickers without deleting data.
              </div>
            </li>
            <li className="flex gap-3">
              <Building2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <strong>Assign to organizations.</strong> Either let the org admin pick at signup, change it themselves in Settings, or override per-org from the admin grid.
              </div>
            </li>
          </ol>
          {isPlatformAdmin && (
            <div className="mt-4 pt-4 border-t">
              <Link to="/admin" className="text-sm text-primary hover:underline">
                Go to Admin Panel → Industry Verticals →
              </Link>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-3">Module keys</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Sidebar items reference module keys. Verticals enable a subset of these keys; items whose key isn't in the active
            vertical's <code>enabled_modules</code> are hidden. Items with no module key always appear.
          </p>
          <div className="flex flex-wrap gap-1">
            {["programmes", "projects", "products", "tasks", "timesheets", "helpdesk", "change_management", "risks", "issues", "reports", "knowledgebase", "automations", "rfis", "submittals", "daily_logs", "punch_list", "engagements", "retainers"].map(m => (
              <code key={m} className="text-xs px-2 py-1 rounded bg-muted">{m}</code>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-3">Limits</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>One vertical per organization (single-vertical model).</li>
            <li>Built-in verticals (IT &amp; Infra, Software &amp; SaaS, Construction, Professional Services) cannot be deleted; only toggled.</li>
            <li>Custom entities use a JSONB schema — fields are dynamic and don't get their own database columns. For high-volume or analytical registers, prefer building a dedicated table.</li>
          </ul>
        </Card>
      </div>
    </AppLayout>
  );
}
