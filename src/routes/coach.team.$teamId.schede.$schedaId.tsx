import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Dumbbell,
  Search,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Scheda = Tables<"schede"> & { athlete_id?: string | null };
type Esercizio = Tables<"esercizi_catalogo">;
type EsercizioMeta = {
  name: string;
  category?: string | null;
  muscle_group?: string | null;
};
type SchedaEsercizio = Tables<"scheda_esercizi"> & {
  esercizio?: EsercizioMeta | null;
};

const UNIT_OPTIONS = ["kg", "lb", "%1RM", "RPE", "BW", "sec"] as const;

const TIPO_SCHEDA_OPTIONS = [
  "Lower Body",
  "Upper Body",
  "Full Body",
  "Core & Stabilità",
  "Potenza",
  "Recupero Attivo",
] as const;

const CATEGORIES: { value: string; label: string; color: string }[] = [
  { value: "arti_inferiori", label: "Arti inferiori", color: "#3B82F6" },
  { value: "arti_superiori", label: "Arti superiori", color: "#8B5CF6" },
  { value: "full_body", label: "Full body", color: "#F59E0B" },
  { value: "core", label: "Core", color: "#10B981" },
  { value: "potenza", label: "Potenza", color: "#EF4444" },
  { value: "prevenzione", label: "Prevenzione", color: "#06B6D4" },
  { value: "mobilita", label: "Mobilità", color: "#EC4899" },
  { value: "recupero", label: "Recupero", color: "#6B7280" },
  { value: "riscaldamento", label: "Riscaldamento", color: "#F97316" },
];
const CAT_MAP = new Map(CATEGORIES.map((c) => [c.value, c]));

type TeamAthlete = { id: string; full_name: string | null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)(
  "/coach/team/$teamId/schede/$schedaId",
)({
  component: SchedaDetailPage,
});

