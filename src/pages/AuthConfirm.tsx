import { useMemo, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AuthConfirm() {
  const [loading, setLoading] = useState(false);

  const verifyUrl = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const rawUrl = params.get("verify_url");
    if (!rawUrl) return null;

    try {
      const url = new URL(rawUrl);
      return url.protocol === "https:" ? url.toString() : null;
    } catch (_error) {
      return null;
    }
  }, []);

  const handleConfirm = () => {
    if (!verifyUrl) return;
    setLoading(true);
    window.location.assign(verifyUrl);
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-12">
      <section className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold tracking-normal">Confirm your email</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Continue to activate your account and return to TaskMaster.
        </p>

        <Button className="mt-6 w-full" onClick={handleConfirm} disabled={!verifyUrl || loading}>
          {loading ? "Confirming..." : "Confirm email"}
          <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
        </Button>

        {!verifyUrl && (
          <p className="mt-4 text-sm text-destructive">
            This confirmation link is missing required information. Please request a new email.
          </p>
        )}
      </section>
    </main>
  );
}