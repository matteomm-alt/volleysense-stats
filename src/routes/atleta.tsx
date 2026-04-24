import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut, User as UserIcon, Construction } from "lucide-react";

export const Route = createFileRoute("/atleta")({
  component: AtletaHome,
});

function AtletaHome() {
  const { loading, session, profile, role, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/login" });
    else if (!profile?.onboarded || !role) navigate({ to: "/onboarding" });
    else if (role !== "atleta") navigate({ to: "/coach" });
  }, [loading, session, profile, role, navigate]);

  if (loading || !profile) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const firstName = (profile.full_name ?? "Atleta").split(" ")[0];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-card">
        <div className="container mx-auto max-w-3xl px-6 h-14 flex items-center justify-between">
          <Brand />
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-secondary">
                <UserIcon className="h-4 w-4" />
              </div>
              <span className="font-medium">{profile.full_name}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
              Esci
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto max-w-3xl px-6 py-10">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Ciao {firstName}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Pronta ad allenarti?</h1>
        <p className="mt-2 text-muted-foreground">
          Step 1 completato. Le tue schede compariranno qui non appena il coach te le assegnerà.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Card title="Schede del giorno" step="Step 5" />
          <Card title="Registro seduta" step="Step 5" />
          <Card title="Progressi" step="Step 5" />
          <Card title="Infortuni" step="Step 6" />
        </div>

        <div className="mt-10 rounded-lg border border-dashed bg-muted/30 p-8 text-center">
          <Construction className="h-6 w-6 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Account pronto. In attesa di assegnazione team.
          </p>
        </div>
      </main>
    </div>
  );
}

function Card({ title, step }: { title: string; step: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 flex items-center justify-between">
      <span className="font-medium">{title}</span>
      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground border rounded px-1.5 py-0.5">
        {step}
      </span>
    </div>
  );
}