// MFA challenge dialog shown after successful sign-in when the user has a
// verified TOTP factor (or when the org policy requires it).
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MFAChallengeDialogProps {
  open: boolean;
  onVerified: () => void;
  onCancel: () => void;
}

export function MFAChallengeDialog({ open, onVerified, onCancel }: MFAChallengeDialogProps) {
  const [mode, setMode] = useState<"totp" | "recovery">("totp");
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState("");
  const [verifying, setVerifying] = useState(false);

  const verify = async () => {
    setVerifying(true);
    try {
      const body =
        mode === "totp"
          ? { action: "verify_login", code: code.trim() }
          : { action: "verify_login", recovery_code: recovery.trim() };
      const { error } = await supabase.functions.invoke("mfa-manage", { body });
      if (error) throw error;
      sessionStorage.setItem("mfa_verified", "true");
      toast.success("Verified");
      setCode("");
      setRecovery("");
      onVerified();
    } catch (e: any) {
      toast.error(e.message ?? "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const handleCancel = async () => {
    await supabase.auth.signOut();
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Two-factor required
          </DialogTitle>
          <DialogDescription>
            {mode === "totp"
              ? "Enter the 6-digit code from your authenticator app to finish signing in."
              : "Enter one of your saved recovery codes."}
          </DialogDescription>
        </DialogHeader>

        {mode === "totp" ? (
          <div className="space-y-2">
            <Label htmlFor="mfa-code">Authenticator code</Label>
            <Input
              id="mfa-code"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              onKeyDown={(e) => e.key === "Enter" && code.length === 6 && verify()}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="recovery">Recovery code</Label>
            <Input
              id="recovery"
              autoFocus
              value={recovery}
              onChange={(e) => setRecovery(e.target.value.toUpperCase())}
              placeholder="XXXXX-XXXXX"
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => setMode(mode === "totp" ? "recovery" : "totp")}
          className="text-xs text-primary hover:underline self-start inline-flex items-center gap-1"
        >
          <KeyRound className="h-3 w-3" />
          {mode === "totp" ? "Use a recovery code instead" : "Use authenticator code"}
        </button>

        <DialogFooter>
          <Button variant="ghost" onClick={handleCancel} disabled={verifying}>
            Cancel
          </Button>
          <Button
            onClick={verify}
            disabled={verifying || (mode === "totp" ? code.length !== 6 : recovery.length < 5)}
          >
            {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verify
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
