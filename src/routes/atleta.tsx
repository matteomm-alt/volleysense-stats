import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Users, Plus, Calendar, Construction } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Team = Tables<"teams">;

export const Route = createFileRoute("/atleta")({
  component: AtletaHome,
});

function AtletaHome() {
  const { loading, session, profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [joinOpen, setJoinOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/login" });
    else if (!profile?.onboarded || !role) navigate({ to: "/onboarding" });
    else if (role !== "atleta") navigate({ to: "/coach" });
  }, [loading, session, profile, role, navigate]);

  const fetchTeams = async () => {
    if (!session?.user) return;
    setLoadingTeams(true);
    const { data: memberships, error } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("athlete_id", session.user.id);
    if (error) {
      toast.error(error.message);
      setLoadingTeams(false);
      return;
    }
    const ids = (memberships ?? []).map((m) => m.team_id);
    if (!ids.length) {
      setTeams([]);
      setLoadingTeams(false);
      return;
    }
    const { data: ts } = await supabase.from("teams").select("*").in("id", ids);
    setTeams(ts ?? []);
    setLoadingTeams(false);
  };

  useEffect(() => {
    if (session?.user && role === "atleta") fetchTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user, role]);

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
      <AppHeader
        name={profile.full_name ?? "Atleta"}
        role={role}
        onSignOut={signOut}
        maxWidth="max-w-3xl"
      />
      <main className="flex-1 container mx-auto max-w-3xl px-6 py-10">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Ciao {firstName}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Pronta ad allenarti?
        </h1>
        <p className="mt-2 text-muted-foreground">
          Le tue squadre, le schede e i tuoi progressi in un colpo d'occhio.
        </p>

        {/* Teams */}
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Le mie squadre
            </h2>
            <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4" /> Unisciti con codice
                </Button>
              </DialogTrigger>
              <JoinTeamDialog
                onJoined={() => {
                  setJoinOpen(false);
                  fetchTeams();
                }}
              />
            </Dialog>
          </div>

          {loadingTeams ? (
            <div className="mt-4 rounded-lg border bg-card p-8 grid place-items-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !teams?.length ? (
            <div className="mt-4 rounded-lg border border-dashed bg-muted/30 p-10 text-center">
              <div className="mx-auto h-12 w-12 grid place-items-center rounded-full bg-secondary">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="mt-4 font-semibold">Non sei ancora in una squadra</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                Chiedi al tuo coach il codice di invito e inseriscilo qui per unirti.
              </p>
              <Button className="mt-5" onClick={() => setJoinOpen(true)}>
                <Plus className="h-4 w-4" /> Inserisci codice
              </Button>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {teams.map((t) => (
                <div key={t.id} className="rounded-lg border bg-card p-5">
                  <h3 className="font-semibold">{t.name}</h3>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {t.category && (
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3" /> {t.category}
                      </span>
                    )}
                    {t.season && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {t.season}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Prossimamente
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <PlaceholderCard title="Schede del giorno" step="Step 5" />
            <PlaceholderCard title="Registro seduta" step="Step 5" />
            <PlaceholderCard title="Progressi" step="Step 5" />
            <PlaceholderCard title="Infortuni" step="Step 6" />
          </div>
          <div className="mt-6 rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            <Construction className="h-5 w-5 mx-auto mb-2" />
            Le funzionalità di allenamento arriveranno nei prossimi step.
          </div>
        </section>
      </main>
    </div>
  );
}

function PlaceholderCard({ title, step }: { title: string; step: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 flex items-center justify-between">
      <span className="font-medium">{title}</span>
      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground border rounded px-1.5 py-0.5">
        {step}
      </span>
    </div>
  );
}

function JoinTeamDialog({ onJoined }: { onJoined: () => void }) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleaned = code.trim().toUpperCase();
    if (!cleaned) return;
    setSubmitting(true);
    const { error } = await supabase.rpc("join_team_with_code", { _code: cleaned });
    setSubmitting(false);
    if (error) {
      const map: Record<string, string> = {
        invalid_code: "Codice non valido",
        not_athlete: "Solo gli atleti possono unirsi a una squadra",
        not_authenticated: "Devi essere loggato",
      };
      toast.error(map[error.message] ?? error.message);
      return;
    }
    toast.success("Sei nella squadra!");
    setCode("");
    onJoined();
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Unisciti a una squadra</DialogTitle>
        <DialogDescription>
          Inserisci il codice di invito di 8 caratteri ricevuto dal tuo coach.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="join-code">Codice invito</Label>
          <Input
            id="join-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD1234"
            maxLength={8}
            className="font-mono tracking-widest text-center text-lg uppercase"
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={submitting || code.length < 4}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Unisciti
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}