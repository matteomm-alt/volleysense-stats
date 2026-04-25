import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronLeft, Plus, Trash2, ChevronDown, ChevronUp, Save, Dumbbell } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

// ─── Tipi ─────────────────────────────────────────────────────────────────────

type Team = Tables<"teams">;

type ExerciseRow = {
  id: string;
  name: string;
  sets: string;
  reps: string;
  load: string;
  unit: string;
  rpe: string;
  notes: string;
  open: boolean;
};

const SESSION_TYPES = [
  "Lower Body",
  "Upper Body",
  "Full Body",
  "Core & Stabilità",
  "Potenza / Saltabilità",
  "Recupero Attivo",
];

const ESERCIZI_PRESET: { group: string; items: string[] }[] = [
  {
    group: "Lower Body",
    items: [
      "Squat", "Front Squat", "Leg Press", "Romanian Deadlift",
      "Stacco da Terra", "Hip Thrust", "Affondi", "Bulgaro",
      "Nordic Curl", "Leg Curl", "Leg Extension",
    ],
  },
  {
    group: "Upper Body",
    items: [
      "Panca Piana", "Panca Inclinata", "Military Press", "Push Press",
      "Lat Machine", "Rematore Bilanciere", "Trazioni", "Dips",
      "Curl Bilanciere", "Tricep Pushdown",
    ],
  },
  {
    group: "Potenza",
    items: ["Clean", "Power Clean", "Box Jump", "Jump Squat", "Salti Verticali", "Slam Ball"],
  },
  {
    group: "Core",
    items: ["Plank", "Ab Rollout", "Russian Twist", "Pallof Press"],
  },
];

const LOAD_UNITS = ["kg", "lb", "%1RM", "RPE", "BW", "sec", "mt"];

function newExRow(name = ""): ExerciseRow {
  return {
    id: crypto.randomUUID(),
    name,
    sets: "3",
    reps: "8",
    load: "",
    unit: "kg",
    rpe: "",
    notes: "",
    open: true,
  };
}

// ─── Route ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/atleta/registro")({
  component: RegistroPage,
});

