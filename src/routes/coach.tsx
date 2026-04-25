import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Plus,
  Users,
  ChevronRight,
  Activity,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Team = Tables<"teams"> & { _athletesCount?: number };

export const Route = createFileRoute("/coach")({
  component: CoachHome,
});

function CoachHome() {
  const { loading, session, profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/login" });
    else if (!profile?.onboarded || !role) navigate({ to: "/onboarding" });
    else if (role === "atleta") navigate({ to: "/atleta" });
  }, [loading, session, profile, role, navigate]);

  const fetchTeams = async () => {
    if (!session?.user) return;
    setLoadingTeams(true);
    const { data, error } = await supabase
      .from("teams")
      .select("*, team_members(athlete_id)")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoadingTeams(false);
      return;
    }
    setTeams(
      (data ?? []).map((t: any) => ({
        ...t,
        _athletesCount: t.team_members?.length ?? 0,
      })),
    );
    setLoadingTeams(false);
  };

  useEffect(() => {
    if (session?.user && role && role !== "atleta") fetchTeams();
  }, [session?.user, role]);

  if (loading || !profile) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalAthletes = (teams ?? []).reduce((sum, t) => sum + (t._athletesCount ?? 0), 0);

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader name={profile.full_name ?? "Coach"} role={role} onSignOut={signOut} />
      <main className="flex-1 container mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Le tue squadre
            </h1>
            <p className="mt-1 text-muted-foreground">
              Crea squadre, condividi i codici di invito e monitora i tuoi atleti.
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Nuova squadra
              </Button>
            </DialogTrigger>
            <CreateTeamDialog
              onCreated={() => {
                setCreateOpen(false);
                fetchTeams();
              }}
            />
          </Dialog>
        </div>

        {/* Stats */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={<Users className="h-4 w-4" />}
            label="Squadre"
            value={(teams?.length ?? 0).toString()}
          />
          <StatCard
            icon={<Activity className="h-4 w-4" />}
            label="Atleti totali"
            value={totalAthletes.toString()}
          />
          <StatCard
            icon={<Calendar className="h-4 w-4" />}
            label="Stagione attiva"
            value={teams?.[0]?.season ?? "—"}
          />
        </div>

        {/* Teams list */}
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Squadre
          </h2>
          {loadingTeams ? (
            <div className="rounded-lg border bg-card p-12 grid place-items-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !teams?.length ? (
            <EmptyState onCreate={() => setCreateOpen(true)} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {teams.map((t) => (
                <TeamCard key={t.id} team={t} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-3xl font-mono font-semibold">{value}</div>
    </div>
  );
}

function TeamCard({ team }: { team: Team }) {
  return (
    <Link
      to="/coach/team/$teamId"
      params={{ teamId: team.id }}
      className="group rounded-lg border bg-card p-5 hover:border-foreground/20 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{team.name}</h3>
          {team.category && (
            <p className="text-xs text-muted-foreground mt-0.5">{team.category}</p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono">{team._athletesCount ?? 0}</span>
          <span className="text-muted-foreground">atleti</span>
        </div>
        <Badge variant="secondary" className="font-mono text-[10px]">
          {team.invite_code}
        </Badge>
      </div>
    </Link>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/30 p-12 text-center">
      <div className="mx-auto h-12 w-12 grid place-items-center rounded-full bg-secondary">
        <Users className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="mt-4 font-semibold">Nessuna squadra</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
        Crea la tua prima squadra per iniziare a invitare atlete e atleti e pianificare il
        lavoro.
      </p>
      <Button className="mt-5" onClick={onCreate}>
        <Plus className="h-4 w-4" /> Crea la prima squadra
      </Button>
    </div>
  );
}

function CreateTeamDialog({ onCreated }: { onCreated: () => void }) {
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [season, setSeason] = useState(`${new Date().getFullYear()}/${(new Date().getFullYear() + 1).toString().slice(-2)}`);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;
    setSubmitting(true);
    const { error } = await supabase.from("teams").insert({
      name,
      category: category || null,
      season: season || null,
      description: description || null,
      owner_coach_id: session.user.id,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Squadra creata");
    setName("");
    setCategory("");
    setDescription("");
    onCreated();
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Nuova squadra</DialogTitle>
        <DialogDescription>
          Inserisci i dati di base. Riceverai un codice di invito da condividere con gli
          atleti.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="t-name">Nome squadra *</Label>
          <Input
            id="t-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="es. Serie B Femminile"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="t-cat">Categoria</Label>
            <Input
              id="t-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Under 18, Serie C..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-season">Stagione</Label>
            <Input
              id="t-season"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              placeholder="2025/26"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="t-desc">Note</Label>
          <Textarea
            id="t-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Obiettivi stagionali, focus tecnico..."
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Crea squadra
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}