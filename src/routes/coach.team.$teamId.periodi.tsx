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
  Copy,
  Wand2,
  CalendarRange,
  Layers,
  ChevronRight,
  RefreshCw,
  Users,
  User,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

type SchedaRow = {
  id: string;
  title: string;
  day_label: string | null;
  day_order: number;
  scheda_type: string | null;
  athlete_id: string | null;
  placeholder_id: string | null;
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

type RosterMember = {
  key: string; // "athlete:<uuid>" or "placeholder:<uuid>"
  kind: "athlete" | "placeholder";
  id: string;
  full_name: string;
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
const TEAM_VALUE = "__team__";

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
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [newPeriodoOpen, setNewPeriodoOpen] = useState(false);
  const [pName, setPName] = useState("");
  const [pStart, setPStart] = useState("");
  const [pEnd, setPEnd] = useState("");
  const [pWeeks, setPWeeks] = useState(4);
  const [savingPeriodo, setSavingPeriodo] = useState(false);

  const [newSchedaForSettimana, setNewSchedaForSettimana] = useState<string | null>(null);
  const [generatingForPeriodo, setGeneratingForPeriodo] = useState<string | null>(null);
  const [regenForPeriodo, setRegenForPeriodo] = useState<PeriodoRow | null>(null);
  const [regenConfirmText, setRegenConfirmText] = useState("");
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
      const [{ data: t }, { data: per }, { data: sett }, { data: sch }, { data: members }] = await Promise.all([
        supabase.from("teams").select("name").eq("id", teamId).maybeSingle(),
        supabase.from("periodi").select("id, name, start_date, end_date, order_index").eq("team_id", teamId).order("order_index", { ascending: true }),
        supabase.from("settimane").select("id, periodo_id, week_number, is_template, load_increment_pct").eq("team_id", teamId),
        supabase.from("schede").select("id, title, day_label, day_order, scheda_type, athlete_id, placeholder_id, settimana_id").eq("team_id", teamId),
        supabase.from("team_members").select("athlete_id").eq("team_id", teamId),
      ]);

      setTeamName(t?.name ?? "");

      // Roster unificato: team_members (con profile) + atleti_placeholder non collegati
      const athleteIds = (members ?? []).map((m) => m.athlete_id);
      const rosterList: RosterMember[] = [];
      if (athleteIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", athleteIds);
        (profs ?? []).forEach((p) =>
          rosterList.push({
            key: `athlete:${p.id}`,
            kind: "athlete",
            id: p.id,
            full_name: p.full_name ?? "Atleta",
          }),
        );
      }
      const { data: phs } = await supabase
        .from("atleti_placeholder")
        .select("id, full_name")
        .eq("team_id", teamId)
        .is("linked_athlete_id", null);
      (phs ?? []).forEach((p) =>
        rosterList.push({
          key: `placeholder:${p.id}`,
          kind: "placeholder",
          id: p.id,
          full_name: p.full_name ?? "Atleta",
        }),
      );
      rosterList.sort((a, b) => a.full_name.localeCompare(b.full_name, "it"));
      setRoster(rosterList);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const settByPeriodo = new Map<string, any[]>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sett ?? []).forEach((s: any) => {
        if (!settByPeriodo.has(s.periodo_id)) settByPeriodo.set(s.periodo_id, []);
        settByPeriodo.get(s.periodo_id)!.push(s);
      });

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
          placeholder_id: s.placeholder_id ?? null,
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
    payload: {
      title: string;
      day_label: string;
      scheda_type: string;
      athlete_id: string | null;
      placeholder_id: string | null;
    },
  ) => {
    // day_order: reuse existing day_order for same day_label if present, else next
    const existingSameLabel = settimana.schede.find(
      (s) => (s.day_label ?? "") === (payload.day_label ?? "") && payload.day_label,
    );
    const day_order = existingSameLabel
      ? existingSameLabel.day_order
      : settimana.schede.length > 0
        ? Math.max(...settimana.schede.map((s) => s.day_order)) + 1
        : 0;
    const { error } = await supabase.from("schede").insert({
      team_id: teamId,
      settimana_id: settimana.id,
      title: payload.title,
      day_label: payload.day_label || null,
      day_order,
      scheda_type: payload.scheda_type || null,
      is_template: settimana.is_template,
      order_index: day_order,
      athlete_id: settimana.is_template ? null : payload.athlete_id,
      placeholder_id: settimana.is_template ? null : payload.placeholder_id,
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

  // ── Core: incrementally clone template into weeks per athlete ────────────
  const runIncrementalGenerate = async (periodo: PeriodoRow) => {
    if (roster.length === 0) {
      toast.error("Aggiungi atleti alla squadra prima di generare le settimane");
      return;
    }
    const template = periodo.settimane.find((s) => s.is_template);
    if (!template) {
      toast.error("Manca la settimana tipo");
      return;
    }
    const targets = periodo.settimane.filter((s) => !s.is_template);
    if (targets.length === 0) {
      toast.error("Aggiungi settimane al periodo");
      return;
    }

    // Fetch template schede + esercizi
    const { data: templateSchede, error: e1 } = await supabase
      .from("schede")
      .select("id, title, day_label, day_order, scheda_type")
      .eq("settimana_id", template.id)
      .order("day_order");
    if (e1) throw e1;
    if (!templateSchede || templateSchede.length === 0) {
      toast.error("La settimana tipo è vuota");
      return;
    }
    const tsIds = templateSchede.map((s) => s.id);
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

    let createdSchede = 0;

    for (const target of targets) {
      // Refetch target schede (source of truth) to detect what already exists
      const { data: existing, error: eEx } = await supabase
        .from("schede")
        .select("id, day_order, athlete_id, placeholder_id")
        .eq("settimana_id", target.id);
      if (eEx) throw eEx;
      const existingKeys = new Set(
        (existing ?? []).map((s) => {
          const who = s.athlete_id
            ? `athlete:${s.athlete_id}`
            : s.placeholder_id
              ? `placeholder:${s.placeholder_id}`
              : "";
          return `${s.day_order}|${who}`;
        }),
      );

      // Build list of (templateSch, roster entry) still to create
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toInsert: { tpl: any; entry: RosterMember }[] = [];
      for (const tpl of templateSchede) {
        for (const a of roster) {
          const key = `${tpl.day_order}|${a.key}`;
          if (existingKeys.has(key)) continue;
          toInsert.push({ tpl, entry: a });
        }
      }
      if (toInsert.length === 0) continue;

      const rows = toInsert.map(({ tpl, entry }) => ({
        team_id: teamId,
        settimana_id: target.id,
        title: tpl.title,
        day_label: tpl.day_label,
        day_order: tpl.day_order,
        scheda_type: tpl.scheda_type,
        is_template: false,
        order_index: tpl.day_order,
        athlete_id: entry.kind === "athlete" ? entry.id : null,
        placeholder_id: entry.kind === "placeholder" ? entry.id : null,
        created_by: session?.user?.id ?? null,
      }));

      const { data: inserted, error: eIns } = await supabase
        .from("schede")
        .insert(rows)
        .select("id, day_order, athlete_id, placeholder_id");
      if (eIns) throw eIns;
      createdSchede += inserted?.length ?? 0;

      // Map back inserted row → template scheda_id (via day_order + roster key)
      const insertedByKey = new Map<string, string>();
      (inserted ?? []).forEach((r) => {
        const who = r.athlete_id
          ? `athlete:${r.athlete_id}`
          : r.placeholder_id
            ? `placeholder:${r.placeholder_id}`
            : "";
        insertedByKey.set(`${r.day_order}|${who}`, r.id);
      });
      const tplByOrder = new Map<number, string>();
      templateSchede.forEach((t) => tplByOrder.set(t.day_order, t.id));

      const factor = 1 + Number(target.load_increment_pct ?? 0) / 100;
      const eserciziRows = toInsert
        .flatMap(({ tpl, entry }) => {
          const newSchedaId = insertedByKey.get(`${tpl.day_order}|${entry.key}`);
          if (!newSchedaId) return [];
          const tplId = tplByOrder.get(tpl.day_order);
          if (!tplId) return [];
          return templateEsercizi
            .filter((e) => e.scheda_id === tplId)
            .map((e) => {
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
            });
        });

      if (eserciziRows.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: eE2 } = await supabase.from("scheda_esercizi").insert(eserciziRows as any[]);
        if (eE2) throw eE2;
      }
    }

    return createdSchede;
  };

  // ── Genera/aggiorna settimane (incrementale, non distruttivo) ─────────────
  const handleGenerateWeeks = async (periodo: PeriodoRow) => {
    setGeneratingForPeriodo(periodo.id);
    try {
      const created = await runIncrementalGenerate(periodo);
      if (created === undefined) return; // aborted with own toast
      if (created === 0) {
        toast.success("Tutte le schede risultano già generate");
      } else {
        toast.success(`${created} schede create/aggiornate`);
      }
      fetchData();
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Errore generazione");
    } finally {
      setGeneratingForPeriodo(null);
    }
  };

  // ── Rigenera da zero: wipe + regenerate ──────────────────────────────────
  const handleRegenerateFromScratch = async () => {
    if (!regenForPeriodo) return;
    if (regenConfirmText.trim().toUpperCase() !== "TEAM") return;
    const periodo = regenForPeriodo;
    setGeneratingForPeriodo(periodo.id);
    try {
      const targetIds = periodo.settimane.filter((s) => !s.is_template).map((s) => s.id);
      if (targetIds.length > 0) {
        const { error: eDel } = await supabase
          .from("schede")
          .delete()
          .in("settimana_id", targetIds)
          .eq("is_template", false);
        if (eDel) throw eDel;
      }
      // Rebuild an in-memory periodo with cleared target schede
      const cleaned: PeriodoRow = {
        ...periodo,
        settimane: periodo.settimane.map((s) =>
          s.is_template ? s : { ...s, schede: [] },
        ),
      };
      const created = await runIncrementalGenerate(cleaned);
      if (created !== undefined) {
        toast.success(`Rigenerazione completata (${created} schede)`);
      }
      setRegenForPeriodo(null);
      setRegenConfirmText("");
      fetchData();
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Errore rigenerazione");
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
      const { data: es, error: eE } = await supabase
        .from("scheda_esercizi")
        .select("esercizio_id, order_index, sets, reps, load_value, load_unit, rest_seconds, tempo, rpe_target, notes")
        .eq("scheda_id", scheda.id);
      if (eE) throw eE;

      const day_order =
        targetSettimana.schede.length > 0
          ? Math.max(...targetSettimana.schede.map((s) => s.day_order)) + 1
          : 0;
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
          athlete_id: targetSettimana.is_template ? null : scheda.athlete_id,
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
              Costruisci una settimana tipo, poi generala per ogni atleta della squadra.
            </p>
          </div>
          <Button onClick={() => setNewPeriodoOpen(true)}>
            <Plus className="h-4 w-4" /> Nuovo periodo
          </Button>
        </div>

        {roster.length === 0 && (
          <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 px-4 py-3 text-sm text-orange-600">
            La squadra non ha ancora atleti. Aggiungi atleti al roster prima di generare le settimane.
          </div>
        )}

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

        <div className="space-y-6">
          {periodi.map((p) => (
            <PeriodoCard
              key={p.id}
              periodo={p}
              teamId={teamId}
              roster={roster}
              generating={generatingForPeriodo === p.id}
              onDelete={() => handleDeletePeriodo(p.id)}
              onGenerate={() => handleGenerateWeeks(p)}
              onRegenerate={() => { setRegenForPeriodo(p); setRegenConfirmText(""); }}
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

        {duplicateForScheda && (
          <DuplicateSchedaForm
            source={duplicateForScheda.scheda}
            settimane={duplicateForScheda.settimane}
            onCancel={() => setDuplicateForScheda(null)}
            onConfirm={(target, label) => handleDuplicateScheda(duplicateForScheda.scheda, target, label)}
          />
        )}

        <Dialog
          open={!!regenForPeriodo}
          onOpenChange={(o) => { if (!o) { setRegenForPeriodo(null); setRegenConfirmText(""); } }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-destructive">Rigenera da zero</DialogTitle>
              <DialogDescription>
                Questa azione elimina <strong>tutte le schede non-template</strong> del periodo
                “{regenForPeriodo?.name}” (tutte le settimane e tutti gli atleti) e le ricrea dalla
                settimana tipo. Le personalizzazioni fatte sulle settimane andranno perse.
                <br /><br />
                Per confermare, scrivi <span className="font-mono font-semibold">TEAM</span> qui sotto.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={regenConfirmText}
              onChange={(e) => setRegenConfirmText(e.target.value)}
              placeholder="TEAM"
              className="font-mono"
              autoFocus
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setRegenForPeriodo(null); setRegenConfirmText(""); }}>
                Annulla
              </Button>
              <Button
                variant="destructive"
                disabled={regenConfirmText.trim().toUpperCase() !== "TEAM" || generatingForPeriodo === regenForPeriodo?.id}
                onClick={handleRegenerateFromScratch}
              >
                {generatingForPeriodo === regenForPeriodo?.id && <Loader2 className="h-4 w-4 animate-spin" />}
                <RefreshCw className="h-4 w-4" /> Rigenera da zero
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PeriodoCard({
  periodo,
  teamId,
  roster,
  generating,
  onDelete,
  onGenerate,
  onRegenerate,
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
  roster: RosterMember[];
  generating: boolean;
  onDelete: () => void;
  onGenerate: () => void;
  onRegenerate: () => void;
  onOpenAddScheda: (settimanaId: string) => void;
  openAddSchedaFor: string | null;
  onCancelAddScheda: () => void;
  onCreateScheda: (
    s: SettimanaRow,
    p: { title: string; day_label: string; scheda_type: string; athlete_id: string | null; placeholder_id: string | null },
  ) => void;
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
            {periodo.start_date} → {periodo.end_date} · <span className="font-mono">{nWeeks} sett</span> · <span className="font-mono">{roster.length} atleti</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={onGenerate} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Genera/aggiorna settimane
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onRegenerate}
            disabled={generating}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            title="Rigenera da zero (distruttivo)"
          >
            <RefreshCw className="h-4 w-4" />
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
            roster={roster}
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
  roster,
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
  roster: RosterMember[];
  addingScheda: boolean;
  onOpenAdd: () => void;
  onCancelAdd: () => void;
  onCreate: (p: { title: string; day_label: string; scheda_type: string; athlete_id: string | null; placeholder_id: string | null }) => void;
  onDeleteScheda: (id: string) => void;
  onDuplicateScheda: (s: SchedaRow) => void;
  onUpdateLoad: (pct: number) => void;
}) {
  const [localPct, setLocalPct] = useState(settimana.load_increment_pct);
  useEffect(() => setLocalPct(settimana.load_increment_pct), [settimana.load_increment_pct]);

  // Group schede by day_order for non-template weeks
  const groups = (() => {
    if (settimana.is_template) return null;
    const map = new Map<number, { day_label: string | null; scheda_type: string | null; title: string; schede: SchedaRow[] }>();
    for (const sc of settimana.schede) {
      if (!map.has(sc.day_order)) {
        map.set(sc.day_order, {
          day_label: sc.day_label,
          scheda_type: sc.scheda_type,
          title: sc.title,
          schede: [],
        });
      }
      map.get(sc.day_order)!.schede.push(sc);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  })();

  const rosterName = (sc: SchedaRow): { name: string; isPlaceholder: boolean } => {
    if (sc.placeholder_id) {
      const p = roster.find((r) => r.kind === "placeholder" && r.id === sc.placeholder_id);
      return { name: p?.full_name ?? "Atleta", isPlaceholder: true };
    }
    if (sc.athlete_id) {
      const a = roster.find((r) => r.kind === "athlete" && r.id === sc.athlete_id);
      return { name: a?.full_name ?? "Atleta", isPlaceholder: false };
    }
    return { name: "Tutta la squadra", isPlaceholder: false };
  };

  const nextDayOrder =
    settimana.schede.length > 0
      ? Math.max(...settimana.schede.map((s) => s.day_order)) + 1
      : 0;
  const nextDayLabel = DAY_LABELS[nextDayOrder] ?? "";

  return (
    <div className="p-4 sm:px-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {settimana.is_template ? (
            <Badge variant="secondary" className="font-mono text-[10px]">SETTIMANA TIPO</Badge>
          ) : (
            <Badge variant="outline" className="font-mono text-[10px]">SETT. {settimana.week_number}</Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {settimana.is_template
              ? `${settimana.schede.length} giorni`
              : `${groups?.length ?? 0} giorni · ${settimana.schede.length} schede`}
          </span>
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

      {settimana.is_template ? (
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
      ) : (
        <div className="mt-3 space-y-3">
          {groups && groups.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Nessuna scheda in questa settimana.</p>
          )}
          {groups?.map(([dayOrder, g]) => (
            <div key={dayOrder} className="rounded-md border bg-background/50 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b">
                {g.day_label && (
                  <span className="font-mono text-[11px] font-semibold bg-secondary rounded px-1.5 py-0.5">
                    {g.day_label}
                  </span>
                )}
                <div className="text-sm font-medium">{g.title}</div>
                {g.scheda_type && (
                  <span className="text-[11px] text-muted-foreground">· {g.scheda_type}</span>
                )}
                <span className="ml-auto text-[11px] font-mono text-muted-foreground">
                  {g.schede.length} / {roster.length || "?"}
                </span>
              </div>
              <div className="divide-y">
                {g.schede.map((sc) => (
                  <div key={sc.id} className="flex items-center gap-2 px-3 py-1.5 group hover:bg-muted/30">
                    <div className="shrink-0 text-muted-foreground">
                      {sc.placeholder_id ? (
                        <Clock className="h-3.5 w-3.5" />
                      ) : sc.athlete_id ? (
                        <User className="h-3.5 w-3.5" />
                      ) : (
                        <Users className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <Link
                      to="/coach/team/$teamId/schede/$schedaId"
                      params={{ teamId, schedaId: sc.id }}
                      className="flex-1 min-w-0 text-sm truncate hover:text-foreground flex items-center gap-2"
                    >
                      {(() => {
                        const info = rosterName(sc);
                        return (
                          <>
                            <span className="truncate">{info.name}</span>
                            {info.isPlaceholder && (
                              <Badge className="bg-orange-500/15 text-orange-600 hover:bg-orange-500/15 border-transparent text-[10px] py-0 px-1.5">
                                In attesa
                              </Badge>
                            )}
                          </>
                        );
                      })()}
                    </Link>
                    <button
                      onClick={() => onDuplicateScheda(sc)}
                      className="p-1 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Duplica"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteScheda(sc.id)}
                      className="p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Elimina"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {addingScheda ? (
        <AddSchedaInline
          isTemplate={settimana.is_template}
          roster={roster}
          onCancel={onCancelAdd}
          onCreate={onCreate}
          nextDayLabel={nextDayLabel}
        />
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
  isTemplate,
  roster,
  onCancel,
  onCreate,
  nextDayLabel,
}: {
  isTemplate: boolean;
  roster: RosterMember[];
  onCancel: () => void;
  onCreate: (p: { title: string; day_label: string; scheda_type: string; athlete_id: string | null }) => void;
  nextDayLabel: string;
}) {
  const [title, setTitle] = useState("");
  const [dayLabel, setDayLabel] = useState(nextDayLabel);
  const [type, setType] = useState<string>("");
  const [athleteValue, setAthleteValue] = useState<string>(TEAM_VALUE);

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
      {!isTemplate && (
        <div className="grid gap-1.5">
          <Label className="text-xs">Assegnata a</Label>
          <Select value={athleteValue} onValueChange={setAthleteValue}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TEAM_VALUE}>Tutta la squadra</SelectItem>
              {roster.map((r) => (
                <SelectItem key={r.key} value={r.key}>
                  {r.full_name}{r.kind === "placeholder" ? " · In attesa" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>Annulla</Button>
        <Button
          size="sm"
          onClick={() => {
            if (!title.trim()) return toast.error("Inserisci un nome");
            let athlete_id: string | null = null;
            let placeholder_id: string | null = null;
            if (!isTemplate && athleteValue !== TEAM_VALUE) {
              const entry = roster.find((r) => r.key === athleteValue);
              if (entry?.kind === "athlete") athlete_id = entry.id;
              else if (entry?.kind === "placeholder") placeholder_id = entry.id;
            }
            onCreate({
              title: title.trim(),
              day_label: dayLabel.trim(),
              scheda_type: type,
              athlete_id,
              placeholder_id,
            });
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