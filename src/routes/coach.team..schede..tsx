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
  const [athletes, setAthletes] = useState<TeamAthlete[]>([]);

  // Mobile tabs
  const [activeTab, setActiveTab] = useState<"scheda" | "catalogo">("scheda");

  // Catalog state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [results, setResults] = useState<Esercizio[]>([]);
  const [searching, setSearching] = useState(false);
  const [expandedCatalogId, setExpandedCatalogId] = useState<string | null>(null);

  // Add form
  const [addSets, setAddSets] = useState("3");
  const [addReps, setAddReps] = useState("8");
  const [addLoad, setAddLoad] = useState("");
  const [addUnit, setAddUnit] = useState("kg");
  const [addRpe, setAddRpe] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [savingAdd, setSavingAdd] = useState(false);

  // Edit row state
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editSets, setEditSets] = useState("");
  const [editReps, setEditReps] = useState("");
  const [editLoad, setEditLoad] = useState("");
  const [editUnit, setEditUnit] = useState("kg");
  const [editRpe, setEditRpe] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

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

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  // Catalog fetch
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setSearching(true);
      let q = supabase
        .from("esercizi_catalogo")
        .select("*")
        .eq("is_public", true)
        .order("name", { ascending: true })
        .limit(50);
      if (debouncedSearch.trim()) q = q.ilike("name", `%${debouncedSearch.trim()}%`);
      if (categoryFilter) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        q = q.eq("category", categoryFilter as any);
      }
      const { data, error } = await q;
      if (cancelled) return;
      if (error) toast.error(error.message);
      setResults((data ?? []) as Esercizio[]);
      setSearching(false);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, categoryFilter]);

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

  const resetAddForm = () => {
    setAddSets("3");
    setAddReps("8");
    setAddLoad("");
    setAddUnit("kg");
    setAddRpe("");
    setAddNotes("");
  };

  const addExerciseToScheda = async (esercizio: Esercizio) => {
    setSavingAdd(true);
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
    setSavingAdd(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Esercizio aggiunto");
    setExpandedCatalogId(null);
    resetAddForm();
    fetchData();
  };

  const createFreeAndPick = async () => {
    const name = search.trim();
    if (!name || !session?.user) return;
    const { data, error } = await supabase
      .from("esercizi_catalogo")
      .insert({ name, is_public: false, created_by: session.user.id })
      .select("*")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    const created = data as Esercizio;
    setResults((r) => [created, ...r]);
    setExpandedCatalogId(created.id);
  };

  const beginEdit = (r: SchedaEsercizio) => {
    setEditingRowId(r.id);
    setEditSets(r.sets != null ? String(r.sets) : "");
    setEditReps(r.reps ?? "");
    setEditLoad(r.load_value != null ? String(r.load_value) : "");
    setEditUnit(r.load_unit ?? "kg");
    setEditRpe(r.rpe_target != null ? String(r.rpe_target) : "");
    setEditNotes(r.notes ?? "");
  };

  const saveEdit = async () => {
    if (!editingRowId) return;
    setSavingEdit(true);
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
      .eq("id", editingRowId);
    setSavingEdit(false);
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

  const catalogSection = (
    <div className="flex flex-col h-full min-h-0 rounded-lg border bg-card">
      <div className="p-4 border-b space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Catalogo esercizi
          </h2>
          <span className="text-xs text-muted-foreground font-mono">
            {results.length} risultati
          </span>
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
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca esercizio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto divide-y">
        {searching ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin inline" />
          </div>
        ) : results.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground space-y-3">
            <div>Nessun risultato</div>
            {search.trim() && (
              <Button variant="outline" size="sm" onClick={createFreeAndPick}>
                <Plus className="h-4 w-4" /> Crea "{search.trim()}"
              </Button>
            )}
          </div>
        ) : (
          results.map((e) => {
            const cat = e.category ? CAT_MAP.get(e.category) : null;
            const expanded = expandedCatalogId === e.id;
            return (
              <div key={e.id}>
                <button
                  onClick={() => {
                    if (expanded) {
                      setExpandedCatalogId(null);
                    } else {
                      resetAddForm();
                      setExpandedCatalogId(e.id);
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
                  <div className="px-4 pb-4 pt-1 bg-muted/20 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Serie</Label>
                        <Input
                          type="number"
                          min={1}
                          value={addSets}
                          onChange={(ev) => setAddSets(ev.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Reps</Label>
                        <Input
                          placeholder="8 oppure 8-10"
                          value={addReps}
                          onChange={(ev) => setAddReps(ev.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Carico</Label>
                        <Input
                          type="number"
                          step="0.5"
                          value={addLoad}
                          onChange={(ev) => setAddLoad(ev.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Unità</Label>
                        <Select value={addUnit} onValueChange={setAddUnit}>
                          <SelectTrigger>
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
                        <Label className="text-xs">RPE target (1-10)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          step="0.5"
                          value={addRpe}
                          onChange={(ev) => setAddRpe(ev.target.value)}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Note</Label>
                        <Textarea
                          rows={2}
                          value={addNotes}
                          onChange={(ev) => setAddNotes(ev.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExpandedCatalogId(null)}
                      >
                        Annulla
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => addExerciseToScheda(e)}
                        disabled={savingAdd}
                      >
                        {savingAdd && <Loader2 className="h-4 w-4 animate-spin" />}
                        Aggiungi alla scheda
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const schedaSection = (
    <div className="flex flex-col h-full min-h-0 rounded-lg border bg-card">
      <div className="p-4 border-b space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">{scheda.title}</h1>
        <div className="grid gap-3 sm:grid-cols-2">
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

      <div className="flex-1 min-h-0 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto h-12 w-12 grid place-items-center rounded-full bg-secondary">
              <Dumbbell className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Clicca un esercizio dal catalogo per aggiungerlo
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {rows.map((r, idx) => {
              const cat = r.esercizio?.category
                ? CAT_MAP.get(r.esercizio.category)
                : null;
              const isEditing = editingRowId === r.id;
              return (
                <div key={r.id}>
                  <div className="flex items-start justify-between gap-3 px-5 py-4">
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
                      <div className="mt-1 ml-8 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                        {r.sets != null && r.reps && (
                          <span>
                            {r.sets}×{r.reps}
                          </span>
                        )}
                        {r.load_value != null && (
                          <span>
                            @ {r.load_value} {r.load_unit ?? "kg"}
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
                        onClick={() => (isEditing ? setEditingRowId(null) : beginEdit(r))}
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
                  {isEditing && (
                    <div className="px-5 pb-5 pt-1 bg-muted/20 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Serie</Label>
                          <Input
                            type="number"
                            min={1}
                            value={editSets}
                            onChange={(e) => setEditSets(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Reps</Label>
                          <Input
                            value={editReps}
                            onChange={(e) => setEditReps(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Carico</Label>
                          <Input
                            type="number"
                            step="0.5"
                            value={editLoad}
                            onChange={(e) => setEditLoad(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Unità</Label>
                          <Select value={editUnit} onValueChange={setEditUnit}>
                            <SelectTrigger>
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
                          <Label className="text-xs">RPE target</Label>
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            step="0.5"
                            value={editRpe}
                            onChange={(e) => setEditRpe(e.target.value)}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Note</Label>
                          <Textarea
                            rows={2}
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingRowId(null)}
                        >
                          Annulla
                        </Button>
                        <Button size="sm" onClick={saveEdit} disabled={savingEdit}>
                          {savingEdit && <Loader2 className="h-4 w-4 animate-spin" />}
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
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader name={profile.full_name ?? "Coach"} role={role} onSignOut={signOut} />
      <main className="flex-1 container mx-auto max-w-7xl px-4 sm:px-6 py-6">
        <Link
          to="/coach/team/$teamId/periodi"
          params={{ teamId }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft className="h-4 w-4" />
          Torna ai periodi
        </Link>

        {/* Desktop: two columns */}
        <div className="hidden lg:grid lg:grid-cols-2 lg:gap-6 lg:h-[calc(100vh-8rem)]">
          {catalogSection}
          {schedaSection}
        </div>

        {/* Mobile: tabs */}
        <div className="lg:hidden">
          <div className="flex gap-2 p-1 rounded-full bg-muted mb-4 w-fit mx-auto">
            <button
              onClick={() => setActiveTab("scheda")}
              className={`px-5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeTab === "scheda"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              Scheda
            </button>
            <button
              onClick={() => setActiveTab("catalogo")}
              className={`px-5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeTab === "catalogo"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              Catalogo
            </button>
          </div>
          <div className="h-[calc(100vh-14rem)]">
            {activeTab === "scheda" ? schedaSection : catalogSection}
          </div>
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
