import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, ShieldOff, KeyRound, Smartphone, Copy, Trash2, RefreshCw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface Factor {
  id: string;
  friendly_name: string | null;
  factor_type: string;
  verified: boolean;
  last_used_at: string | null;
  created_at: string;
}

export function MFASettingsCard() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollState, setEnrollState] = useState<{
    factor_id: string;
    otpauth_url: string;
    secret_base32: string;
  } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [friendlyName, setFriendlyName] = useState("Authenticator");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_mfa_factors")
      .select("id, friendly_name, factor_type, verified, last_used_at, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error("Failed to load MFA factors");
    setFactors(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const startEnroll = async () => {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.functions.invoke("mfa-manage", {
        body: { action: "enroll", friendly_name: friendlyName },
      });
      if (error) throw error;
      setEnrollState({
        factor_id: data.factor_id,
        otpauth_url: data.otpauth_url,
        secret_base32: data.secret_base32,
      });
    } catch (e: any) {
      toast.error(e.message ?? "Enrollment failed");
    } finally {
      setEnrolling(false);
    }
  };

  const confirmEnroll = async () => {
    if (!enrollState) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("mfa-manage", {
        body: { action: "verify", factor_id: enrollState.factor_id, code: verifyCode },
      });
      if (error) throw error;
      if (data.recovery_codes) setRecoveryCodes(data.recovery_codes);
      toast.success("Two-factor authentication enabled");
      setVerifyCode("");
      setEnrollState(null);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const disable = async (factorId: string) => {
    if (!confirm("Disable this authenticator? You will lose 2FA protection.")) return;
    const { error } = await supabase.functions.invoke("mfa-manage", {
      body: { action: "disable", factor_id: factorId },
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Authenticator removed");
    load();
  };

  const regenerate = async () => {
    if (!confirm("Regenerate recovery codes? Old codes will stop working immediately.")) return;
    const { data, error } = await supabase.functions.invoke("mfa-manage", {
      body: { action: "regenerate_codes" },
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setRecoveryCodes(data.recovery_codes);
  };

  const copyCodes = () => {
    if (!recoveryCodes) return;
    navigator.clipboard.writeText(recoveryCodes.join("\n"));
    toast.success("Recovery codes copied to clipboard");
  };

  const hasVerified = factors.some((f) => f.verified);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Two-factor authentication
              </CardTitle>
              <CardDescription>
                Add an extra layer of security with a TOTP app like 1Password, Authy, or Google
                Authenticator.
              </CardDescription>
            </div>
            <Badge variant={hasVerified ? "default" : "secondary"}>
              {hasVerified ? "Active" : "Not configured"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <Skeleton className="h-20 w-full" />
          ) : factors.length === 0 ? (
            <Alert>
              <ShieldOff className="h-4 w-4" />
              <AlertTitle>No authenticator configured</AlertTitle>
              <AlertDescription>
                Enable 2FA to require a second verification step at sign-in.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              {factors.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{f.friendly_name ?? "Authenticator"}</p>
                      <p className="text-xs text-muted-foreground">
                        {f.verified ? "Verified" : "Pending verification"} ·{" "}
                        {f.last_used_at
                          ? `Last used ${new Date(f.last_used_at).toLocaleDateString()}`
                          : "Never used"}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => disable(f.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setEnrollOpen(true)} variant="default">
              <ShieldCheck className="mr-2 h-4 w-4" />
              Add authenticator
            </Button>
            {hasVerified && (
              <Button onClick={regenerate} variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Regenerate recovery codes
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={enrollOpen} onOpenChange={(o) => { setEnrollOpen(o); if (!o) { setEnrollState(null); setVerifyCode(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set up two-factor authentication</DialogTitle>
            <DialogDescription>
              Scan the QR code with your authenticator app, then enter the 6-digit code to confirm.
            </DialogDescription>
          </DialogHeader>

          {!enrollState ? (
            <div className="space-y-3">
              <Label htmlFor="friendly">Device name</Label>
              <Input
                id="friendly"
                value={friendlyName}
                onChange={(e) => setFriendlyName(e.target.value)}
                placeholder="e.g. iPhone 15"
              />
              <Button onClick={startEnroll} disabled={enrolling} className="w-full">
                {enrolling ? "Generating…" : "Generate QR code"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-center rounded-md border bg-card p-4">
                <QRCodeSVG value={enrollState.otpauth_url} size={192} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Or enter this secret manually</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-2 py-1 text-xs font-mono break-all">
                    {enrollState.secret_base32}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(enrollState.secret_base32);
                      toast.success("Secret copied");
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="code">6-digit code</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            {enrollState && (
              <Button onClick={confirmEnroll} disabled={verifying || verifyCode.length !== 6}>
                {verifying ? "Verifying…" : "Verify & enable"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!recoveryCodes} onOpenChange={(o) => !o && setRecoveryCodes(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Save your recovery codes
            </DialogTitle>
            <DialogDescription>
              Store these in a safe place. Each code works once if you lose your authenticator. They
              will <strong>not be shown again</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/40 p-3 font-mono text-sm">
            {recoveryCodes?.map((c) => (
              <div key={c} className="rounded bg-background px-2 py-1 text-center">
                {c}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={copyCodes}>
              <Copy className="mr-2 h-4 w-4" />
              Copy all
            </Button>
            <Button onClick={() => setRecoveryCodes(null)}>I've saved them</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
