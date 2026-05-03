import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  UserCircle2,
  Users,
  Building2,
  UserCog,
  Info,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { FieldMapping } from "@/lib/migration/types";

/** What the importer should do with each contact role from JSM. */
export type ContactRouting =
  | "attach_only"
  | "attach_and_stakeholder"
  | "skip";

export type ContactRole =
  | "reporter"
  | "participant"
  | "customer_organization"
  | "assignee";

export type ContactRoutingMap = Record<ContactRole, ContactRouting>;

export const DEFAULT_CONTACT_ROUTING: ContactRoutingMap = {
  reporter: "attach_only",
  participant: "attach_only",
  customer_organization: "attach_and_stakeholder",
  assignee: "attach_only",
};

interface RoleDef {
  key: ContactRole;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Where the data ultimately lands when "attach_and_stakeholder" is chosen. */
  upgradeTarget?: string;
}

const ROLES: RoleDef[] = [
  {
    key: "reporter",
    label: "Reporter",
    description:
      "The customer who raised each ticket. Always attached to the imported register record (Issue, Incident, Change…) for traceability.",
    icon: UserCircle2,
    upgradeTarget: "Stakeholder register",
  },
  {
    key: "participant",
    label: "Request participants",
    description:
      "Additional people CC'd on the customer request. Useful for keeping shared inboxes informed.",
    icon: Users,
    upgradeTarget: "Stakeholder register",
  },
  {
    key: "customer_organization",
    label: "Customer organization",
    description:
      "The JSM Customer Organization linked to a request (e.g. an external client or business unit). Recommended for stakeholder analysis.",
    icon: Building2,
    upgradeTarget: "Stakeholder register",
  },
  {
    key: "assignee",
    label: "Assignee",
    description:
      "The agent currently working the ticket. Stored as a contact for cross-reference; assignments are not auto-created in the platform.",
    icon: UserCog,
  },
];

interface Props {
  mapping: FieldMapping;
  onChange: (m: FieldMapping) => void;
  /** True if the source is JSM and contact mapping applies. */
  enabled: boolean;
}

const ROUTING_OPTIONS: {
  value: ContactRouting;
  label: string;
  helper: string;
}[] = [
  {
    value: "attach_only",
    label: "Attach to ticket only",
    helper: "Stored against the imported record for reference and reporting.",
  },
  {
    value: "attach_and_stakeholder",
    label: "Attach + create stakeholder",
    helper:
      "Also creates an entry in the Stakeholder register (deduped by email/organization).",
  },
  {
    value: "skip",
    label: "Skip",
    helper: "Don't import this contact role at all.",
  },
];

export function getContactRouting(mapping: FieldMapping): ContactRoutingMap {
  const fromMapping = (mapping.extra as {
    contactRouting?: Partial<ContactRoutingMap>;
  } | undefined)?.contactRouting;
  return { ...DEFAULT_CONTACT_ROUTING, ...(fromMapping ?? {}) };
}

export function ContactMappingStep({ mapping, onChange, enabled }: Props) {
  const routing = getContactRouting(mapping);

  const setRole = (role: ContactRole, value: ContactRouting) => {
    onChange({
      ...mapping,
      extra: {
        ...(mapping.extra ?? {}),
        contactRouting: { ...routing, [role]: value },
      },
    });
  };

  if (!enabled) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>No contact data for this source</AlertTitle>
        <AlertDescription className="text-xs">
          Customer / reporter / participant mapping only applies to Jira
          Service Management imports. You can continue to the preview step.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Contact mapping</AlertTitle>
        <AlertDescription className="text-xs">
          Decide where each Jira Service Management contact role lands inside
          the platform. "Attach to ticket only" is non-destructive; choose
          "Attach + create stakeholder" to also surface them in the
          Stakeholder register for engagement planning.
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        {ROLES.map((role) => {
          const Icon = role.icon;
          const value = routing[role.key];
          const optionMeta = ROUTING_OPTIONS.find((o) => o.value === value);
          return (
            <div
              key={role.key}
              className="rounded-md border p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{role.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {role.description}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Label
                    htmlFor={`contact-${role.key}`}
                    className="text-[10px] uppercase text-muted-foreground"
                  >
                    Destination
                  </Label>
                  <Select
                    value={value}
                    onValueChange={(v) => setRole(role.key, v as ContactRouting)}
                  >
                    <SelectTrigger
                      id={`contact-${role.key}`}
                      className="h-8 w-56 text-xs"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROUTING_OPTIONS.map((o) => (
                        <SelectItem
                          key={o.value}
                          value={o.value}
                          className="text-xs"
                          disabled={
                            // Reporter must always be attached for traceability
                            role.key === "reporter" && o.value === "skip"
                          }
                        >
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap pl-6">
                <p className="text-[11px] text-muted-foreground">
                  {optionMeta?.helper}
                </p>
                {value === "attach_and_stakeholder" && role.upgradeTarget && (
                  <Badge variant="secondary" className="text-[10px]">
                    → {role.upgradeTarget}
                  </Badge>
                )}
                {value === "skip" && (
                  <Badge variant="outline" className="text-[10px]">
                    not imported
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
