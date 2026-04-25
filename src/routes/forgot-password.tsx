import { createFileRoute, Link } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  };

  return (
    <AuthShell
      title="Reimposta password"
      subtitle="Ti invieremo un link via email per scegliere una nuova password."
      footer={
        <>
          Ti sei ricordata?{" "}
          <Link to="/login" className="text-foreground font-medium hover:underline">
            Torna al login
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="rounded-lg border bg-muted/30 p-6 text-center space-y-3">
          <MailCheck className="h-8 w-8 mx-auto text-foreground" />
          <p className="font-medium">Email inviata</p>
          <p className="text-sm text-muted-foreground">
            Controlla la casella <span className="font-mono">{email}</span> e clicca il link
            per impostare una nuova password.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@esempio.it"
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Invia link di reset
          </Button>
        </form>
      )}
    </AuthShell>
  );
}