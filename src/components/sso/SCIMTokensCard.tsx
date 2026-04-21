import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";
import {
  Key,
  Plus,
  Copy,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";

interface ScimToken {
  id: string;
  name: string;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
}

const SCIM_BASE_URL = `https://lpsbudbighowwdmgdfyc.supabase.co/functions/v1/scim-v2`;

export function SCIMTokensCard() {
  const { currentOrganization } = useOrganization();
  const [tokens, setTokens] = useState<ScimToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);

  useEffect(() => {
    if (currentOrganization?.id) load();
  }, [currentOrganization?.id]);

  const load = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("scim_tokens")
      .select("id, name, last_used_at, created_at, expires_at, revoked_at")
      .eq("organization_id", currentOrganization.id)
      .order("created_at", { ascending: false });
    setTokens((data ?? []) as ScimToken[]);
    setLoading(false);
  };

  const generateToken = async () => {
    if (!currentOrganization?.id || !newTokenName.trim()) {
      toast.error("Token name is required");
      return;
    }
    setCreating(true);
    try {
      // Generate a random 32-byte token, hex-encode
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      const raw = "scim_" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");

      const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
      const hash = Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const { error } = await supabase.from("scim_tokens").insert({
        organization_id: currentOrganization.id,
        name: newTokenName.trim(),
        token_hash: hash,
        token_prefix: raw.slice(0, 12),
      });
      if (error) throw error;

      setRevealedToken(raw);
      setNewTokenName("");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to create token");
    } finally {
      setCreating(false);
    }
  };

  const revokeToken = async (id: string) => {
    if (!confirm("Revoke this token? Any active SCIM clients using it will stop working immediately.")) return;
    const { error } = await supabase
      .from("scim_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Token revoked");
    await load();
  };

  const copy = (v: string, label: string) => {
    navigator.clipboard.writeText(v);
    toast.success(`${label} copied`);
  };

  return (
    <>
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Key className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold">SCIM 2.0 Provisioning</h3>
              <p className="text-sm text-muted-foreground">
                Generate bearer tokens for your IdP to provision users via SCIM.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setRevealedToken(null);
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            New token
          </Button>
        </div>

        <div className="space-y-2 mb-4">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            SCIM Base URL
          </Label>
          <div className="flex gap-2">
            <Input value={SCIM_BASE_URL} readOnly className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={() => copy(SCIM_BASE_URL, "URL")}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Configure this URL plus a token below in your IdP's SCIM provisioning settings (Okta,
            Azure AD, etc.).
          </p>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground py-4">Loading...</div>
        ) : tokens.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
            No tokens yet. Create one to start provisioning users via SCIM.
          </div>
        ) : (
          <div className="space-y-2">
            {tokens.map((t) => {
              const revoked = !!t.revoked_at;
              const expired = t.expires_at && new Date(t.expires_at) < new Date();
              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{t.name}</span>
                      {revoked && (
                        <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/20">
                          Revoked
                        </Badge>
                      )}
                      {!revoked && expired && (
                        <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/20">
                          Expired
                        </Badge>
                      )}
                      {!revoked && !expired && (
                        <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                          Active
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Created {format(new Date(t.created_at), "MMM d, yyyy")}
                      {t.last_used_at &&
                        ` • Last used ${format(new Date(t.last_used_at), "MMM d, yyyy")}`}
                    </div>
                  </div>
                  {!revoked && (
                    <Button variant="ghost" size="icon" onClick={() => revokeToken(t.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create SCIM token</DialogTitle>
            <DialogDescription>
              Generate a new bearer token. You'll only see the value once.
            </DialogDescription>
          </DialogHeader>

          {!revealedToken ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token-name">Token name</Label>
                <Input
                  id="token-name"
                  placeholder="Okta production"
                  value={newTokenName}
                  onChange={(e) => setNewTokenName(e.target.value)}
                />
              </div>
              <Button onClick={generateToken} disabled={creating} className="w-full">
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate token"
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Copy this token now. It will not be shown again.
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Bearer token
                </Label>
                <div className="flex gap-2">
                  <Input value={revealedToken} readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => copy(revealedToken, "Token")}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Button
                onClick={() => {
                  setCreateOpen(false);
                  setRevealedToken(null);
                }}
                className="w-full"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                I've saved it
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
