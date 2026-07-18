import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  ChevronLeft,
  Plus,
  Trash2,
  Copy,
  Wand2,
  CalendarRange,
  Layers,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

type SchedaRow = {
  id: string;
  title: string;
  day_label: string | null;
  day_order: number;
  scheda_type: string | null;
  athlete_id: string | null;
};

type SettimanaRow = {
  id: string;
  week_number: number;
  is_template: boolean;
  load_increment_pct: number;
  schede: SchedaRow[];
};

type PeriodoRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  settimane: SettimanaRow[];
};

const SCHEDA_TYPES = [
  "Lower Body",
  "Upper Body",
  "Full Body",
  "Core & Stabilità",
  "Potenza",
  "Recupero Attivo",
];

const DAY_LABELS = ["A", "B", "C", "D", "E"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/coach/team/$teamId/periodi")({
  component: PeriodiPage,
});

function PeriodiPage() {
  const { teamId } = Route.useParams();
  const { loading, session, profile, role, signOut } = useAuth();
  const navigate = useNavigate();

  const [teamName, setTeamName] = useState<string>("");
  const [periodi, setPeriodi] = useState<PeriodoRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [newPeriodoOpen, setNewPeriodoOpen] = useState(false);
  const [pName, setPName] = useState("");
  const [pStart, setPStart] = useState("");
  const [pEnd, setPEnd] = useState("");
  const [pWeeks, setPWeeks] = useState(4);
  const [savingPeriodo, setSavingPeriodo] = useState(false);

  const [newSchedaForSettimana, setNewSchedaForSettimana] = useState<string | null>(null);
  const [generatingForPeriodo, setGeneratingForPeriodo] = useState<string | null>(null);
  const [duplicateForScheda, setDuplicateForScheda] = useState<{ scheda: SchedaRow; settimane: SettimanaRow[] } | null>(null);

  useEffect(() => {
    if (loading) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!session) navigate({ to: "/login" as any });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    else if (!profile?.onboarded || !role) navigate({ to: "/onboarding" as any });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    else if (role === "atleta") navigate({ to: "/atleta" as any });
  }, [loading, session, profile, role, navigate]);

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [{ data: t }, { data: per }, { data: sett }, { data: sch }] = await Promise.all([
        supabase.from("teams").select("name").eq("id", teamId).maybeSingle(),
        supabase.from("periodi").select("id, name, start_date, end_date, order_index").eq("team_id", teamId).order("order_index", { ascending: true }),
        supabase.from("settimane").select("id, periodo_id, week_number, is_template, load_increment_pct").eq("team_id", teamId),
        supabase.from("schede").select("id, title, day_label, day_order, scheda_type, athlete_id, settimana_id").eq("team_id", teamId),
      ]);

      setTeamName(t?.name ?? "");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const settByPeriodo = new Map<string, any[]>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sett ?? []).forEach((s: any) => {
        if (!settByPeriodo.has(s.periodo_id)) settByPeriodo.set(s.periodo_id, []);
        settByPeriodo.get(s.periodo_id)!.push(s);
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const schedeBySett = new Map<string, SchedaRow[]>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sch ?? []).forEach((s: any) => {
        if (!s.settimana_id) return;
        if (!schedeBySett.has(s.settimana_id)) schedeBySett.set(s.settimana_id, []);
        schedeBySett.get(s.settimana_id)!.push({
          id: s.id,
          title: s.title,
          day_label: s.day_label,
          day_order: s.day_order ?? 0,
          scheda_type: s.scheda_type,
          athlete_id: s.athlete_id,
        });
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const built: PeriodoRow[] = (per ?? []).map((p: any) => {
        const rawSett = settByPeriodo.get(p.id) ?? [];
        const settimane: SettimanaRow[] = rawSett
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .sort((a: any, b: any) => {
            if (a.is_template !== b.is_template) return a.is_template ? -1 : 1;
            return a.week_number - b.week_number;
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((s: any) => ({
            id: s.id,
            week_number: s.week_number,
            is_template: s.is_template,
            load_increment_pct: Number(s.load_increment_pct ?? 0),
            schede: (schedeBySett.get(s.id) ?? []).sort((a, b) => a.day_order - b.day_order),
          }));
        return {
          id: p.id,
          name: p.name,
          start_date: p.start_date,
          end_date: p.end_date,
          settimane,
        };
      });
      setPeriodi(built);
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Errore caricamento");
    } finally {
      setLoadingData(false);
    }
  }, [teamId]);

  useEffect(() => {
    if (session?.user && role && role !== "atleta") fetchData();
  }, [session?.user, role, fetchData]);

  // ── Crea periodo + template + N settimane ────────────────────────────────
  const handleCreatePeriodo = async () => {
    if (!pName.trim() || !pStart || !pEnd) {
      toast.error("Compila nome e date");
      return;
    }
    if (pWeeks < 1 || pWeeks > 52) {
      toast.error("Numero settimane non valido");
      return;
    }
    setSavingPeriodo(true);
    try {
      const { data: periodo, error: e1 } = await supabase
        .from("periodi")
        .insert({
          team_id: teamId,
          name: pName.trim(),
          start_date: pStart,
          end_date: pEnd,
          order_index: periodi.length,
        })
        .select("id")
        .single();
      if (e1) throw e1;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: any[] = [
        { team_id: teamId, periodo_id: periodo.id, week_number: 0, is_template: true, load_increment_pct: 0 },
      ];
      for (let i = 1; i <= pWeeks; i++) {
        rows.push({ team_id: teamId, periodo_id: periodo.id, week_number: i, is_template: false, load_increment_pct: 0 });
      }
      const { error: e2 } = await supabase.from("settimane").insert(rows);
      if (e2) throw e2;

      toast.success("Periodo creato");
      setNewPeriodoOpen(false);
      setPName(""); setPStart(""); setPEnd(""); setPWeeks(4);
      fetchData();
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Errore");
    } finally {
      setSavingPeriodo(false);
    }
  };

  const handleDeletePeriodo = async (id: string) => {
    if (!confirm("Eliminare il periodo con tutte le settimane e le schede?")) return;
    const { error } = await supabase.from("periodi").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Periodo eliminato");
    fetchData();
  };

  const handleUpdateLoadPct = async (settimanaId: string, pct: number) => {
    const { error } = await supabase.from("settimane").update({ load_increment_pct: pct }).eq("id", settimanaId);
    if (error) return toast.error(error.message);
    setPeriodi((prev) =>
      prev.map((p) => ({
        ...p,
        settimane: p.settimane.map((s) => (s.id === settimanaId ? { ...s, load_increment_pct: pct } : s)),
      })),
    );
  };

  // ── Crea scheda / giorno ────────────────────────────────────────────────
  const handleCreateScheda = async (
    settimana: SettimanaRow,
    payload: { title: string; day_label: string; scheda_type: string },
  ) => {
    const day_order = settimana.schede.length;
    const { error } = await supabase.from("schede").insert({
      team_id: teamId,
      settimana_id: settimana.id,
      title: payload.title,
      day_label: payload.day_label || null,
      day_order,
      scheda_type: payload.scheda_type || null,
      is_template: settimana.is_template,
      order_index: day_order,
      created_by: session?.user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    toast.success("Giorno aggiunto");
    setNewSchedaForSettimana(null);
    fetchData();
  };

  const handleDeleteScheda = async (id: string) => {
    if (!confirm("Eliminare questo giorno?")) return;
    const { error } = await supabase.from("schede").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Giorno eliminato");
    fetchData();
  };

  // ── Genera settimane da template ────────────────────────────────────────
  const handleGenerateWeeks = async (periodo: PeriodoRow) => {
    const template = periodo.settimane.find((s) => s.is_template);
    if (!template) return toast.error("Manca la settimana tipo");
    const targets = periodo.settimane.filter((s) => !s.is_template);
    if (targets.length === 0) return toast.error("Aggiungi settimane al periodo");
    const hasSchede = targets.some((s) => s.schede.length > 0);
    if (hasSchede && !confirm("Alcune settimane hanno già schede. Continuando verranno sostituite. Procedere?")) return;

    setGeneratingForPeriodo(periodo.id);
    try {
      // template exercises
      const { data: templateSchede, error: e1 } = await supabase
        .from("schede")
        .select("id, title, day_label, day_order, scheda_type")
        .eq("settimana_id", template.id)
        .order("day_order");
      if (e1) throw e1;
      const tsIds = (templateSchede ?? []).map((s) => s.id);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let templateEsercizi: any[] = [];
      if (tsIds.length > 0) {
        const { data: es, error: eE } = await supabase
          .from("scheda_esercizi")
          .select("scheda_id, esercizio_id, order_index, sets, reps, load_value, load_unit, rest_seconds, tempo, rpe_target, notes")
          .in("scheda_id", tsIds);
        if (eE) throw eE;
        templateEsercizi = es ?? [];
      }

      for (const target of targets) {
        // wipe existing
        if (target.schede.length > 0) {
          const oldIds = target.schede.map((s) => s.id);
          const { error: eDel } = await supabase.from("schede").delete().in("id", oldIds);
          if (eDel) throw eDel;
        }
        if (!templateSchede || templateSchede.length === 0) continue;

        // insert cloned schede
        const cloneRows = templateSchede.map((s) => ({
          team_id: teamId,
          settimana_id: target.id,
          title: s.title,
          day_label: s.day_label,
          day_order: s.day_order,
          scheda_type: s.scheda_type,
          is_template: false,
          order_index: s.day_order,
          created_by: session?.user?.id ?? null,
        }));
        const { data: inserted, error: eIns } = await supabase.from("schede").insert(cloneRows).select("id, day_order");
        if (eIns) throw eIns;

        // map old→new by day_order
        const orderToNew = new Map<number, string>();
        (inserted ?? []).forEach((r) => orderToNew.set(r.day_order, r.id));
        const oldIdToOrder = new Map<string, number>();
        templateSchede.forEach((s) => oldIdToOrder.set(s.id, s.day_order));

        const factor = 1 + Number(target.load_increment_pct ?? 0) / 100;
        const eserciziRows = templateEsercizi
          .map((e) => {
            const order = oldIdToOrder.get(e.scheda_id);
            if (order === undefined) return null;
            const newSchedaId = orderToNew.get(order);
            if (!newSchedaId) return null;
            const load_value =
              e.load_value != null && (e.load_unit === "kg" || e.load_unit === "lb")
                ? Math.round(Number(e.load_value) * factor * 100) / 100
                : e.load_value;
            return {
              scheda_id: newSchedaId,
              esercizio_id: e.esercizio_id,
              order_index: e.order_index,
              sets: e.sets,
              reps: e.reps,
              load_value,
              load_unit: e.load_unit,
              rest_seconds: e.rest_seconds,
              tempo: e.tempo,
              rpe_target: e.rpe_target,
              notes: e.notes,
            };
          })
          .filter(Boolean);
        if (eserciziRows.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: eE2 } = await supabase.from("scheda_esercizi").insert(eserciziRows as any[]);
          if (eE2) throw eE2;
        }
      }

      toast.success("Settimane generate");
      fetchData();
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Errore generazione");
    } finally {
      setGeneratingForPeriodo(null);
    }
  };

  // ── Duplica scheda ──────────────────────────────────────────────────────
  const handleDuplicateScheda = async (
    scheda: SchedaRow,
    targetSettimana: SettimanaRow,
    newDayLabel: string,
  ) => {
    try {
      // exercises of source
      const { data: es, error: eE } = await supabase
        .from("scheda_esercizi")
        .select("esercizio_id, order_index, sets, reps, load_value, load_unit, rest_seconds, tempo, rpe_target, notes")
        .eq("scheda_id", scheda.id);
      if (eE) throw eE;

      const day_order = targetSettimana.schede.length;
      const { data: inserted, error: eIns } = await supabase
        .from("schede")
        .insert({
          team_id: teamId,
          settimana_id: targetSettimana.id,
          title: scheda.title,
          day_label: newDayLabel || scheda.day_label,
          day_order,
          scheda_type: scheda.scheda_type,
          is_template: targetSettimana.is_template,
          order_index: day_order,
          created_by: session?.user?.id ?? null,
        })
        .select("id")
        .single();
      if (eIns) throw eIns;

      if (es && es.length > 0) {
        const rows = es.map((e) => ({ ...e, scheda_id: inserted.id }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: eE2 } = await supabase.from("scheda_esercizi").insert(rows as any[]);
        if (eE2) throw eE2;
      }

      toast.success("Scheda duplicata");
      setDuplicateForScheda(null);
      fetchData();
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Errore duplicazione");
    }
  };

  if (loading || loadingData || !profile) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader name={profile.full_name ?? "Coach"} role={role} onSignOut={signOut} maxWidth="max-w-5xl" />
      <main className="flex-1 container mx-auto max-w-5xl px-4 py-8 space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/coach/team/$teamId" params={{ teamId }} className="hover:text-foreground inline-flex items-center gap-1">
            <ChevronLeft className="h-3.5 w-3.5" /> {teamName || "Squadra"}
          </Link>
          <span>/</span>
          <span className="text-foreground">Periodi & Schede</span>
        </div>

        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Programmazione</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Periodi & Schede</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Costruisci una settimana tipo, poi generala su N settimane con progressione carico.
            </p>
          </div>
          <Button onClick={() => setNewPeriodoOpen(true)}>
            <Plus className="h-4 w-4" /> Nuovo periodo
          </Button>
        </div>

        {/* Form nuovo periodo (inline) */}
        {newPeriodoOpen && (
          <div className="rounded-lg border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">Nuovo periodo</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Nome *</Label>
                <Input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Preparazione agosto" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>Data inizio *</Label>
                <Input type="date" value={pStart} onChange={(e) => setPStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Data fine *</Label>
                <Input type="date" value={pEnd} onChange={(e) => setPEnd(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Settimane</Label>
                <Input
                  type="number"
                  min={1}
                  max={52}
                  value={pWeeks}
                  onChange={(e) => setPWeeks(Number(e.target.value) || 1)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setNewPeriodoOpen(false)}>Annulla</Button>
              <Button onClick={handleCreatePeriodo} disabled={savingPeriodo}>
                {savingPeriodo && <Loader2 className="h-4 w-4 animate-spin" />}
                Crea periodo
              </Button>
            </div>
          </div>
        )}

        {/* Empty */}
        {periodi.length === 0 && !newPeriodoOpen && (
          <div className="rounded-lg border border-dashed bg-muted/30 p-12 text-center">
            <div className="mx-auto h-12 w-12 grid place-items-center rounded-full bg-secondary">
              <Layers className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="mt-4 font-semibold">Nessun periodo</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
              Crea il primo mesociclo: definisci la settimana tipo e generala su N settimane.
            </p>
            <Button className="mt-5" onClick={() => setNewPeriodoOpen(true)}>
              <Plus className="h-4 w-4" /> Nuovo periodo
            </Button>
          </div>
        )}

        {/* Periodi */}
        <div className="space-y-6">
          {periodi.map((p) => (
            <PeriodoCard
              key={p.id}
              periodo={p}
              teamId={teamId}
              generating={generatingForPeriodo === p.id}
              onDelete={() => handleDeletePeriodo(p.id)}
              onGenerate={() => handleGenerateWeeks(p)}
              onOpenAddScheda={(sid) => setNewSchedaForSettimana(sid)}
              openAddSchedaFor={newSchedaForSettimana}
              onCancelAddScheda={() => setNewSchedaForSettimana(null)}
              onCreateScheda={handleCreateScheda}
              onDeleteScheda={handleDeleteScheda}
              onDuplicateScheda={(scheda) => setDuplicateForScheda({ scheda, settimane: p.settimane })}
              onUpdateLoad={handleUpdateLoadPct}
            />
          ))}
        </div>

        {/* Duplicate scheda inline form */}
        {duplicateForScheda && (
          <DuplicateSchedaForm
            source={duplicateForScheda.scheda}
            settimane={duplicateForScheda.settimane}
            onCancel={() => setDuplicateForScheda(null)}
            onConfirm={(target, label) => handleDuplicateScheda(duplicateForScheda.scheda, target, label)}
          />
        )}
      </main>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PeriodoCard({
  periodo,
  teamId,
  generating,
  onDelete,
  onGenerate,
  onOpenAddScheda,
  openAddSchedaFor,
  onCancelAddScheda,
  onCreateScheda,
  onDeleteScheda,
  onDuplicateScheda,
  onUpdateLoad,
}: {
  periodo: PeriodoRow;
  teamId: string;
  generating: boolean;
  onDelete: () => void;
  onGenerate: () => void;
  onOpenAddScheda: (settimanaId: string) => void;
  openAddSchedaFor: string | null;
  onCancelAddScheda: () => void;
  onCreateScheda: (s: SettimanaRow, p: { title: string; day_label: string; scheda_type: string }) => void;
  onDeleteScheda: (id: string) => void;
  onDuplicateScheda: (s: SchedaRow) => void;
  onUpdateLoad: (settimanaId: string, pct: number) => void;
}) {
  const nWeeks = periodo.settimane.filter((s) => !s.is_template).length;
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-5 py-3">
        <div className="min-w-0">
          <h2 className="font-semibold truncate">{periodo.name}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {periodo.start_date} → {periodo.end_date} · <span className="font-mono">{nWeeks} sett</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={onGenerate} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Genera settimane
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="divide-y">
        {periodo.settimane.map((s) => (
          <SettimanaRowView
            key={s.id}
            settimana={s}
            teamId={teamId}
            addingScheda={openAddSchedaFor === s.id}
            onOpenAdd={() => onOpenAddScheda(s.id)}
            onCancelAdd={onCancelAddScheda}
            onCreate={(p) => onCreateScheda(s, p)}
            onDeleteScheda={onDeleteScheda}
            onDuplicateScheda={onDuplicateScheda}
            onUpdateLoad={(pct) => onUpdateLoad(s.id, pct)}
          />
        ))}
      </div>
    </div>
  );
}

function SettimanaRowView({
  settimana,
  teamId,
  addingScheda,
  onOpenAdd,
  onCancelAdd,
  onCreate,
  onDeleteScheda,
  onDuplicateScheda,
  onUpdateLoad,
}: {
  settimana: SettimanaRow;
  teamId: string;
  addingScheda: boolean;
  onOpenAdd: () => void;
  onCancelAdd: () => void;
  onCreate: (p: { title: string; day_label: string; scheda_type: string }) => void;
  onDeleteScheda: (id: string) => void;
  onDuplicateScheda: (s: SchedaRow) => void;
  onUpdateLoad: (pct: number) => void;
}) {
  const [localPct, setLocalPct] = useState(settimana.load_increment_pct);
  useEffect(() => setLocalPct(settimana.load_increment_pct), [settimana.load_increment_pct]);

  return (
    <div className="p-4 sm:px-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {settimana.is_template ? (
            <Badge variant="secondary" className="font-mono text-[10px]">SETTIMANA TIPO</Badge>
          ) : (
            <Badge variant="outline" className="font-mono text-[10px]">SETT. {settimana.week_number}</Badge>
          )}
          <span className="text-xs text-muted-foreground">{settimana.schede.length} giorni</span>
        </div>
        {!settimana.is_template && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>+% carico</span>
            <Input
              type="number"
              step={1}
              value={localPct}
              onChange={(e) => setLocalPct(Number(e.target.value) || 0)}
              onBlur={() => localPct !== settimana.load_increment_pct && onUpdateLoad(localPct)}
              className="h-7 w-20 text-xs font-mono"
            />
          </div>
        )}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {settimana.schede.map((sc) => (
          <SchedaChip
            key={sc.id}
            scheda={sc}
            teamId={teamId}
            onDelete={() => onDeleteScheda(sc.id)}
            onDuplicate={() => onDuplicateScheda(sc)}
          />
        ))}
      </div>

      {addingScheda ? (
        <AddSchedaInline onCancel={onCancelAdd} onCreate={onCreate} nextDayLabel={DAY_LABELS[settimana.schede.length] ?? ""} />
      ) : (
        <button
          onClick={onOpenAdd}
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Aggiungi giorno
        </button>
      )}
    </div>
  );
}

function SchedaChip({
  scheda,
  teamId,
  onDelete,
  onDuplicate,
}: {
  scheda: SchedaRow;
  teamId: string;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  return (
    <div className="group flex items-center gap-2 rounded-md border bg-background px-3 py-2 hover:border-foreground/20 transition-colors">
      <Link
        to="/coach/team/$teamId/schede/$schedaId"
        params={{ teamId, schedaId: scheda.id }}
        className="flex-1 min-w-0 flex items-center gap-2"
      >
        {scheda.day_label && (
          <span className="font-mono text-[11px] font-semibold bg-secondary rounded px-1.5 py-0.5 shrink-0">
            {scheda.day_label}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{scheda.title}</div>
          {scheda.scheda_type && (
            <div className="text-[11px] text-muted-foreground truncate">{scheda.scheda_type}</div>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </Link>
      <button onClick={onDuplicate} className="p-1 text-muted-foreground hover:text-foreground" title="Duplica">
        <Copy className="h-3.5 w-3.5" />
      </button>
      <button onClick={onDelete} className="p-1 text-muted-foreground hover:text-destructive" title="Elimina">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function AddSchedaInline({
  onCancel,
  onCreate,
  nextDayLabel,
}: {
  onCancel: () => void;
  onCreate: (p: { title: string; day_label: string; scheda_type: string }) => void;
  nextDayLabel: string;
}) {
  const [title, setTitle] = useState("");
  const [dayLabel, setDayLabel] = useState(nextDayLabel);
  const [type, setType] = useState<string>("");

  return (
    <div className="mt-3 rounded-md border bg-muted/40 p-3 space-y-2">
      <div className="grid gap-2 sm:grid-cols-[80px_1fr_180px]">
        <Input value={dayLabel} onChange={(e) => setDayLabel(e.target.value)} placeholder="A" className="font-mono" />
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome giorno / scheda" autoFocus />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            {SCHEDA_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>Annulla</Button>
        <Button
          size="sm"
          onClick={() => {
            if (!title.trim()) return toast.error("Inserisci un nome");
            onCreate({ title: title.trim(), day_label: dayLabel.trim(), scheda_type: type });
          }}
        >
          Aggiungi
        </Button>
      </div>
    </div>
  );
}

function DuplicateSchedaForm({
  source,
  settimane,
  onCancel,
  onConfirm,
}: {
  source: SchedaRow;
  settimane: SettimanaRow[];
  onCancel: () => void;
  onConfirm: (target: SettimanaRow, dayLabel: string) => void;
}) {
  const [targetId, setTargetId] = useState<string>(settimane[0]?.id ?? "");
  const [label, setLabel] = useState(source.day_label ?? "");
  const target = settimane.find((s) => s.id === targetId);

  return (
    <div className="fixed inset-x-4 bottom-4 sm:inset-x-auto sm:right-8 sm:bottom-8 sm:w-96 z-50 rounded-lg border bg-card shadow-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Copy className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold text-sm">Duplica "{source.title}"</h3>
      </div>
      <div className="space-y-2">
        <div className="space-y-1">
          <Label className="text-xs">Settimana di destinazione</Label>
          <Select value={targetId} onValueChange={setTargetId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {settimane.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.is_template ? "Settimana tipo" : `Settimana ${s.week_number}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nuovo giorno</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="A" className="font-mono" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>Annulla</Button>
        <Button size="sm" onClick={() => target && onConfirm(target, label)} disabled={!target}>Duplica</Button>
      </div>
    </div>
  );
}
