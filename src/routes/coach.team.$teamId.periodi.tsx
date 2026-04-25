import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  ChevronLeft,
  Plus,
  Trash2,
  CalendarRange,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

// ─── Tipi ─────────────────────────────────────────────────────────────────────

type Team    = Tables<"teams">;
type Periodo = Tables<"periodi">;
type Scheda  = Tables<"schede">;

type PeriodoWithSchede = Periodo & { schede: Scheda[] };

// ─── Route ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/coach/team/$teamId/periodi")({
  component: PeriodiPage,
});

function PeriodiPage() {
  const { teamId } = Route.useParams();
  const { loading, session, profile, role, signOut } = useAuth();
  const navigate = useNavigate();

  const [team, setTeam]       = useState<Team | null>(null);
  const [periodi, setPeriodi] = useState<PeriodoWithSchede[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Dialog nuovo periodo
  const [newPeriodoOpen, setNewPeriodoOpen] = useState(false);
  const [periodoName, setPeriodoName]       = useState("");
  const [periodoStart, setPeriodoStart]     = useState("");
  const [periodoEnd, setPeriodoEnd]         = useState("");
  const [periodoDesc, setPeriodoDesc]       = useState("");
  const [savingPeriodo, setSavingPeriodo]   = useState(false);

  // Dialog nuova scheda
  const [newSchedaOpen, setNewSchedaOpen]     = useState(false);
  const [schedaForPeriodo, setSchedaForPeriodo] = useState<string | null>(null);
  const [schedaTitle, setSchedaTitle]         = useState("");
  const [schedaDesc, setSchedaDesc]           = useState("");
  const [schedaIsTemplate, setSchedaIsTemplate] = useState(false);
  const [savingScheda, setSavingScheda]       = useState(false);

  // Periodi espansi/collassati
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // ─── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!session) navigate({ to: "/login" as any });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    else if (!profile?.onboarded || !role) navigate({ to: "/onboarding" as any });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    else if (role === "atleta") navigate({ to: "/atleta" as any });
  }, [loading, session, profile, role, navigate]);

  // ─── Fetch dati ─────────────────────────────────────────────────────────────
  const fetchData = async () => {
    setLoadingData(true);
    try {
      const [{ data: t }, { data: per }, { data: sch }] = await Promise.all([
        supabase.from("teams").select("*").eq("id", teamId).maybeSingle(),
        supabase
          .from("periodi")
          .select("*")
          .eq("team_id", teamId)
          .order("order_index", { ascending: true }),
        supabase
          .from("schede")
          .select("*")
          .eq("team_id", teamId)
          .order("order_index", { ascending: true }),
      ]);

      setTeam(t ?? null);

      const periodiWithSchede: PeriodoWithSchede[] = (per ?? []).map((p) => ({
        ...p,
        schede: (sch ?? []).filter((s) => s.periodo_id === p.id),
      }));
      setPeriodi(periodiWithSchede);

      // Espandi tutti i periodi di default
      const exp: Record<string, boolean> = {};
      (per ?? []).forEach((p) => { exp[p.id] = true; });
      setExpanded(exp);
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Errore caricamento");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (session?.user && role !== "atleta") fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user, teamId]);

  // ─── Crea periodo ────────────────────────────────────────────────────────────
  const handleCreatePeriodo = async () => {
    if (!periodoName.trim()) { toast.error("Inserisci un nome"); return; }
    if (!periodoStart || !periodoEnd) { toast.error("Inserisci le date"); return; }
    if (periodoStart > periodoEnd) { toast.error("La data inizio deve essere prima della fine"); return; }
    setSavingPeriodo(true);
    try {
      const { error } = await supabase.from("periodi").insert({
        team_id: teamId,
        name: periodoName.trim(),
        description: periodoDesc.trim() || null,
        start_date: periodoStart,
        end_date: periodoEnd,
        order_index: periodi.length,
      });
      if (error) throw error;
      toast.success("Periodo creato");
      setNewPeriodoOpen(false);
      setPeriodoName(""); setPeriodoStart(""); setPeriodoEnd(""); setPeriodoDesc("");
      fetchData();
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Errore");
    } finally {
      setSavingPeriodo(false);
    }
  };

  // ─── Elimina periodo ─────────────────────────────────────────────────────────
  const handleDeletePeriodo = async (id: string) => {
    if (!confirm("Eliminare il periodo e tutte le sue schede?")) return;
    const { error } = await supabase.from("periodi").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Periodo eliminato");
    fetchData();
  };

  // ─── Crea scheda ─────────────────────────────────────────────────────────────
  const openNewScheda = (periodoId: string | null) => {
    setSchedaForPeriodo(periodoId);
    setSchedaTitle(""); setSchedaDesc(""); setSchedaIsTemplate(false);
    setNewSchedaOpen(true);
  };

  const handleCreateScheda = async () => {
    if (!schedaTitle.trim()) { toast.error("Inserisci un titolo"); return; }
    setSavingScheda(true);
    try {
      const periodoSchede = schedaForPeriodo
        ? periodi.find((p) => p.id === schedaForPeriodo)?.schede ?? []
        : [];
      const { error } = await supabase.from("schede").insert({
        team_id: teamId,
        periodo_id: schedaForPeriodo,
        title: schedaTitle.trim(),
        description: schedaDesc.trim() || null,
        is_template: schedaIsTemplate,
        order_index: periodoSchede.length,
        created_by: session?.user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Scheda creata");
      setNewSchedaOpen(false);
      fetchData();
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Errore");
    } finally {
      setSavingScheda(false);
    }
  };

  // ─── Elimina scheda ──────────────────────────────────────────────────────────
  const handleDeleteScheda = async (id: string) => {
    if (!confirm("Eliminare questa scheda?")) return;
    const { error } = await supabase.from("schede").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Scheda eliminata");
    fetchData();
  };

  // ─── Loading / empty ─────────────────────────────────────────────────────────
  if (loading || loadingData || !profile) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Schede senza periodo
  const schedeLibere = periodi.length === 0
    ? []
    : ([] as Scheda[]);

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader
        name={profile.full_name ?? "Coach"}
        role={role}
        onSignOut={signOut}
        maxWidth="max-w-4xl"
      />

      <main className="flex-1 container mx-auto max-w-4xl px-4 py-8 space-y-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <a href="/coach" className="hover:text-foreground">Squadre</a>
          <span>/</span>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <a href={`/coach/team/${teamId}`} className="hover:text-foreground">
            {team?.name ?? teamId}
          </a>
          <span>/</span>
          <span className="text-foreground">Periodi & Schede</span>
        </div>

        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Periodi & Schede</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Organizza il lavoro stagionale in mesocicli e schede settimanali.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => openNewScheda(null)}>
              <ClipboardList className="h-4 w-4" />
              Scheda libera
            </Button>
            <Button onClick={() => setNewPeriodoOpen(true)}>
              <Plus className="h-4 w-4" />
              Nuovo periodo
            </Button>
          </div>
        </div>

        {/* Stat bar */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Periodi" value={periodi.length} />
          <StatCard label="Schede totali" value={periodi.reduce((s, p) => s + p.schede.length, 0)} />
          <StatCard
            label="Periodo attivo"
            value={
              periodi.find((p) => p.start_date <= today && p.end_date >= today)?.name ?? "—"
            }
            small
          />
        </div>

        {/* Lista periodi */}
        {periodi.length === 0 ? (
          <EmptyPeriodi onNew={() => setNewPeriodoOpen(true)} />
        ) : (
          <div className="space-y-4">
            {periodi.map((p) => (
              <PeriodoCard
                key={p.id}
                periodo={p}
                expanded={!!expanded[p.id]}
                onToggle={() => setExpanded((e) => ({ ...e, [p.id]: !e[p.id] }))}
                onDelete={() => handleDeletePeriodo(p.id)}
                onNewScheda={() => openNewScheda(p.id)}
                onDeleteScheda={handleDeleteScheda}
                teamId={teamId}
                today={today}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Dialog nuovo periodo ─────────────────────────────────────────── */}
      <Dialog open={newPeriodoOpen} onOpenChange={setNewPeriodoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuovo periodo</DialogTitle>
            <DialogDescription>
              Un periodo raggruppa le schede di uno stesso mesociclo (es. 4–6 settimane).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nome *</label>
              <input
                type="text"
                value={periodoName}
                onChange={(e) => setPeriodoName(e.target.value)}
                placeholder="Es. Blocco forza — Ottobre"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Inizio *</label>
                <input
                  type="date"
                  value={periodoStart}
                  onChange={(e) => setPeriodoStart(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Fine *</label>
                <input
                  type="date"
                  value={periodoEnd}
                  onChange={(e) => setPeriodoEnd(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Note (opzionale)</label>
              <input
                type="text"
                value={periodoDesc}
                onChange={(e) => setPeriodoDesc(e.target.value)}
                placeholder="Es. Focus sulla potenza esplosiva"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewPeriodoOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleCreatePeriodo} disabled={savingPeriodo}>
              {savingPeriodo && <Loader2 className="h-4 w-4 animate-spin" />}
              Crea periodo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog nuova scheda ──────────────────────────────────────────── */}
      <Dialog open={newSchedaOpen} onOpenChange={setNewSchedaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {schedaForPeriodo
                ? `Nuova scheda — ${periodi.find((p) => p.id === schedaForPeriodo)?.name ?? ""}`
                : "Nuova scheda libera"}
            </DialogTitle>
            <DialogDescription>
              La scheda conterrà gli esercizi con serie, reps e carico target.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Titolo *</label>
              <input
                type="text"
                value={schedaTitle}
                onChange={(e) => setSchedaTitle(e.target.value)}
                placeholder="Es. Lower Body — Settimana 1"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Descrizione (opzionale)</label>
              <textarea
                value={schedaDesc}
                onChange={(e) => setSchedaDesc(e.target.value)}
                placeholder="Obiettivi, note per gli atleti..."
                rows={3}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={schedaIsTemplate}
                onChange={(e) => setSchedaIsTemplate(e.target.checked)}
                className="rounded accent-primary"
              />
              <span className="text-sm">Salva come template riutilizzabile</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewSchedaOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleCreateScheda} disabled={savingScheda}>
              {savingScheda && <Loader2 className="h-4 w-4 animate-spin" />}
              Crea scheda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Componenti ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  small,
}: {
  label: string;
  value: number | string;
  small?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 font-bold tabular-nums ${small ? "text-lg" : "text-2xl"}`}>
        {value}
      </p>
    </div>
  );
}

function EmptyPeriodi({ onNew }: { onNew: () => void }) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/20 p-12 text-center">
      <div className="mx-auto h-12 w-12 grid place-items-center rounded-full bg-secondary">
        <CalendarRange className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="mt-4 font-semibold">Nessun periodo</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
        Crea il primo mesociclo per organizzare le schede settimana per settimana.
      </p>
      <Button className="mt-5" onClick={onNew}>
        <Plus className="h-4 w-4" /> Crea primo periodo
      </Button>
    </div>
  );
}

function PeriodoCard({
  periodo,
  expanded,
  onToggle,
  onDelete,
  onNewScheda,
  onDeleteScheda,
  teamId,
  today,
}: {
  periodo: PeriodoWithSchede;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onNewScheda: () => void;
  onDeleteScheda: (id: string) => void;
  teamId: string;
  today: string;
}) {
  const isActive = periodo.start_date <= today && periodo.end_date >= today;
  const isPast   = periodo.end_date < today;
  const isFuture = periodo.start_date > today;

  const statusLabel = isActive ? "In corso" : isPast ? "Concluso" : "Futuro";
  const statusClass = isActive
    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
    : isPast
    ? "bg-muted text-muted-foreground border-border"
    : "bg-blue-500/10 text-blue-600 border-blue-500/30";

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });

  // Calcola durata in settimane
  const diffMs = new Date(periodo.end_date).getTime() - new Date(periodo.start_date).getTime();
  const weeks  = Math.round(diffMs / (1000 * 60 * 60 * 24 * 7));

  return (
    <div className={`rounded-xl border bg-card overflow-hidden ${isActive ? "border-primary/30" : ""}`}>
      {/* Header periodo */}
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={onToggle}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{periodo.name}</span>
            <span className={`text-[10px] font-semibold uppercase tracking-wider border rounded-full px-2 py-0.5 ${statusClass}`}>
              {statusLabel}
            </span>

          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {fmt(periodo.start_date)} → {fmt(periodo.end_date)}
            {" · "}{weeks} {weeks === 1 ? "settimana" : "settimane"}
            {" · "}{periodo.schede.length} {periodo.schede.length === 1 ? "scheda" : "schede"}
          </p>
          {periodo.description && (
            <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{periodo.description}</p>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Schede del periodo */}
      {expanded && (
        <div className="border-t px-5 py-4 space-y-2 bg-muted/10">
          {periodo.schede.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nessuna scheda in questo periodo.
            </p>
          ) : (
            periodo.schede.map((s) => (
              <SchedaRow
                key={s.id}
                scheda={s}
                onDelete={() => onDeleteScheda(s.id)}
                teamId={teamId}
              />
            ))
          )}

          <button
            onClick={onNewScheda}
            className="w-full mt-2 rounded-lg border border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-colors px-4 py-2.5 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary"
          >
            <Plus className="h-4 w-4" />
            Aggiungi scheda
          </button>
        </div>
      )}
    </div>
  );
}

function SchedaRow({
  scheda,
  onDelete,
  teamId,
}: {
  scheda: Scheda;
  onDelete: () => void;
  teamId: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 group">
      <ClipboardList className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{scheda.title}</p>
        {scheda.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{scheda.description}</p>
        )}
      </div>
      {scheda.is_template && (
        <Badge variant="outline" className="text-[10px] flex-shrink-0">Template</Badge>
      )}

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Link alla scheda dettaglio — route step 3 */}
        <a href={`/coach/team/${teamId}/schede/${scheda.id}`}>
          <button className="p-1.5 rounded text-muted-foreground hover:text-primary transition-colors">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </a>
        <button
          onClick={onDelete}
          className="p-1.5 rounded text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
