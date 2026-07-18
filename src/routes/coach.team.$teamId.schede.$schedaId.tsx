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
  const [activeTab, setActiveTab] = useState<"scheda" | "catalogo">("scheda");
  const [expandedCatalogId, setExpandedCatalogId] = useState<string | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogResults, setCatalogResults] = useState<Esercizio[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [addSets, setAddSets] = useState("3");
  const [addReps, setAddReps] = useState("8");
  const [addLoad, setAddLoad] = useState("");
  const [addUnit, setAddUnit] = useState("kg");
  const [addRpe, setAddRpe] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addSaving, setAddSaving] = useState(false);
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
      <main className="flex-1 container mx-auto max-w-7xl px-4 py-6">
        <Link
          to="/coach/team/$teamId/periodi"
          params={{ teamId }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Torna ai periodi
        </Link>

        <header className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {scheda.title}
            </h1>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[520px]">
            <div className="flex min-w-0 flex-col gap-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Tipo scheda
              </Label>
              <select
                value={scheda.description ?? ""}
                onChange={(e) => updateSchedaField("description", e.target.value || null)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">—</option>
                {TIPO_SCHEDA_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Assegnata a
              </Label>
              <select
                value={scheda.athlete_id ?? ""}
                onChange={(e) => updateSchedaField("athlete_id", e.target.value || null)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
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
        </header>

        <div className="mt-6 grid grid-cols-2 rounded-lg border bg-card p-1 lg:hidden">
          <button
            type="button"
            onClick={() => setActiveTab("scheda")}
            className={`inline-flex min-w-0 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors ${
              activeTab === "scheda"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ListChecks className="h-4 w-4 shrink-0" />
            <span className="truncate">Scheda</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("catalogo")}
            className={`inline-flex min-w-0 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors ${
              activeTab === "catalogo"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen className="h-4 w-4 shrink-0" />
            <span className="truncate">Catalogo</span>
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-start">
          <section className={`${activeTab === "scheda" ? "block" : "hidden"} lg:block`}>
            <div className="rounded-lg border bg-card">
              <div className="border-b p-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <ListChecks className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <h2 className="truncate text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Scheda
                    </h2>
                  </div>
                  <span className="shrink-0 rounded-full bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                    {rows.length} esercizi
                  </span>
                </div>
              </div>

              {rows.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-secondary">
                    <Dumbbell className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold">Nessun esercizio</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Aggiungi esercizi dal catalogo.
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
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
                              <span className="w-7 shrink-0 font-mono text-xs text-muted-foreground">
                                {String(idx + 1).padStart(2, "0")}
                              </span>
                              <div className="min-w-0">
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                  <span className="min-w-0 truncate text-sm font-medium">
                                    {r.esercizio?.name ?? "Esercizio"}
                                  </span>
                                  {cat && <CategoryBadge label={cat.label} color={cat.color} />}
                                </div>
                              </div>
                            </div>
                            <div className="mt-2 ml-9 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
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
                          <div className="flex shrink-0 items-start gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                editing ? setEditingRowId(null) : startEditRow(r)
                              }
                              className="text-muted-foreground hover:text-foreground"
                              aria-label={editing ? "Chiudi modifica" : "Modifica esercizio"}
                            >
                              {editing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeRow(r.id)}
                              className="text-muted-foreground hover:text-destructive"
                              aria-label="Elimina esercizio"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {editing && (
                          <div className="space-y-3 bg-muted/30 px-4 pb-4 pt-1">
                            <ExerciseFields
                              idPrefix={`edit-${r.id}`}
                              sets={editSets}
                              reps={editReps}
                              load={editLoad}
                              unit={editUnit}
                              rpe={editRpe}
                              notes={editNotes}
                              onSets={setEditSets}
                              onReps={setEditReps}
                              onLoad={setEditLoad}
                              onUnit={setEditUnit}
                              onRpe={setEditRpe}
                              onNotes={setEditNotes}
                            />
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
                                {editSaving && <Loader2 className="h-4 w-4 animate-spin" />}
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

          <section className={`${activeTab === "catalogo" ? "block" : "hidden"} lg:block`}>
            <div className="rounded-lg border bg-card">
              <div className="space-y-3 border-b p-4">
                <div className="flex min-w-0 items-center gap-2">
                  <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <h2 className="truncate text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Catalogo
                  </h2>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Cerca esercizio..."
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-2 overflow-x-auto px-1 pb-1">
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
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    <Loader2 className="inline h-4 w-4 animate-spin" />
                  </div>
                ) : catalogResults.length === 0 ? (
                  <div className="space-y-3 p-8 text-center text-sm text-muted-foreground">
                    <div>Nessun risultato</div>
                    {catalogSearch.trim() && (
                      <Button variant="outline" size="sm" onClick={createFreeExercise}>
                        <Plus className="h-4 w-4" /> Crea “{catalogSearch.trim()}”
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
                          className="w-full px-4 py-3 text-left transition-colors hover:bg-muted/50"
                        >
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="min-w-0 truncate text-sm font-medium">{e.name}</span>
                            {cat && <CategoryBadge label={cat.label} color={cat.color} />}
                          </div>
                          {e.muscle_group && (
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {e.muscle_group}
                            </div>
                          )}
                        </button>

                        {expanded && (
                          <div className="space-y-3 bg-muted/30 px-4 pb-4 pt-1">
                            <ExerciseFields
                              idPrefix={`add-${e.id}`}
                              sets={addSets}
                              reps={addReps}
                              load={addLoad}
                              unit={addUnit}
                              rpe={addRpe}
                              notes={addNotes}
                              onSets={setAddSets}
                              onReps={setAddReps}
                              onLoad={setAddLoad}
                              onUnit={setAddUnit}
                              onRpe={setAddRpe}
                              onNotes={setAddNotes}
                            />
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
                                {addSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                                <Plus className="h-4 w-4" /> Aggiungi
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
                <div className="border-t p-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={createFreeExercise}
                  >
                    <Plus className="h-4 w-4" /> Crea “{catalogSearch.trim()}”
                  </Button>
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
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-transparent text-primary-foreground"
          : "bg-background text-foreground hover:bg-muted"
      }`}
      style={active ? { backgroundColor: color ?? "hsl(var(--primary))" } : undefined}
    >
      {label}
    </button>
  );
}

function CategoryBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground"
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  );
}

function ExerciseFields({
  idPrefix,
  sets,
  reps,
  load,
  unit,
  rpe,
  notes,
  onSets,
  onReps,
  onLoad,
  onUnit,
  onRpe,
  onNotes,
}: {
  idPrefix: string;
  sets: string;
  reps: string;
  load: string;
  unit: string;
  rpe: string;
  notes: string;
  onSets: (value: string) => void;
  onReps: (value: string) => void;
  onLoad: (value: string) => void;
  onUnit: (value: string) => void;
  onRpe: (value: string) => void;
  onNotes: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label htmlFor={`${idPrefix}-sets`}>Serie</Label>
        <Input
          id={`${idPrefix}-sets`}
          type="number"
          min={1}
          value={sets}
          onChange={(e) => onSets(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-reps`}>Reps</Label>
        <Input
          id={`${idPrefix}-reps`}
          placeholder="8 o 8-10"
          value={reps}
          onChange={(e) => onReps(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-load`}>Carico</Label>
        <Input
          id={`${idPrefix}-load`}
          type="number"
          step="0.5"
          value={load}
          onChange={(e) => onLoad(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-unit`}>Unità</Label>
        <select
          id={`${idPrefix}-unit`}
          value={unit}
          onChange={(e) => onUnit(e.target.value)}
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
        <Label htmlFor={`${idPrefix}-rpe`}>RPE target</Label>
        <Input
          id={`${idPrefix}-rpe`}
          type="number"
          min={1}
          max={10}
          step="0.5"
          value={rpe}
          onChange={(e) => onRpe(e.target.value)}
        />
      </div>
      <div className="col-span-2">
        <Label htmlFor={`${idPrefix}-notes`}>Note</Label>
        <Textarea
          id={`${idPrefix}-notes`}
          rows={2}
          value={notes}
          onChange={(e) => onNotes(e.target.value)}
        />
      </div>
    </div>
  );
}