function RegistroPage() {
  const { loading, session, profile, role, signOut } = useAuth();
  const navigate = useNavigate();

  // Form state
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split("T")[0]);
  const [sessionType, setSessionType] = useState(SESSION_TYPES[0]);
  const [duration, setDuration] = useState("60");
  const [rpe, setRpe] = useState(7);
  const [notes, setNotes] = useState("");
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(true);

  // Selezione esercizio
  const [addOpen, setAddOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const addRef = useRef<HTMLDivElement>(null);

  // ─── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/login" });
    else if (!profile?.onboarded || !role) navigate({ to: "/onboarding" });
    else if (role !== "atleta") navigate({ to: "/coach" });
  }, [loading, session, profile, role, navigate]);

  // ─── Carica squadre dell'atleta ─────────────────────────────────────────────
  useEffect(() => {
    if (!session?.user || role !== "atleta") return;
    (async () => {
      setLoadingTeams(true);
      const { data: memberships } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("athlete_id", session.user.id);
      const ids = (memberships ?? []).map((m) => m.team_id);
      if (!ids.length) { setTeams([]); setLoadingTeams(false); return; }
      const { data: ts } = await supabase.from("teams").select("*").in("id", ids);
      const list = ts ?? [];
      setTeams(list);
      if (list.length) setSelectedTeamId(list[0].id);
      setLoadingTeams(false);
    })();
  }, [session?.user, role]);

  // Chiudi dropdown esercizi cliccando fuori
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addRef.current && !addRef.current.contains(e.target as Node)) setAddOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ─── Handlers esercizi ──────────────────────────────────────────────────────
  const addExercise = (name: string) => {
    setExercises((prev) => [...prev, newExRow(name)]);
    setAddOpen(false);
    setCustomName("");
  };

  const addCustom = () => {
    const n = customName.trim();
    if (!n) return;
    addExercise(n);
  };

  const updateEx = (id: string, field: keyof ExerciseRow, value: string | boolean) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === id ? { ...ex, [field]: value } : ex))
    );
  };

  const removeEx = (id: string) => setExercises((prev) => prev.filter((e) => e.id !== id));

  const toggleEx = (id: string) =>
    setExercises((prev) => prev.map((e) => (e.id === id ? { ...e, open: !e.open } : e)));

  // ─── Salvataggio ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!session?.user) return;
    if (!selectedTeamId) { toast.error("Seleziona una squadra"); return; }
    if (!sessionDate) { toast.error("Inserisci la data"); return; }

    setSaving(true);
    try {
      // 1. Inserisci sessione
      const { data: sess, error: sessErr } = await supabase
        .from("sessions")
        .insert({
          athlete_id: session.user.id,
          team_id: selectedTeamId,
          session_date: sessionDate,
          rpe,
          notes: notes.trim() || null,
          duration_minutes: duration ? parseInt(duration) : null,
          completed: true,
        })
        .select()
        .single();

      if (sessErr || !sess) throw sessErr ?? new Error("Errore sessione");

      // 2. Inserisci set_logs per ogni esercizio
      if (exercises.length) {
        // Per ogni esercizio, cerchiamo se esiste nel catalogo altrimenti creiamo un id fittizio
        const logs = exercises.map((ex) => ({
          session_id: sess.id,
          esercizio_id: crypto.randomUUID(), // sarà referenziato correttamente quando avremo catalogo
          scheda_esercizio_id: null,
          reps: ex.reps ? parseInt(ex.reps) : null,
          load_value: ex.load ? parseFloat(ex.load) : null,
          load_unit: ex.unit || "kg",
          rpe: ex.rpe ? parseFloat(ex.rpe) : null,
          notes: [ex.name, ex.notes].filter(Boolean).join(" — ") || null,
          completed: true,
        }));

        // Inseriamo una riga per serie, con il nome esercizio nelle note
        // (il catalogo esercizi verrà collegato nello step catalogo)
        const setLogsPayload = exercises.flatMap((ex) =>
          Array.from({ length: parseInt(ex.sets) || 1 }, (_, i) => ({
            session_id: sess.id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            esercizio_id: ex.id as any,
            scheda_esercizio_id: null as string | null,
            reps: ex.reps ? parseInt(ex.reps) : null,
            load_value: ex.load ? parseFloat(ex.load) : null,
            load_unit: ex.unit || "kg",
            rpe: ex.rpe ? parseFloat(ex.rpe) : null,
            notes: i === 0
              ? [ex.name, ex.notes].filter(Boolean).join(" — ") || null
              : ex.name || null,
            completed: true,
          }))
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: logsErr } = await (supabase.from("set_logs") as any).insert(setLogsPayload);
        if (logsErr) throw logsErr;
      }

      toast.success("Seduta salvata!");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      navigate({ to: "/atleta" as any });
    } catch (err: unknown) {
      toast.error((err as Error)?.message ?? "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loading || !profile) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const rpeColor =
    rpe <= 3 ? "text-emerald-500" : rpe <= 6 ? "text-amber-500" : rpe <= 8 ? "text-orange-500" : "text-red-500";

  const rpeLabel =
    rpe <= 3 ? "Leggero" : rpe <= 5 ? "Moderato" : rpe <= 7 ? "Impegnativo" : rpe <= 9 ? "Molto duro" : "Massimale";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader
        name={profile.full_name ?? "Atleta"}
        role={role}
        onSignOut={signOut}
        maxWidth="max-w-2xl"
      />

      <main className="flex-1 container mx-auto max-w-2xl px-4 py-8 space-y-5">
        {/* Breadcrumb */}
        <Link
          to="/atleta"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          La mia area
        </Link>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Registra seduta</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Compila i dati dell'allenamento appena completato.
          </p>
        </div>

        {/* ── SQUADRA ──────────────────────────────────────────────────── */}
        <section className="rounded-xl border bg-card p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Squadra
          </h2>

          {loadingTeams ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : teams.length === 0 ? (
            <p className="text-sm text-muted-foreground">Non sei in nessuna squadra.</p>
          ) : teams.length === 1 ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-sm font-medium px-3 py-1">
                {teams[0].name}
              </Badge>
              {teams[0].category && (
                <span className="text-xs text-muted-foreground">{teams[0].category}</span>
              )}
            </div>
          ) : (
            /* Multi-team: mostra selector */
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {teams.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTeamId(t.id)}
                  className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    selectedTeamId === t.id
                      ? "border-primary bg-primary/5 text-primary font-semibold"
                      : "border-border bg-background hover:bg-muted/50 text-foreground"
                  }`}
                >
                  <div className="text-sm font-medium truncate">{t.name}</div>
                  {t.category && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{t.category}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ── DETTAGLI SEDUTA ──────────────────────────────────────────── */}
        <section className="rounded-xl border bg-card p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Dettagli seduta
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Data</label>
              <input
                type="date"
                value={sessionDate}
                max={new Date().toISOString().split("T")[0]}
                onChange={(e) => setSessionDate(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Durata (min)</label>
              <input
                type="number"
                value={duration}
                min={1}
                max={300}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="60"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Tipo di sessione</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SESSION_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setSessionType(t)}
                  className={`rounded-lg border px-3 py-2 text-sm text-left transition-colors ${
                    sessionType === t
                      ? "border-primary bg-primary/5 text-primary font-semibold"
                      : "border-border bg-background hover:bg-muted/50"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── RPE ──────────────────────────────────────────────────────── */}
        <section className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Fatica percepita (RPE)
            </h2>
            <div className="flex items-center gap-2">
              <span className={`text-3xl font-bold tabular-nums ${rpeColor}`}>{rpe}</span>
              <span className={`text-xs font-medium ${rpeColor}`}>{rpeLabel}</span>
            </div>
          </div>

          <input
            type="range"
            min={1}
            max={10}
            value={rpe}
            onChange={(e) => setRpe(parseInt(e.target.value))}
            className="w-full accent-primary h-2 rounded-full"
          />

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1 — Riposo</span>
            <span>5 — Moderato</span>
            <span>10 — Max</span>
          </div>

          {/* Barre visive RPE */}
          <div className="flex gap-1 pt-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <div
                key={n}
                className="flex-1 rounded-sm transition-all duration-150"
                style={{
                  height: `${8 + n * 3}px`,
                  background:
                    n <= rpe
                      ? n <= 3
                        ? "#10b981"
                        : n <= 6
                        ? "#f59e0b"
                        : n <= 8
                        ? "#f97316"
                        : "#ef4444"
                      : "var(--border)",
                  opacity: n <= rpe ? 1 : 0.3,
                }}
              />
            ))}
          </div>
        </section>

        {/* ── NOTE ─────────────────────────────────────────────────────── */}
        <section className="rounded-xl border bg-card p-5 space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Note (opzionale)
          </h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Come ti sei sentita? Difficoltà, sensazioni, progressi notati..."
            rows={3}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
        </section>

        {/* ── ESERCIZI ─────────────────────────────────────────────────── */}
        <section className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Esercizi eseguiti
            </h2>
            <Badge variant="outline" className="font-mono text-xs">
              {exercises.length}
            </Badge>
          </div>

          {/* Lista esercizi */}
          {exercises.length > 0 && (
            <div className="space-y-3">
              {exercises.map((ex, idx) => (
                <ExerciseCard
                  key={ex.id}
                  ex={ex}
                  idx={idx}
                  onToggle={() => toggleEx(ex.id)}
                  onRemove={() => removeEx(ex.id)}
                  onUpdate={(field, val) => updateEx(ex.id, field, val)}
                />
              ))}
            </div>
          )}

          {/* Aggiungi esercizio */}
          <div className="relative" ref={addRef}>
            <button
              onClick={() => setAddOpen((v) => !v)}
              className="w-full rounded-lg border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-colors px-4 py-3 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary"
            >
              <Plus className="h-4 w-4" />
              Aggiungi esercizio
            </button>

            {addOpen && (
              <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-xl border bg-card shadow-xl overflow-hidden">
                {/* Personalizzato */}
                <div className="p-3 border-b">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addCustom()}
                      placeholder="Nome esercizio personalizzato..."
                      className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                      autoFocus
                    />
                    <Button size="sm" onClick={addCustom} disabled={!customName.trim()}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Preset */}
                <div className="max-h-64 overflow-y-auto">
                  {ESERCIZI_PRESET.map((group) => (
                    <div key={group.group}>
                      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/50">
                        {group.group}
                      </div>
                      {group.items.map((name) => (
                        <button
                          key={name}
                          onClick={() => addExercise(name)}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-muted/70 transition-colors"
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── SALVA ────────────────────────────────────────────────────── */}
        <div className="pb-8">
          <Button
            onClick={handleSave}
            disabled={saving || !selectedTeamId || loadingTeams}
            className="w-full h-12 text-base font-semibold gap-2"
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
            {saving ? "Salvataggio..." : "Salva seduta"}
          </Button>
        </div>
      </main>
    </div>
  );
}

// ─── ExerciseCard ─────────────────────────────────────────────────────────────

function ExerciseCard({
  ex,
  idx,
  onToggle,
  onRemove,
  onUpdate,
}: {
  ex: ExerciseRow;
  idx: number;
  onToggle: () => void;
  onRemove: () => void;
  onUpdate: (field: keyof ExerciseRow, val: string) => void;
}) {
  return (
    <div className="rounded-xl border bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-primary text-xs font-bold flex-shrink-0">
          {idx + 1}
        </div>
        <div className="flex-1 min-w-0">
          <input
            value={ex.name}
            onChange={(e) => onUpdate("name", e.target.value)}
            placeholder="Nome esercizio"
            className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground"
          />
          {!ex.open && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {ex.sets}×{ex.reps}
              {ex.load ? ` · ${ex.load}${ex.unit}` : ""}
              {ex.rpe ? ` · RPE ${ex.rpe}` : ""}
            </p>
          )}
        </div>
        <button
          onClick={onToggle}
          className="text-muted-foreground hover:text-foreground p-1 rounded"
        >
          {ex.open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <button
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive p-1 rounded"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Body espandibile */}
      {ex.open && (
        <div className="px-4 pb-4 space-y-3 border-t pt-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Serie
              </label>
              <input
                type="number"
                value={ex.sets}
                min={1}
                max={20}
                onChange={(e) => onUpdate("sets", e.target.value)}
                className="w-full rounded-lg border bg-card px-2 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-primary/30 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Reps
              </label>
              <input
                type="text"
                value={ex.reps}
                placeholder="8"
                onChange={(e) => onUpdate("reps", e.target.value)}
                className="w-full rounded-lg border bg-card px-2 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-primary/30 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                RPE
              </label>
              <input
                type="number"
                value={ex.rpe}
                min={1}
                max={10}
                step={0.5}
                placeholder="–"
                onChange={(e) => onUpdate("rpe", e.target.value)}
                className="w-full rounded-lg border bg-card px-2 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-primary/30 font-mono"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Carico
              </label>
              <input
                type="text"
                value={ex.load}
                placeholder="0"
                onChange={(e) => onUpdate("load", e.target.value)}
                className="w-full rounded-lg border bg-card px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Unità
              </label>
              <select
                value={ex.unit}
                onChange={(e) => onUpdate("unit", e.target.value)}
                className="rounded-lg border bg-card px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              >
                {LOAD_UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Note
            </label>
            <input
              type="text"
              value={ex.notes}
              placeholder="Note opzionali..."
              onChange={(e) => onUpdate("notes", e.target.value)}
              className="w-full rounded-lg border bg-card px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
      )}
    </div>
  );
}
