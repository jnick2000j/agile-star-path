import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AIDraftWizardDialog, type WizardField, type WizardKind } from "./AIDraftWizardDialog";

interface Props {
  wizard: WizardKind;
  title: string;
  description: string;
  fields: WizardField[];
  entityType?: string;
  entityId?: string;
  buttonLabel?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "sm" | "default" | "lg";
  onAccept?: (content: string) => void;
}

/** Convenience launcher that ships a button + the wizard dialog wired together. */
export function AIDraftLauncher({
  wizard,
  title,
  description,
  fields,
  entityType,
  entityId,
  buttonLabel = "Draft with AI",
  variant = "outline",
  size = "sm",
  onAccept,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)} className="gap-1.5">
        <Sparkles className="h-3.5 w-3.5" />
        {buttonLabel}
      </Button>
      <AIDraftWizardDialog
        open={open}
        onOpenChange={setOpen}
        wizard={wizard}
        title={title}
        description={description}
        fields={fields}
        entityType={entityType}
        entityId={entityId}
        onAccept={onAccept}
      />
    </>
  );
}
