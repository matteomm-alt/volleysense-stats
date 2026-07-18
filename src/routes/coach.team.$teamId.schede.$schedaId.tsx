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
  Loader2,
  ChevronLeft,
  Plus,
  Trash2,
  Dumbbell,
  Search,
  Pencil,
  X,
  ListChecks,
  BookOpen,
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
  const [athletes, setAthletes] = useState<TeamAthlete[]>([]);

  // Nuovo stato UI
  const [activeTab, setActiveTab] = useState<"scheda" | "catalogo">("scheda");
  const [expandedCatalogId, setExpandedCatalogId] = useState<string | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogResults, setCatalogResults] = useState<Esercizio[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  // Form aggiungi
  const [addSets, setAddSets] = useState("3");
  const [addReps, setAddReps] = useState("8");
  const [addLoad, setAddLoad] = useState("");
  const [addUnit, setAddUnit] = useState("kg");
  const [addRpe, setAddRpe] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  // Form modifica
  const [editSets, setEditSets] = useState("");
  const [editReps, setEditReps] = useState("");
  const [editLoad, setEditLoad] = useState("");
  const [editUnit, setEditUnit] = useState("kg");
  const [editRpe, setEditRpe] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);

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

  // Ricerca catalogo (debounced)
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoadingCatalog(true);
      let q = supabase
        .from("esercizi_catalogo")
        .select("id,name,category,muscle_group")
        .eq("is_public", true);
      if (categoryFilter) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        q = q.eq("category", categoryFilter as any);
      }
      if (catalogSearch.trim()) q = q.ilike("name", `%${catalogSearch.trim()}%`);
      const { data, error } = await q.order("name").limit(40);
      if (cancelled) return;
      if (error) toast.error(error.message);
      setCatalogResults((data ?? []) as Esercizio[]);
      setLoadingCatalog(false);
    };
    const t = setTimeout(run, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [catalogSearch, categoryFilter]);

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

  const updateSchedaField = async (
    field: "description" | "athlete_id",
    value: string | null,
  ) => {
    if (!scheda) return;
    const patch = { [field]: value } as {
      description?: string | null;
      athlete_id?: string | null;
    };
    setScheda({ ...scheda, ...patch });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase
      .from("schede")
      .update(patch as any)
      .eq("id", schedaId);
    if (error) toast.error(error.message);
  };

  const resetAddForm = () => {
    setAddSets("3");
    setAddReps("8");
    setAddLoad("");
    setAddUnit("kg");
    setAddRpe("");
    setAddNotes("");
  };

  const addExerciseFromCatalog = async (esercizio: Esercizio) => {
    if (!session?.user) return;
    setAddSaving(true);
    const { error } = await supabase.from("scheda_esercizi").insert({
      scheda_id: schedaId,
      esercizio_id: esercizio.id,
      order_index: rows.length,
      sets: addSets ? Number(addSets) : null,
      reps: addReps || null,
      load_value: addLoad ? Number(addLoad) : null,
      load_unit: addUnit,
      rpe_target: addRpe ? Number(addRpe) : null,
      notes: addNotes || null,
    });
    setAddSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Esercizio aggiunto");
    setExpandedCatalogId(null);
    resetAddForm();
    setActiveTab("scheda");
    fetchData();
  };

  const createFreeExercise = async () => {
    if (!session?.user) return;
    const name = catalogSearch.trim();
    if (!name) return;
    const { data, error } = await supabase
      .from("esercizi_catalogo")
      .insert({ name, is_public: false, created_by: session.user.id })
      .select("id,name,category,muscle_group")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    const created = data as Esercizio;
    setCatalogResults([created, ...catalogResults]);
    setExpandedCatalogId(created.id);
  };

  const startEditRow = (r: SchedaEsercizio) => {
    setEditingRowId(r.id);
    setEditSets(r.sets != null ? String(r.sets) : "");
    setEditReps(r.reps ?? "");
    setEditLoad(r.load_value != null ? String(r.load_value) : "");
    setEditUnit(r.load_unit ?? "kg");
    setEditRpe(r.rpe_target != null ? String(r.rpe_target) : "");
    setEditNotes(r.notes ?? "");
  };

  const saveEditRow = async (rowId: string) => {
    setEditSaving(true);
    const { error } = await supabase
      .from("scheda_esercizi")
      .update({
        sets: editSets ? Number(editSets) : null,
        reps: editReps || null,
        load_value: editLoad ? Number(editLoad) : null,
        load_unit: editUnit,
        rpe_target: editRpe ? Number(editRpe) : null,
        notes: editNotes || null,
      })
      .eq("id", rowId);
    setEditSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Esercizio aggiornato");
    setEditingRowId(null);
    fetchData();
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
      <main className="flex-1 container mx-auto max-w-6xl px-4 py-6">
        {/* Header scheda */}
        <Link
          to="/coach/team/$teamId/periodi"
          params={{ teamId }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Torna ai periodi
        </Link>

        <div className="mt-3">
          <h1 className="text-2xl font-semibold tracking-tight">{scheda.title}</h1>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Tipo scheda
              </Label>
              <select
                value={scheda.description ?? ""}
                onChange={(e) => updateSchedaField("description", e.target.value || null)}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">—</option>
                {TIPO_SCHEDA_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Assegnata a
              </Label>
              <select
                value={scheda.athlete_id ?? ""}
                onChange={(e) => updateSchedaField("athlete_id", e.target.value || null)}
                className="h-9 rounded-md border bg-background px-3 text-sm min-w-[200px]"
              >
                <option value="">Tutta la squadra</option>
                {athletes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name || "Atleta"}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tab bar mobile */}
        <div className="lg:hidden mt-6 grid grid-cols-2 rounded-lg border bg-card p-1">
          <button
            type="button"
            onClick={() => setActiveTab("scheda")}
            className={`inline-flex items-center justify-center gap-2 text-sm font-medium py-2 rounded-md transition-colors ${
              activeTab === "scheda"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ListChecks className="h-4 w-4" />
            Scheda · {rows.length}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("catalogo")}
            className={`inline-flex items-center justify-center gap-2 text-sm font-medium py-2 rounded-md transition-colors ${
              activeTab === "catalogo"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen className="h-4 w-4" />
            Catalogo
          </button>
        </div>

        {/* Contenuto: desktop 2 colonne, mobile 1 colonna tab */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Colonna Catalogo */}
          <section
            className={`${activeTab === "catalogo" ? "block" : "hidden"} lg:block`}
          >
            <div className="rounded-lg border bg-card">
              <div className="p-4 border-b space-y-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Catalogo esercizi
                  </h2>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cerca esercizio..."
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
                  <CategoryPill
                    label="Tutti"
                    active={categoryFilter === null}
                    onClick={() => setCategoryFilter(null)}
                  />
                  {CATEGORIES.map((c) => (
                    <CategoryPill
                      key={c.value}
                      label={c.label}
                      color={c.color}
                      active={categoryFilter === c.value}
                      onClick={() => setCategoryFilter(c.value)}
                    />
                  ))}
                </div>
              </div>

              <div className="max-h-[70vh] overflow-y-auto divide-y">
                {loadingCatalog ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline" />
                  </div>
                ) : catalogResults.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground space-y-3">
                    <div>Nessun risultato</div>
                    {catalogSearch.trim() && (
                      <Button variant="outline" size="sm" onClick={createFreeExercise}>
                        <Plus className="h-4 w-4" /> Crea "{catalogSearch.trim()}"
                      </Button>
                    )}
                  </div>
                ) : (
                  catalogResults.map((e) => {
                    const cat = e.category ? CAT_MAP.get(e.category) : null;
                    const expanded = expandedCatalogId === e.id;
                    return (
                      <div key={e.id}>
                        <button
                          type="button"
                          onClick={() => {
                            if (expanded) {
                              setExpandedCatalogId(null);
                            } else {
                              setExpandedCatalogId(e.id);
                              resetAddForm();
                            }
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{e.name}</span>
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
                        {expanded && (
                          <div className="px-4 pb-4 pt-1 bg-muted/30 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label htmlFor={`sets-${e.id}`}>Serie</Label>
                                <Input
                                  id={`sets-${e.id}`}
                                  type="number"
                                  min={1}
                                  value={addSets}
                                  onChange={(ev) => setAddSets(ev.target.value)}
                                />
                              </div>
                              <div>
                                <Label htmlFor={`reps-${e.id}`}>Reps</Label>
                                <Input
                                  id={`reps-${e.id}`}
                                  placeholder="8 o 8-10"
                                  value={addReps}
                                  onChange={(ev) => setAddReps(ev.target.value)}
                                />
                              </div>
                              <div>
                                <Label htmlFor={`load-${e.id}`}>Carico</Label>
                                <Input
                                  id={`load-${e.id}`}
                                  type="number"
                                  step="0.5"
                                  value={addLoad}
                                  onChange={(ev) => setAddLoad(ev.target.value)}
                                />
                              </div>
                              <div>
                                <Label htmlFor={`unit-${e.id}`}>Unità</Label>
                                <select
                                  id={`unit-${e.id}`}
                                  value={addUnit}
                                  onChange={(ev) => setAddUnit(ev.target.value)}
                                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                                >
                                  {UNIT_OPTIONS.map((u) => (
                                    <option key={u} value={u}>
                                      {u}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="col-span-2">
                                <Label htmlFor={`rpe-${e.id}`}>RPE target (opzionale)</Label>
                                <Input
                                  id={`rpe-${e.id}`}
                                  type="number"
                                  min={1}
                                  max={10}
                                  step="0.5"
                                  value={addRpe}
                                  onChange={(ev) => setAddRpe(ev.target.value)}
                                />
                              </div>
                              <div className="col-span-2">
                                <Label htmlFor={`notes-${e.id}`}>Note</Label>
                                <Textarea
                                  id={`notes-${e.id}`}
                                  rows={2}
                                  value={addNotes}
                                  onChange={(ev) => setAddNotes(ev.target.value)}
                                />
                              </div>
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setExpandedCatalogId(null)}
                              >
                                <X className="h-4 w-4" /> Annulla
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => addExerciseFromCatalog(e)}
                                disabled={addSaving}
                              >
                                {addSaving && (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                )}
                                <Plus className="h-4 w-4" /> Aggiungi alla scheda
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {catalogSearch.trim() && catalogResults.length > 0 && (
                <div className="p-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={createFreeExercise}
                  >
                    <Plus className="h-4 w-4" /> Crea "{catalogSearch.trim()}"
                  </Button>
                </div>
              )}
            </div>
          </section>

          {/* Colonna Scheda */}
          <section
            className={`${activeTab === "scheda" ? "block" : "hidden"} lg:block`}
          >
            <div className="rounded-lg border bg-card">
              <div className="p-4 border-b flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Esercizi scheda · <span className="font-mono">{rows.length}</span>
                </h2>
              </div>

              {rows.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="mx-auto h-12 w-12 grid place-items-center rounded-full bg-secondary">
                    <Dumbbell className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 font-semibold text-sm">Nessun esercizio</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Aggiungi esercizi dal catalogo a fianco.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 lg:hidden"
                    onClick={() => setActiveTab("catalogo")}
                  >
                    <BookOpen className="h-4 w-4" /> Apri catalogo
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {rows.map((r, idx) => {
                    const cat = r.esercizio?.category
                      ? CAT_MAP.get(r.esercizio.category)
                      : null;
                    const editing = editingRowId === r.id;
                    return (
                      <div key={r.id}>
                        <div className="flex items-start justify-between gap-2 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono text-muted-foreground w-6">
                                {String(idx + 1).padStart(2, "0")}
                              </span>
                              <div className="font-medium text-sm">
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
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                editing ? setEditingRowId(null) : startEditRow(r)
                              }
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {editing ? (
                                <X className="h-4 w-4" />
                              ) : (
                                <Pencil className="h-4 w-4" />
                              )}
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
                        {editing && (
                          <div className="px-4 pb-4 pt-1 bg-muted/30 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label htmlFor={`e-sets-${r.id}`}>Serie</Label>
                                <Input
                                  id={`e-sets-${r.id}`}
                                  type="number"
                                  min={1}
                                  value={editSets}
                                  onChange={(ev) => setEditSets(ev.target.value)}
                                />
                              </div>
                              <div>
                                <Label htmlFor={`e-reps-${r.id}`}>Reps</Label>
                                <Input
                                  id={`e-reps-${r.id}`}
                                  value={editReps}
                                  onChange={(ev) => setEditReps(ev.target.value)}
                                />
                              </div>
                              <div>
                                <Label htmlFor={`e-load-${r.id}`}>Carico</Label>
                                <Input
                                  id={`e-load-${r.id}`}
                                  type="number"
                                  step="0.5"
                                  value={editLoad}
                                  onChange={(ev) => setEditLoad(ev.target.value)}
                                />
                              </div>
                              <div>
                                <Label htmlFor={`e-unit-${r.id}`}>Unità</Label>
                                <select
                                  id={`e-unit-${r.id}`}
                                  value={editUnit}
                                  onChange={(ev) => setEditUnit(ev.target.value)}
                                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                                >
                                  {UNIT_OPTIONS.map((u) => (
                                    <option key={u} value={u}>
                                      {u}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="col-span-2">
                                <Label htmlFor={`e-rpe-${r.id}`}>RPE target</Label>
                                <Input
                                  id={`e-rpe-${r.id}`}
                                  type="number"
                                  min={1}
                                  max={10}
                                  step="0.5"
                                  value={editRpe}
                                  onChange={(ev) => setEditRpe(ev.target.value)}
                                />
                              </div>
                              <div className="col-span-2">
                                <Label htmlFor={`e-notes-${r.id}`}>Note</Label>
                                <Textarea
                                  id={`e-notes-${r.id}`}
                                  rows={2}
                                  value={editNotes}
                                  onChange={(ev) => setEditNotes(ev.target.value)}
                                />
                              </div>
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingRowId(null)}
                              >
                                Annulla
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => saveEditRow(r.id)}
                                disabled={editSaving}
                              >
                                {editSaving && (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                )}
                                Salva
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
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