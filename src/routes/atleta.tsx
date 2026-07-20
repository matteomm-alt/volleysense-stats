import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { joinTeamWithCode } from "@/lib/teams.functions";
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
import { Loader2, Users, Plus, Calendar, Dumbbell, ChevronRight, ClipboardList, TrendingUp, HeartPulse, Sparkles, X } from "lucide-react";
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
  const [placeholderBanner, setPlaceholderBanner] = useState<{
    name: string;
    teamNames: string[];
  } | null>(null);

  useEffect(() => {
    if (!session?.user) return;
    const dismissKey = `vs-placeholder-welcome-${session.user.id}`;
    if (typeof window !== "undefined" && window.localStorage.getItem(dismissKey) === "1") return;
    (async () => {
      const { data: linked } = await supabase
        .from("atleti_placeholder")
        .select("full_name, team_id, teams(name)")
        .eq("linked_athlete_id", session.user.id);
      if (linked && linked.length > 0) {
        const name = linked[0].full_name ?? "";
        const teamNames = linked
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((l: any) => l.teams?.name)
          .filter(Boolean) as string[];
        setPlaceholderBanner({ name, teamNames });
      }
    })();
  }, [session?.user]);

  const dismissBanner = () => {
    if (session?.user && typeof window !== "undefined") {
      window.localStorage.setItem(`vs-placeholder-welcome-${session.user.id}`, "1");
    }
    setPlaceholderBanner(null);
  };

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

        {placeholderBanner && (
          <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm">Bentornato/a nel tuo profilo</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Il tuo coach aveva già preparato una scheda per te
                  {placeholderBanner.name ? <> come <strong>{placeholderBanner.name}</strong></> : null}
                  {placeholderBanner.teamNames.length > 0 && (
                    <> in <strong>{placeholderBanner.teamNames.join(", ")}</strong></>
                  )}
                  . Trovi già le schede assegnate, lo storico e i risultati dei test collegati al tuo account.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to={"/atleta/schede" as any}>
                    <Button size="sm" variant="outline">
                      <ClipboardList className="h-4 w-4" /> Vedi le schede
                    </Button>
                  </Link>
                  <Link to={"/atleta/storico" as any}>
                    <Button size="sm" variant="ghost">Storico</Button>
                  </Link>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={dismissBanner}
                className="shrink-0 text-muted-foreground"
                aria-label="Chiudi"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

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

        <section className="mt-10 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Allenamento
          </h2>

          {/* Registra seduta — attivo */}
          <Link to={"/atleta/registro" as any}>
            <div className="rounded-lg border bg-card p-4 flex items-center justify-between hover:bg-muted/50 transition-colors cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 group-hover:bg-primary/15 transition-colors">
                  <Dumbbell className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-sm">Registra seduta</div>
                  <div className="text-xs text-muted-foreground">RPE, esercizi, carico</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
          </Link>

          {/* Schede — attivo */}
          <Link to={"/atleta/schede" as any}>
            <div className="rounded-lg border bg-card p-4 flex items-center justify-between hover:bg-muted/50 transition-colors cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 group-hover:bg-primary/15 transition-colors">
                  <ClipboardList className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-sm">Schede del giorno</div>
                  <div className="text-xs text-muted-foreground">Esercizi assegnati dal coach</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
          </Link>

          {/* Storico — attivo */}
          <Link to={"/atleta/storico" as any}>
            <div className="rounded-lg border bg-card p-4 flex items-center justify-between hover:bg-muted/50 transition-colors cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 group-hover:bg-primary/15 transition-colors">
                  <ClipboardList className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-sm">Storico allenamenti</div>
                  <div className="text-xs text-muted-foreground">Ultime sessioni registrate</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
          </Link>

          {/* Progressi — attivo */}
          <Link to={"/atleta/progressi" as any}>
            <div className="rounded-lg border bg-card p-4 flex items-center justify-between hover:bg-muted/50 transition-colors cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 group-hover:bg-primary/15 transition-colors">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-sm">Progressi</div>
                  <div className="text-xs text-muted-foreground">Grafici RPE, volume e carichi</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
          </Link>

          {/* Infortuni — prossimamente */}
          <div className="rounded-lg border bg-card p-4 flex items-center justify-between opacity-50 cursor-not-allowed">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-secondary">
                <HeartPulse className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <div className="font-semibold text-sm">Infortuni</div>
                <div className="text-xs text-muted-foreground">Registro e restrizioni</div>
              </div>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground border rounded px-1.5 py-0.5">
              Presto
            </span>
          </div>
        </section>
      </main>
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
    try {
      await joinTeamWithCode({ data: { code: cleaned } });
    } catch (err) {
      setSubmitting(false);
      const msg = err instanceof Error ? err.message : String(err);
      const map: Record<string, string> = {
        invalid_code: "Codice non valido",
        not_athlete: "Solo gli atleti possono unirsi a una squadra",
        not_authenticated: "Devi essere loggato",
      };
      toast.error(map[msg] ?? msg);
      return;
    }
    setSubmitting(false);
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