function SchedaDetailPage() {
  const { teamId, schedaId } = Route.useParams();
  const { loading, session, profile, role, signOut } = useAuth();
  const navigate = useNavigate();

  const [scheda, setScheda] = useState<Scheda | null>(null);
  const [rows, setRows] = useState<SchedaEsercizio[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [athletes, setAthletes] = useState<TeamAthlete[]>([]);
  const [editingRow, setEditingRow] = useState<SchedaEsercizio | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/login" });
    else if (!profile?.onboarded || !role) navigate({ to: "/onboarding" });
    else if (role === "atleta") navigate({ to: "/atleta" });
  }, [loading, session, profile, role, navigate]);

  const fetchData = async () => {
    setLoadingData(true);
    const [{ data: s, error: sErr }, { data: se, error: seErr }] = await Promise.all([
      supabase.from("schede").select("*").eq("id", schedaId).maybeSingle(),
      supabase
        .from("scheda_esercizi")
        .select("*")
        .eq("scheda_id", schedaId)
        .order("order_index", { ascending: true }),
    ]);
    if (sErr || seErr) {
      toast.error((sErr || seErr)!.message);
      setLoadingData(false);
      return;
    }
    setScheda(s as Scheda | null);

    const ids = (se ?? []).map((r) => r.esercizio_id).filter(Boolean);
    const map = new Map<string, EsercizioMeta>();
    if (ids.length) {
      const { data: ex } = await supabase
        .from("esercizi_catalogo")
        .select("id, name, category, muscle_group")
        .in("id", ids);
      (ex ?? []).forEach((e) =>
        map.set(e.id, {
          name: e.name,
          category: e.category,
          muscle_group: e.muscle_group,
        }),
      );
    }
    setRows(
      (se ?? []).map((r) => ({ ...r, esercizio: map.get(r.esercizio_id) ?? null })),
    );
    setLoadingData(false);
  };

  const fetchAthletes = async () => {
    const { data: tm } = await supabase
      .from("team_members")
      .select("athlete_id")
      .eq("team_id", teamId);
    const ids = (tm ?? []).map((r) => r.athlete_id);
    if (!ids.length) {
      setAthletes([]);
      return;
    }
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);
    setAthletes(
      (profs ?? []).map((p) => ({ id: p.id, full_name: p.full_name })),
    );
  };

  useEffect(() => {
    if (session?.user) {
      fetchData();
      fetchAthletes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user, schedaId]);

  const removeRow = async (id: string) => {
    if (!confirm("Eliminare questo esercizio dalla scheda?")) return;
    const { error } = await supabase.from("scheda_esercizi").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Esercizio rimosso");
    fetchData();
  };

  const updateSchedaField = async (patch: {
    description?: string | null;
    athlete_id?: string | null;
  }) => {
    if (!scheda) return;
    setScheda({ ...scheda, ...patch });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase
      .from("schede")
      .update(patch as any)
      .eq("id", schedaId);
    if (error) toast.error(error.message);
  };

  if (loading || loadingData || !profile) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!scheda) {
    return (
      <div className="min-h-screen flex flex-col">
        <AppHeader name={profile.full_name ?? "Coach"} role={role} onSignOut={signOut} />
        <main className="flex-1 grid place-items-center px-6">
          <div className="text-center max-w-md">
            <h2 className="text-xl font-semibold">Scheda non trovata</h2>
            <Button asChild className="mt-4" variant="outline">
              <Link to="/coach/team/$teamId/periodi" params={{ teamId }}>
                <ChevronLeft className="h-4 w-4" /> Torna ai periodi
              </Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader name={profile.full_name ?? "Coach"} role={role} onSignOut={signOut} />
      <main className="flex-1 container mx-auto max-w-4xl px-6 py-10">
        <Link
          to="/coach/team/$teamId/periodi"
          params={{ teamId }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Torna ai periodi
        </Link>

        <div className="mt-4">
          <h1 className="text-3xl font-semibold tracking-tight">{scheda.title}</h1>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 max-w-2xl">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Tipo scheda
              </Label>
              <Select
                value={scheda.description ?? ""}
                onValueChange={(v) => updateSchedaField({ description: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleziona tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_SCHEDA_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Assegnata a
              </Label>
              <Select
                value={scheda.athlete_id ?? "__team__"}
                onValueChange={(v) =>
                  updateSchedaField({ athlete_id: v === "__team__" ? null : v })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__team__">Tutta la squadra</SelectItem>
                  {athletes.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.full_name || "Atleta"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <section className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Esercizi · <span className="font-mono">{rows.length}</span>
            </h2>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Aggiungi esercizio
            </Button>
          </div>

          {rows.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 p-12 text-center">
              <div className="mx-auto h-12 w-12 grid place-items-center rounded-full bg-secondary">
                <Dumbbell className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="mt-4 font-semibold">Nessun esercizio</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Aggiungi il primo esercizio per costruire la scheda.
              </p>
              <Button className="mt-5" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" /> Aggiungi esercizio
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border bg-card divide-y">
              {rows.map((r, idx) => {
                const cat = r.esercizio?.category
                  ? CAT_MAP.get(r.esercizio.category)
                  : null;
                return (
                  <div
                    key={r.id}
                    className="flex items-start justify-between gap-3 px-5 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground w-6">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <div className="font-medium">
                          {r.esercizio?.name ?? "Esercizio"}
                        </div>
                        {cat && (
                          <span
                            className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: cat.color }}
                          >
                            {cat.label}
                          </span>
                        )}
                      </div>
                      {r.esercizio?.muscle_group && (
                        <div className="ml-8 mt-0.5 text-xs text-muted-foreground">
                          {r.esercizio.muscle_group}
                        </div>
                      )}
                      <div className="mt-1 ml-8 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                        {r.sets != null && r.reps && (
                          <span>
                            {r.sets} × {r.reps}
                          </span>
                        )}
                        {r.load_value != null && (
                          <span>
                            {r.load_value} {r.load_unit ?? "kg"}
                          </span>
                        )}
                        {r.rpe_target != null && <span>RPE {r.rpe_target}</span>}
                        {r.notes && <span className="italic">{r.notes}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingRow(r)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRow(r.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <AddExerciseDialog
          schedaId={schedaId}
          existingCount={rows.length}
          userId={session!.user.id}
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false);
            fetchData();
          }}
        />
      </Dialog>

      <Dialog
        open={!!editingRow}
        onOpenChange={(o) => {
          if (!o) setEditingRow(null);
        }}
      >
        {editingRow && (
          <EditRowDialog
            row={editingRow}
            onClose={() => setEditingRow(null)}
            onSaved={() => {
              setEditingRow(null);
              fetchData();
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

function AddExerciseDialog({
  schedaId,
  existingCount,
  userId,
  onClose,
  onSaved,
}: {
  schedaId: string;
  existingCount: number;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [results, setResults] = useState<Esercizio[]>([]);
  const [searching, setSearching] = useState(false);
  const [chosen, setChosen] = useState<Esercizio | null>(null);

  const [sets, setSets] = useState<string>("3");
  const [reps, setReps] = useState<string>("8");
  const [load, setLoad] = useState<string>("");
  const [unit, setUnit] = useState<string>("kg");
  const [rpe, setRpe] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setSearching(true);
      let q = supabase
        .from("esercizi_catalogo")
        .select("*")
        .eq("is_public", true)
        .order("name", { ascending: true })
        .limit(20);
      if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
      if (category) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        q = q.eq("category", category as any);
      }
      const { data, error } = await q;
      if (cancelled) return;
      if (error) toast.error(error.message);
      setResults((data ?? []) as Esercizio[]);
      setSearching(false);
    };
    const t = setTimeout(run, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [search, category]);

  const createFreeAndPick = async () => {
    const name = search.trim();
    if (!name) return;
    const { data, error } = await supabase
      .from("esercizi_catalogo")
      .insert({ name, is_public: false, created_by: userId })
      .select("*")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setChosen(data as Esercizio);
  };

  const save = async () => {
    if (!chosen) return;
    setSaving(true);
    const { error } = await supabase.from("scheda_esercizi").insert({
      scheda_id: schedaId,
      esercizio_id: chosen.id,
      order_index: existingCount,
      sets: sets ? Number(sets) : null,
      reps: reps || null,
      load_value: load ? Number(load) : null,
      load_unit: unit,
      rpe_target: rpe ? Number(rpe) : null,
      notes: notes || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Esercizio aggiunto");
    setChosen(null);
    setSearch("");
    setSets("3");
    setReps("8");
    setLoad("");
    setUnit("kg");
    setRpe("");
    setNotes("");
    onSaved();
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Aggiungi esercizio</DialogTitle>
        <DialogDescription>
          {chosen
            ? `Configura serie, reps e carico per ${chosen.name}.`
            : "Cerca un esercizio dal catalogo o creane uno al volo."}
        </DialogDescription>
      </DialogHeader>

      {!chosen ? (
        <div className="space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
            <CategoryPill
              label="Tutti"
              active={category === null}
              onClick={() => setCategory(null)}
            />
            {CATEGORIES.map((c) => (
              <CategoryPill
                key={c.value}
                label={c.label}
                color={c.color}
                active={category === c.value}
                onClick={() => setCategory(c.value)}
              />
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca esercizio..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
            {searching ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin inline" />
              </div>
            ) : results.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Nessun risultato
              </div>
            ) : (
              results.map((e) => {
                const cat = e.category ? CAT_MAP.get(e.category) : null;
                return (
                  <button
                    key={e.id}
                    onClick={() => setChosen(e)}
                    className="w-full text-left px-4 py-2 hover:bg-muted/50 transition-colors text-sm"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{e.name}</span>
                      {cat && (
                        <span
                          className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: cat.color }}
                        >
                          {cat.label}
                        </span>
                      )}
                    </div>
                    {e.muscle_group && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {e.muscle_group}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {search.trim() && (
            <Button variant="outline" className="w-full" onClick={createFreeAndPick}>
              <Plus className="h-4 w-4" /> Crea "{search.trim()}"
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Esercizio: </span>
            <span className="font-medium">{chosen.name}</span>
            <Button
              variant="ghost"
              size="sm"
              className="float-right h-6 px-2 text-xs"
              onClick={() => setChosen(null)}
            >
              Cambia
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="sets">Serie</Label>
              <Input
                id="sets"
                type="number"
                min={1}
                value={sets}
                onChange={(e) => setSets(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="reps">Reps</Label>
              <Input
                id="reps"
                placeholder="8 oppure 8-10"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="load">Carico</Label>
              <Input
                id="load"
                type="number"
                step="0.5"
                value={load}
                onChange={(e) => setLoad(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="unit">Unità</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger id="unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label htmlFor="rpe">RPE target (1-10, opzionale)</Label>
              <Input
                id="rpe"
                type="number"
                min={1}
                max={10}
                step="0.5"
                value={rpe}
                onChange={(e) => setRpe(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="notes">Note</Label>
              <Textarea
                id="notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Annulla
        </Button>
        <Button onClick={save} disabled={!chosen || saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Salva
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function CategoryPill({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? "text-white border-transparent"
          : "bg-background text-foreground hover:bg-muted"
      }`}
      style={active ? { backgroundColor: color ?? "hsl(var(--primary))" } : undefined}
    >
      {label}
    </button>
  );
}

function EditRowDialog({
  row,
  onClose,
  onSaved,
}: {
  row: SchedaEsercizio;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [sets, setSets] = useState<string>(row.sets != null ? String(row.sets) : "");
  const [reps, setReps] = useState<string>(row.reps ?? "");
  const [load, setLoad] = useState<string>(
    row.load_value != null ? String(row.load_value) : "",
  );
  const [unit, setUnit] = useState<string>(row.load_unit ?? "kg");
  const [rpe, setRpe] = useState<string>(
    row.rpe_target != null ? String(row.rpe_target) : "",
  );
  const [notes, setNotes] = useState<string>(row.notes ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("scheda_esercizi")
      .update({
        sets: sets ? Number(sets) : null,
        reps: reps || null,
        load_value: load ? Number(load) : null,
        load_unit: unit,
        rpe_target: rpe ? Number(rpe) : null,
        notes: notes || null,
      })
      .eq("id", row.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Esercizio aggiornato");
    onSaved();
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Modifica esercizio</DialogTitle>
        <DialogDescription>
          {row.esercizio?.name ?? "Esercizio"}
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="e-sets">Serie</Label>
          <Input
            id="e-sets"
            type="number"
            min={1}
            value={sets}
            onChange={(e) => setSets(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="e-reps">Reps</Label>
          <Input
            id="e-reps"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="e-load">Carico</Label>
          <Input
            id="e-load"
            type="number"
            step="0.5"
            value={load}
            onChange={(e) => setLoad(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="e-unit">Unità</Label>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger id="e-unit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNIT_OPTIONS.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label htmlFor="e-rpe">RPE target</Label>
          <Input
            id="e-rpe"
            type="number"
            min={1}
            max={10}
            step="0.5"
            value={rpe}
            onChange={(e) => setRpe(e.target.value)}
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="e-notes">Note</Label>
          <Textarea
            id="e-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Annulla
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Salva
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}