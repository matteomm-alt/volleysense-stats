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
  CalendarRange,
  ClipboardList,
  Gauge,
  BookMarked,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Team = Tables<"teams"> & { _athletesCount?: number };
type Periodo = Tables<"periodi">;

export const Route = createFileRoute("/coach/")({
  component: CoachHome,
});

function CoachHome() {
  const { loading, session, profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [quickPeriodoOpen, setQuickPeriodoOpen] = useState(false);
  const [quickSchedaOpen, setQuickSchedaOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [athleteMatches, setAthleteMatches] = useState<
    { id: string; name: string; teamId: string; teamName: string; kind: "athlete" | "placeholder" }[]
  >([]);

  useEffect(() => {
    const q = globalSearch.trim();
    if (q.length < 2 || !teams || teams.length === 0) {
      setAthleteMatches([]);
      return;
    }
    let cancelled = false;
    const run = async () => {
      const teamIds = teams.map((t) => t.id);
      const teamNameMap = new Map(teams.map((t) => [t.id, t.name]));
      const [{ data: phs }, { data: tm }] = await Promise.all([
        supabase
          .from("atleti_placeholder")
          .select("id, full_name, team_id")
          .in("team_id", teamIds)
          .is("linked_athlete_id", null)
          .ilike("full_name", `%${q}%`)
          .limit(20),
        supabase
          .from("team_members")
          .select("athlete_id, team_id")
          .in("team_id", teamIds),
      ]);
      const athleteIds = Array.from(new Set((tm ?? []).map((r) => r.athlete_id)));
      let profMatches: { id: string; full_name: string | null }[] = [];
      if (athleteIds.length) {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", athleteIds)
          .ilike("full_name", `%${q}%`)
          .limit(20);
        profMatches = data ?? [];
      }
      if (cancelled) return;
      const matchIds = new Set(profMatches.map((p) => p.id));
      const athleteRows = (tm ?? [])
        .filter((r) => matchIds.has(r.athlete_id))
        .map((r) => {
          const p = profMatches.find((x) => x.id === r.athlete_id)!;
          return {
            id: p.id,
            name: p.full_name ?? "Atleta",
            teamId: r.team_id,
            teamName: teamNameMap.get(r.team_id) ?? "",
            kind: "athlete" as const,
          };
        });
      const phRows = (phs ?? []).map((p) => ({
        id: p.id,
        name: p.full_name ?? "Atleta",
        teamId: p.team_id,
        teamName: teamNameMap.get(p.team_id) ?? "",
        kind: "placeholder" as const,
      }));
      setAthleteMatches([...athleteRows, ...phRows].slice(0, 15));
    };
    const t = setTimeout(run, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [globalSearch, teams]);

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

        {/* Azioni rapide */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Azioni rapide
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <QuickActionCard
              icon={<Users className="h-4 w-4 text-primary" />}
              title="Nuova squadra"
              subtitle="Crea una squadra e ottieni il codice invito"
              onClick={() => setCreateOpen(true)}
            />
            <QuickActionCard
              icon={<CalendarRange className="h-4 w-4 text-primary" />}
              title="Nuovo periodo"
              subtitle="Definisci un mesociclo per una squadra"
              onClick={() => setQuickPeriodoOpen(true)}
            />
            <QuickActionCard
              icon={<ClipboardList className="h-4 w-4 text-primary" />}
              title="Nuova scheda"
              subtitle="Aggiungi una scheda alla settimana tipo"
              onClick={() => setQuickSchedaOpen(true)}
            />
            <QuickLinkCard
              to="/coach/test"
              icon={<Gauge className="h-4 w-4 text-primary" />}
              title="Test atletici"
              subtitle="Registra e confronta i risultati dei test"
            />
            <QuickLinkCard
              to={"/coach/templates" as unknown as string}
              icon={<BookMarked className="h-4 w-4 text-primary" />}
              title="Template schede"
              subtitle="La tua libreria di schede riutilizzabili"
            />
          </div>
        </section>

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
          <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Squadre & atleti
            </h2>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cerca squadra o atleta..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {globalSearch.trim().length >= 2 && athleteMatches.length > 0 && (
            <div className="mb-4 rounded-lg border bg-card divide-y overflow-hidden">
              <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/40">
                Atleti ({athleteMatches.length})
              </div>
              {athleteMatches.map((a) => (
                <Link
                  key={`${a.kind}-${a.id}`}
                  to="/coach/team/$teamId"
                  params={{ teamId: a.teamId }}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{a.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {a.teamName}{a.kind === "placeholder" ? " · In attesa" : ""}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              ))}
            </div>
          )}

          {loadingTeams ? (
            <div className="rounded-lg border bg-card p-12 grid place-items-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !teams?.length ? (
            <EmptyState onCreate={() => setCreateOpen(true)} />
          ) : (() => {
            const q = globalSearch.trim().toLowerCase();
            const list = q.length >= 2
              ? teams.filter((t) => t.name.toLowerCase().includes(q))
              : teams;
            if (list.length === 0 && athleteMatches.length === 0) {
              return (
                <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                  Nessun risultato per "{globalSearch}"
                </div>
              );
            }
            return (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((t) => (
                  <TeamCard key={t.id} team={t} />
                ))}
              </div>
            );
          })()}
        </section>
      </main>

      <Dialog open={quickPeriodoOpen} onOpenChange={setQuickPeriodoOpen}>
        <QuickPeriodoDialog
          teams={teams ?? []}
          onCreated={() => setQuickPeriodoOpen(false)}
        />
      </Dialog>
      <Dialog open={quickSchedaOpen} onOpenChange={setQuickSchedaOpen}>
        <QuickSchedaDialog
          teams={teams ?? []}
          onCreated={() => setQuickSchedaOpen(false)}
        />
      </Dialog>
    </div>
  );
}

function QuickLinkCard({
  to,
  icon,
  title,
  subtitle,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      to={to as any}
      className="group text-left rounded-lg border bg-card p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 group-hover:bg-primary/15 transition-colors shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-sm">{title}</div>
          <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
    </Link>
  );
}

function QuickActionCard({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left rounded-lg border bg-card p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 group-hover:bg-primary/15 transition-colors shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-sm">{title}</div>
          <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
    </button>
  );
}

function QuickPeriodoDialog({
  teams,
  onCreated,
}: {
  teams: Team[];
  onCreated: () => void;
}) {
  const [teamId, setTeamId] = useState("");
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!teamId || !name || !startDate || !endDate) {
      toast.error("Compila tutti i campi");
      return;
    }
    setSubmitting(true);
    const { data: periodo, error: pErr } = await supabase
      .from("periodi")
      .insert({
        team_id: teamId,
        name,
        start_date: startDate,
        end_date: endDate,
        order_index: 0,
      })
      .select()
      .single();
    if (pErr || !periodo) {
      setSubmitting(false);
      toast.error(pErr?.message ?? "Errore creazione periodo");
      return;
    }
    const { error: sErr } = await supabase.from("settimane").insert({
      periodo_id: periodo.id,
      team_id: teamId,
      week_number: 0,
      is_template: true,
    });
    setSubmitting(false);
    if (sErr) {
      toast.error(sErr.message);
      return;
    }
    toast.success("Periodo creato");
    setTeamId("");
    setName("");
    setStartDate("");
    setEndDate("");
    onCreated();
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Nuovo periodo</DialogTitle>
        <DialogDescription>
          Crea un mesociclo per una squadra. Verrà generata automaticamente la settimana tipo.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="qp-team">Squadra *</Label>
          <select
            id="qp-team"
            required
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Seleziona…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="qp-name">Nome periodo *</Label>
          <Input
            id="qp-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="es. Preparazione generale"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="qp-start">Inizio *</Label>
            <Input
              id="qp-start"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="qp-end">Fine *</Label>
            <Input
              id="qp-end"
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Crea periodo
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function QuickSchedaDialog({
  teams,
  onCreated,
}: {
  teams: Team[];
  onCreated: () => void;
}) {
  const [teamId, setTeamId] = useState("");
  const [periodoId, setPeriodoId] = useState("");
  const [periodi, setPeriodi] = useState<Periodo[]>([]);
  const [loadingPeriodi, setLoadingPeriodi] = useState(false);
  const [title, setTitle] = useState("");
  const [dayLabel, setDayLabel] = useState("A");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!teamId) {
      setPeriodi([]);
      setPeriodoId("");
      return;
    }
    setLoadingPeriodi(true);
    supabase
      .from("periodi")
      .select("*")
      .eq("team_id", teamId)
      .order("start_date", { ascending: false })
      .then(({ data, error }) => {
        setLoadingPeriodi(false);
        if (error) {
          toast.error(error.message);
          return;
        }
        setPeriodi(data ?? []);
        setPeriodoId("");
      });
  }, [teamId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!teamId || !periodoId || !title) {
      toast.error("Compila tutti i campi");
      return;
    }
    setSubmitting(true);
    const { data: sett, error: sErr } = await supabase
      .from("settimane")
      .select("id")
      .eq("periodo_id", periodoId)
      .eq("is_template", true)
      .limit(1)
      .maybeSingle();
    if (sErr || !sett) {
      setSubmitting(false);
      toast.error(sErr?.message ?? "Settimana tipo non trovata");
      return;
    }
    const { data: existing, error: exErr } = await supabase
      .from("schede")
      .select("day_label, day_order")
      .eq("settimana_id", sett.id);
    if (exErr) {
      setSubmitting(false);
      toast.error(exErr.message);
      return;
    }
    const sameLabel = (existing ?? []).find(
      (s) => (s.day_label ?? "") === dayLabel && !!dayLabel,
    );
    const day_order = sameLabel
      ? (sameLabel.day_order ?? 0)
      : (existing ?? []).length > 0
        ? Math.max(...(existing ?? []).map((s) => s.day_order ?? 0)) + 1
        : 0;
    const { error } = await supabase.from("schede").insert({
      team_id: teamId,
      settimana_id: sett.id,
      title,
      day_label: dayLabel,
      day_order,
      order_index: day_order,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Scheda creata");
    setTitle("");
    setDayLabel("A");
    onCreated();
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Nuova scheda</DialogTitle>
        <DialogDescription>
          Aggiungi una scheda alla settimana tipo di un periodo.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="qs-team">Squadra *</Label>
          <select
            id="qs-team"
            required
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Seleziona…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="qs-periodo">Periodo *</Label>
          <select
            id="qs-periodo"
            required
            disabled={!teamId || loadingPeriodi}
            value={periodoId}
            onChange={(e) => setPeriodoId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">
              {loadingPeriodi ? "Caricamento…" : periodi.length ? "Seleziona…" : "Nessun periodo"}
            </option>
            {periodi.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="qs-title">Nome scheda *</Label>
          <Input
            id="qs-title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="es. Forza upper"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="qs-day">Giorno *</Label>
          <select
            id="qs-day"
            value={dayLabel}
            onChange={(e) => setDayLabel(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {["A", "B", "C", "D", "E"].map((d) => (
              <option key={d} value={d}>
                Giorno {d}
              </option>
            ))}
          </select>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Crea scheda
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
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