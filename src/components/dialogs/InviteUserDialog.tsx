import { useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Mail, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { toast } from "sonner";

interface InviteUserDialogProps {
  onSuccess?: () => void;
}

export function InviteUserDialog({ onSuccess }: InviteUserDialogProps) {
  const { currentOrganization } = useOrganization();
  const { canCreate, limits } = usePlanLimits();
  const [open, setOpen] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [accessLevel, setAccessLevel] = useState("editor");

  const handleOpen = (newOpen: boolean) => {
    if (newOpen && !canCreate("users")) {
      setShowUpgrade(true);
      return;
    }
    setOpen(newOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization?.id || !email) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-invite", {
        body: {
          email: email.trim(),
          organization_id: currentOrganization.id,
          access_level: accessLevel,
        },
      });
      if (error) throw error;
      if (data?.error) {
        if (data.code === "PLAN_LIMIT") {
          setOpen(false);
          setShowUpgrade(true);
          return;
        }
        throw new Error(data.error);
      }
      toast.success(
        data?.emailSent
          ? `Invitation sent to ${email}`
          : `Invitation created. Email sending isn't configured yet — share this link: ${data?.accept_url}`,
      );
      setEmail("");
      setOpen(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to send invite");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Mail className="h-4 w-4" />
            Invite User
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a teammate</DialogTitle>
            <DialogDescription>
              They'll receive an email with a link to join {currentOrganization?.name}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email *</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@company.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-access">Access level</Label>
              <Select value={accessLevel} onValueChange={setAccessLevel}>
                <SelectTrigger id="invite-access">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer — read-only</SelectItem>
                  <SelectItem value="editor">Editor — create & edit</SelectItem>
                  <SelectItem value="manager">Manager — manage resources</SelectItem>
                  <SelectItem value="admin">Admin — full control</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Send invite
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <UpgradePrompt
        open={showUpgrade}
        onOpenChange={setShowUpgrade}
        resource="user"
        currentPlan={limits?.planName}
        limit={limits?.maxUsers}
      />
    </>
  );
}
