import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);

  useEffect(() => {
    // Supabase emits PASSWORD_RECOVERY when arriving via the email link
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryReady(true);
    });
    // Fallback: if a session already exists from the recovery link, allow update
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setRecoveryReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Le password non coincidono");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password aggiornata");
    navigate({ to: "/" });
  };

  return (
    <AuthShell
      title="Nuova password"
      subtitle="Scegli una password sicura per il tuo account."
      footer={
        <>
          <Link to="/login" className="text-foreground font-medium hover:underline">
            Torna al login
          </Link>
        </>
      }
    >
      {!recoveryReady ? (
        <div className="rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground text-center">
          Apri questa pagina dal link ricevuto via email.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nuova password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Conferma password</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Aggiorna password
          </Button>
        </form>
      )}
    </AuthShell>
  );
}