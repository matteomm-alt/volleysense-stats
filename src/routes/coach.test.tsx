import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, FormEvent, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ChevronLeft,
  Plus,
  Trash2,
  Gauge,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type Team = Tables<"teams">;
type TipoTest = Tables<"tipi_test">;
type Risultato = Tables<"test_risultati">;

type RosterMember = {
  key: string;
  kind: "athlete" | "placeholder";
  id: string;
  full_name: string;
};

const ALL = "__all__";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/coach/test")({
  component: TestPage,
});

function TestPage() {
  const { loading, session, profile, role, signOut } = useAuth();
  const navigate = useNavigate();

  const [teams, setTeams] = useState<Team[]>([]);
  const [tipi, setTipi] = useState<TipoTest[]>([]);
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [risultati, setRisultati] = useState<Risultato[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Filtri
  const [fTeam, setFTeam] = useState<string>(ALL);
  const [fMember, setFMember] = useState<string>(ALL);
  const [fTipo, setFTipo] = useState<string>(ALL);

  // Nuovo tipo test
  const [openNewTipo, setOpenNewTipo] = useState(false);
  const [ntName, setNtName] = useState("");
  const [ntCategory, setNtCategory] = useState("");
  const [ntUnit, setNtUnit] = useState("");
  const [ntHigher, setNtHigher] = useState(true);
  const [savingTipo, setSavingTipo] = useState(false);

  // Nuovo risultato
  const [rTeam, setRTeam] = useState<string>("");
  const [rMember, setRMember] = useState<string>("");
  const [rTipo, setRTipo] = useState<string>("");
  const [rValue, setRValue] = useState<string>("");
  const [rDate, setRDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [rNotes, setRNotes] = useState<string>("");
  const [savingR, setSavingR] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/login" });
    else if (!profile?.onboarded || !role) navigate({ to: "/onboarding" });
    else if (role === "atleta") navigate({ to: "/atleta" });
  }, [loading, session, profile, role, navigate]);

  const fetchAll = useCallback(async () => {
    setLoadingData(true);
    try {
      const [{ data: ts }, { data: tps }] = await Promise.all([
        supabase.from("teams").select("*").order("name", { ascending: true }),
        supabase.from("tipi_test").select("*").order("name", { ascending: true }),
      ]);
      setTeams(ts ?? []);
      setTipi(tps ?? []);

      const teamIds = (ts ?? []).map((t) => t.id);
      if (teamIds.length) {
        const { data: rs } = await supabase
          .from("test_risultati")
          .select("*")
          .in("team_id", teamIds)
          .order("tested_at", { ascending: false });
        setRisultati(rs ?? []);
      } else {
        setRisultati([]);
      }
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user && role && role !== "atleta") fetchAll();
  }, [session?.user, role, fetchAll]);

  // Roster: quando cambia squadra filtro OR squadra form
  const loadRoster = useCallback(async (teamId: string): Promise<RosterMember[]> => {
    if (!teamId || teamId === ALL) return [];
    const [{ data: members }, { data: phs }] = await Promise.all([
      supabase.from("team_members").select("athlete_id").eq("team_id", teamId),
      supabase
        .from("atleti_placeholder")
        .select("id, full_name")
        .eq("team_id", teamId)
        .is("linked_athlete_id", null),
    ]);
    const list: RosterMember[] = [];
    const athleteIds = (members ?? []).map((m) => m.athlete_id);
    if (athleteIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", athleteIds);
      (profs ?? []).forEach((p) =>
        list.push({
          key: `athlete:${p.id}`,
          kind: "athlete",
          id: p.id,
          full_name: p.full_name ?? "Atleta",
        }),
      );
    }
    (phs ?? []).forEach((p) =>
      list.push({
        key: `placeholder:${p.id}`,
        kind: "placeholder",
        id: p.id,
        full_name: p.full_name ?? "Atleta",
      }),
    );
    list.sort((a, b) => a.full_name.localeCompare(b.full_name, "it"));
    return list;
  }, []);

  useEffect(() => {
    if (!fTeam || fTeam === ALL) {
      setRoster([]);
      setFMember(ALL);
      return;
    }
    loadRoster(fTeam).then((r) => {
      setRoster(r);
      setFMember(ALL);
    });
  }, [fTeam, loadRoster]);

  // Roster per form (indipendente dal filtro)
  const [formRoster, setFormRoster] = useState<RosterMember[]>([]);
  useEffect(() => {
    if (!rTeam) {
      setFormRoster([]);
      setRMember("");
      return;
    }
    loadRoster(rTeam).then((r) => {
      setFormRoster(r);
      setRMember("");
    });
  }, [rTeam, loadRoster]);

  // Lookup helpers
  const teamById = useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams],
  );
  const tipoById = useMemo(
    () => new Map(tipi.map((t) => [t.id, t])),
    [tipi],
  );
  const memberLabel = useCallback(
    (r: Risultato) => {
      if (r.athlete_id) {
        const m = roster.find(
          (x) => x.kind === "athlete" && x.id === r.athlete_id,
        );
        return m?.full_name ?? "Atleta";
      }
      if (r.placeholder_id) {
        const m = roster.find(
          (x) => x.kind === "placeholder" && x.id === r.placeholder_id,
        );
        return (m?.full_name ?? "In attesa") + " (in attesa)";
      }
      return "—";
    },
    [roster],
  );

  // Filtered results
  const filtered = useMemo(() => {
    return risultati.filter((r) => {
      if (fTeam !== ALL && r.team_id !== fTeam) return false;
      if (fTipo !== ALL && r.tipo_test_id !== fTipo) return false;
      if (fMember !== ALL) {
        const [kind, id] = fMember.split(":");
        if (kind === "athlete" && r.athlete_id !== id) return false;
        if (kind === "placeholder" && r.placeholder_id !== id) return false;
      }
      return true;
    });
  }, [risultati, fTeam, fTipo, fMember]);

  // Chart data
  const chart = useMemo(() => {
    const tipo = fTipo !== ALL ? tipoById.get(fTipo) : null;
    if (!tipo) return null;

    // Line chart: atleta + tipo specifici
    if (fMember !== ALL && fTeam !== ALL) {
      const pts = [...filtered]
        .sort((a, b) => a.tested_at.localeCompare(b.tested_at))
        .map((r) => ({ date: r.tested_at, value: Number(r.value) }));
      if (!pts.length) return null;
      return { kind: "line" as const, tipo, data: pts };
    }

    // Bar chart: squadra + tipo specifici, tutti gli atleti
    if (fTeam !== ALL && fMember === ALL) {
      // ultimo risultato per ogni membro (roster) per quel test
      const bars = roster
        .map((m) => {
          const rs = filtered.filter((r) =>
            m.kind === "athlete"
              ? r.athlete_id === m.id
              : r.placeholder_id === m.id,
          );
          if (!rs.length) return null;
          const latest = rs.reduce((a, b) =>
            a.tested_at > b.tested_at ? a : b,
          );
          return { name: m.full_name, value: Number(latest.value) };
        })
        .filter((x): x is { name: string; value: number } => !!x);
      if (!bars.length) return null;
      return { kind: "bar" as const, tipo, data: bars };
    }

    return null;
  }, [filtered, fTipo, fMember, fTeam, roster, tipoById]);

  const handleCreateTipo = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;
    if (!ntName.trim() || !ntUnit.trim()) {
      toast.error("Nome e unità richiesti");
      return;
    }
    setSavingTipo(true);
    const { error } = await supabase.from("tipi_test").insert({
      name: ntName.trim(),
      category: ntCategory.trim() || null,
      unit: ntUnit.trim(),
      higher_is_better: ntHigher,
      is_public: false,
      created_by: session.user.id,
    });
    setSavingTipo(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Tipo di test creato");
    setNtName("");
    setNtCategory("");
    setNtUnit("");
    setNtHigher(true);
    setOpenNewTipo(false);
    fetchAll();
  };

  const handleCreateRisultato = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;
    if (!rTeam || !rMember || !rTipo || !rValue) {
      toast.error("Compila tutti i campi obbligatori");
      return;
    }
    const num = parseFloat(rValue);
    if (Number.isNaN(num)) {
      toast.error("Valore non valido");
      return;
    }
    const [kind, id] = rMember.split(":");
    setSavingR(true);
    const { error } = await supabase.from("test_risultati").insert({
      team_id: rTeam,
      athlete_id: kind === "athlete" ? id : null,
      placeholder_id: kind === "placeholder" ? id : null,
      tipo_test_id: rTipo,
      value: num,
      tested_at: rDate,
      notes: rNotes.trim() || null,
      created_by: session.user.id,
    });
    setSavingR(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Risultato salvato");
    setRValue("");
    setRNotes("");
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminare questo risultato?")) return;
    const { error } = await supabase.from("test_risultati").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRisultati((prev) => prev.filter((r) => r.id !== id));
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader name={profile.full_name ?? "Coach"} role={role} onSignOut={signOut} />
      <main className="flex-1 container mx-auto max-w-6xl px-6 py-10 space-y-8">
        <Link
          to="/coach"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Dashboard
        </Link>

        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Coach</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight flex items-center gap-2">
              <Gauge className="h-6 w-6" /> Test atletici
            </h1>
            <p className="mt-1 text-muted-foreground">
              Registra risultati, confronta gli atleti e monitora i progressi nel tempo.
            </p>
          </div>
          <Button variant="outline" onClick={() => setOpenNewTipo((v) => !v)}>
            <Plus className="h-4 w-4" /> Nuovo tipo di test
          </Button>
        </div>

        {/* Nuovo tipo di test */}
        {openNewTipo && (
          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Nuovo tipo di test
            </h2>
            <form onSubmit={handleCreateTipo} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nt-name">Nome *</Label>
                <Input
                  id="nt-name"
                  required
                  value={ntName}
                  onChange={(e) => setNtName(e.target.value)}
                  placeholder="es. Squat 1RM"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nt-cat">Categoria</Label>
                <Input
                  id="nt-cat"
                  value={ntCategory}
                  onChange={(e) => setNtCategory(e.target.value)}
                  placeholder="Forza, Potenza…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nt-unit">Unità *</Label>
                <Input
                  id="nt-unit"
                  required
                  value={ntUnit}
                  onChange={(e) => setNtUnit(e.target.value)}
                  placeholder="kg, cm, sec, m…"
                />
              </div>
              <label className="flex items-center gap-2 text-sm mt-6">
                <input
                  type="checkbox"
                  checked={ntHigher}
                  onChange={(e) => setNtHigher(e.target.checked)}
                />
                Un valore più alto è un miglioramento
              </label>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setOpenNewTipo(false)}>
                  Annulla
                </Button>
                <Button type="submit" disabled={savingTipo}>
                  {savingTipo && <Loader2 className="h-4 w-4 animate-spin" />}
                  Crea
                </Button>
              </div>
            </form>
          </section>
        )}

        {/* Aggiungi risultato */}
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Aggiungi risultato
          </h2>
          <form onSubmit={handleCreateRisultato} className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Squadra *</Label>
              <SelectNative value={rTeam} onChange={setRTeam}>
                <option value="">Seleziona…</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </SelectNative>
            </div>
            <div className="space-y-2">
              <Label>Atleta *</Label>
              <SelectNative value={rMember} onChange={setRMember} disabled={!rTeam}>
                <option value="">
                  {!rTeam ? "Seleziona squadra" : formRoster.length ? "Seleziona…" : "Nessun atleta"}
                </option>
                {formRoster.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.full_name}{m.kind === "placeholder" ? " (in attesa)" : ""}
                  </option>
                ))}
              </SelectNative>
            </div>
            <div className="space-y-2">
              <Label>Tipo di test *</Label>
              <SelectNative value={rTipo} onChange={setRTipo}>
                <option value="">Seleziona…</option>
                {tipi.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.unit})
                  </option>
                ))}
              </SelectNative>
            </div>
            <div className="space-y-2">
              <Label>Valore *</Label>
              <Input
                required
                type="number"
                step="any"
                value={rValue}
                onChange={(e) => setRValue(e.target.value)}
                placeholder="es. 120"
              />
            </div>
            <div className="space-y-2">
              <Label>Data *</Label>
              <Input
                required
                type="date"
                value={rDate}
                onChange={(e) => setRDate(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-1">
              <Label>Note</Label>
              <Textarea
                rows={1}
                value={rNotes}
                onChange={(e) => setRNotes(e.target.value)}
                placeholder="opzionale"
              />
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <Button type="submit" disabled={savingR}>
                {savingR && <Loader2 className="h-4 w-4 animate-spin" />}
                Salva risultato
              </Button>
            </div>
          </form>
        </section>

        {/* Filtri + risultati */}
        <section className="rounded-xl border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Risultati
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Squadra</Label>
              <SelectNative value={fTeam} onChange={setFTeam}>
                <option value={ALL}>Tutte</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </SelectNative>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Atleta</Label>
              <SelectNative value={fMember} onChange={setFMember} disabled={fTeam === ALL}>
                <option value={ALL}>Tutti</option>
                {roster.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.full_name}{m.kind === "placeholder" ? " (in attesa)" : ""}
                  </option>
                ))}
              </SelectNative>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo di test</Label>
              <SelectNative value={fTipo} onChange={setFTipo}>
                <option value={ALL}>Tutti</option>
                {tipi.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </SelectNative>
            </div>
          </div>

          {/* Grafico */}
          {chart && (
            <div className="rounded-lg border bg-background p-4">
              <div className="text-sm font-medium mb-3">
                {chart.tipo.name} ({chart.tipo.unit})
                {chart.kind === "line" && " — andamento nel tempo"}
                {chart.kind === "bar" && " — ultimo risultato per atleta"}
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {chart.kind === "line" ? (
                    <LineChart data={chart.data}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  ) : (
                    <BarChart data={chart.data}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="hsl(var(--primary))" />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Tabella */}
          {loadingData ? (
            <div className="grid place-items-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
              Nessun risultato per i filtri selezionati.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Data</th>
                    <th className="px-3 py-2 text-left">Squadra</th>
                    <th className="px-3 py-2 text-left">Atleta</th>
                    <th className="px-3 py-2 text-left">Test</th>
                    <th className="px-3 py-2 text-right">Valore</th>
                    <th className="px-3 py-2 text-left">Note</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const tipo = tipoById.get(r.tipo_test_id);
                    const team = teamById.get(r.team_id);
                    return (
                      <tr key={r.id} className="border-t">
                        <td className="px-3 py-2 font-mono text-xs">{r.tested_at}</td>
                        <td className="px-3 py-2">{team?.name ?? "—"}</td>
                        <td className="px-3 py-2 flex items-center gap-1.5">
                          {r.placeholder_id && <Clock className="h-3 w-3 text-muted-foreground" />}
                          {memberLabel(r)}
                        </td>
                        <td className="px-3 py-2">
                          {tipo?.name ?? "—"}
                          {tipo?.category && (
                            <Badge variant="outline" className="ml-2 text-[10px]">
                              {tipo.category}
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {r.value} {tipo?.unit}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground text-xs max-w-[240px] truncate">
                          {r.notes ?? ""}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => handleDelete(r.id)}
                            className="text-muted-foreground hover:text-destructive p-1"
                            aria-label="Elimina"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function SelectNative({
  value,
  onChange,
  disabled,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
    >
      {children}
    </select>
  );
}