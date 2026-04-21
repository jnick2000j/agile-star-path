import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Check, X, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function AcceptInvite() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const token = params.get("token");
  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Missing invitation token");
      setLoading(false);
      return;
    }
    supabase
      .rpc("get_invitation_by_token", { _token: token })
      .then(({ data, error }) => {
        if (error || !data || data.length === 0) {
          setError("Invitation not found");
        } else {
          const inv = data[0];
          if (inv.status !== "pending") {
            setError("This invitation has already been used");
          } else if (new Date(inv.expires_at) < new Date()) {
            setError("This invitation has expired");
          } else {
            setInvite(inv);
          }
        }
        setLoading(false);
      });
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    try {
      const { data, error } = await supabase.rpc("accept_invitation", { _token: token });
      if (error) throw error;
      const orgId = (data as any)?.organization_id;
      if (orgId) localStorage.setItem("currentOrganizationId", orgId);
      toast.success(`Welcome to ${invite.organization_name}!`);
      navigate("/");
      setTimeout(() => window.location.reload(), 100);
    } catch (err: any) {
      const msg: string = err?.message || "Failed to accept invitation";
      // Detect suspension errors raised by the RPC and surface them inline.
      if (/suspended/i.test(msg)) {
        setError(msg);
      } else {
        toast.error(msg);
      }
    } finally {
      setAccepting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-8 max-w-md text-center">
          <div className="h-12 w-12 rounded-full bg-destructive/10 mx-auto flex items-center justify-center mb-4">
            <X className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="text-xl font-bold mb-2">Invitation problem</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => navigate("/")}>Go home</Button>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-8 max-w-md text-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 mx-auto flex items-center justify-center mb-4">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-xl font-bold mb-2">You're invited!</h2>
          <p className="text-muted-foreground mb-2">
            <strong>{invite.organization_name}</strong> wants you to join with{" "}
            <strong>{invite.access_level}</strong> access.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Please sign in or create an account using <strong>{invite.email}</strong> to
            accept.
          </p>
          <div className="flex flex-col gap-2">
            <Button
              onClick={() =>
                navigate(`/auth?invite=${token}&email=${encodeURIComponent(invite.email)}`)
              }
            >
              Sign in / Sign up
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="p-8 max-w-md text-center">
        <div className="h-12 w-12 rounded-full bg-primary/10 mx-auto flex items-center justify-center mb-4">
          <Check className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-bold mb-2">Join {invite.organization_name}</h2>
        <p className="text-muted-foreground mb-6">
          You'll be added with <strong>{invite.access_level}</strong> access.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => navigate("/")}>
            Decline
          </Button>
          <Button className="flex-1 gap-2" onClick={handleAccept} disabled={accepting}>
            {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Accept invite"}
          </Button>
        </div>
        {user.email?.toLowerCase() !== invite.email.toLowerCase() && (
          <p className="text-xs text-warning mt-4">
            Heads up: your account email ({user.email}) doesn't match the invite ({invite.email}).
            Acceptance will fail.
          </p>
        )}
      </Card>
    </div>
  );
}
