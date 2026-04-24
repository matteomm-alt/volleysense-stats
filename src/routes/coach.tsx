import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut, User as UserIcon, Construction } from "lucide-react";

export const Route = createFileRoute("/coach")({
  component: CoachHome,
});

function CoachHome() {
  const { loading, session, profile, role, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/login" });
    else if (!profile?.onboarded || !role) navigate({ to: "/onboarding" });
    else if (role === "atleta") navigate({ to: "/atleta" });
  }, [loading, session, profile, role, navigate]);

  if (loading || !profile) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader name={profile.full_name ?? "Coach"} role={role} onSignOut={signOut} />
      <main className="flex-1 container mx-auto max-w-6xl px-6 py-10">
        <PlaceholderArea title="Dashboard Coach" />
      </main>
    </div>
  );
}

function AppHeader({
  name,
  role,
  onSignOut,
}: {
  name: string;
  role: string | null;
  onSignOut: () => void;
}) {
  return (
    <header className="border-b bg-card">
      <div className="container mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
        <Brand />
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-sm">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-secondary">
              <UserIcon className="h-4 w-4" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-medium">{name}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {role}
              </span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onSignOut}>
            <LogOut className="h-4 w-4" />
            Esci
          </Button>
        </div>
      </div>
    </header>
  );
}

function PlaceholderArea({ title }: { title: string }) {
  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="text-muted-foreground mt-1">
            Step 1 completato. Le funzionalità arriveranno nei prossimi step.
          </p>
        </div>
        <span className="text-xs font-mono text-muted-foreground border rounded-md px-2 py-1">
          v0.1 · Setup Cloud + Auth
        </span>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card title="Atleti & Team" desc="Gestisci squadre, codici di invito, tesseramenti." step="Step 3" />
        <Card title="Periodi & Schede" desc="Pianifica periodi e crea schede per atleta o team." step="Step 4" />
        <Card title="Storico & Progressi" desc="Grafici volume, RPE, PR e confronti tra sedute." step="Step 5" />
        <Card title="Protocolli & Routine" desc="Libreria esercizi e routine pre-gara/prevenzione." step="Step 6" />
        <Card title="Infortuni" desc="Registro, calendario rientri, esercizi compensativi." step="Step 6" />
        <Card title="Presenze & Export" desc="Appello digitale, esportazione PDF/CSV." step="Step 7" />
      </div>

      <div className="mt-10 rounded-lg border border-dashed bg-muted/30 p-8 text-center">
        <Construction className="h-6 w-6 mx-auto text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">
          Ambiente pronto. Chiedimi di proseguire con lo Step successivo.
        </p>
      </div>
    </div>
  );
}

function Card({ title, desc, step }: { title: string; desc: string; step: string }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground border rounded px-1.5 py-0.5">
          {step}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}