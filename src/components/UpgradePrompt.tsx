import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface UpgradePromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: string;
  currentPlan?: string;
  limit?: number;
}

export function UpgradePrompt({
  open,
  onOpenChange,
  resource,
  currentPlan,
  limit,
}: UpgradePromptProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">
            You've reached your {resource} limit
          </DialogTitle>
          <DialogDescription className="text-center">
            Your current plan{currentPlan ? ` (${currentPlan})` : ""} allows up to{" "}
            <strong>{limit ?? "—"}</strong> {resource}. Upgrade to add more and
            unlock additional features.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              navigate("/billing");
            }}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            View plans
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
