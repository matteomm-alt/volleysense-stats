import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronLeft, UserCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/coach/team/$teamId/presenze")({
  component: PresenzeCoachPage,
});

type Atleta = { id: string; full_name: string | null };
type PresenzaRecord = { athlete_id: string; status: string };
type GiornataPresenze = { date: string; presenti: string[]; totale: number };

function PresenzeCoachPage() {
  const { teamId } = Route.useParams();
  const { loading, session, profile, role, signOut } = useAuth();
  const navigate = useNavigate();

  const [atleti, setAtleti] = useState<Atleta[]>([]);
  const [storico, setStorico] = useState<GiornataPresenze[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/login" });
    else if (!profile?.onboarded || !role) navigate({ to: "/onboarding" });
    else if (role === "atleta") navigate({ to: "/atleta" });
  }, [loading, session, profile, role, navigate]);

  useEffect(() => {
    if (!session?.user) return;
    const fetchData = async () => {
      setLoadingData(true);

      const { data: members, error: mErr } = await supabase
        .from("team_members")
        .select("athlete_id, profiles(id, full_name)")
        .eq("team_id", teamId);
      if (mErr) { toast.error(mErr.message); setLoadingData(false); return; }

      const atletiList: Atleta[] = (members ?? []).map((m: any) => {
        const p = m.profiles as { id: string; full_name: string | null } | null;
        return { id: p?.id ?? m.athlete_id, full_name: p?.full_name ?? "Atleta" };
      });
      setAtleti(atletiList);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: att, error: aErr } = await supabase
        .from("attendance")
        .select("session_date, athlete_id, status")
        .eq("team_id", teamId)
        .gte("session_date", thirtyDaysAgo.toISOString().slice(0, 10))
        .order("session_date", { ascending: false });
      if (aErr) { toast.error(aErr.message); setLoadingData(false); return; }

      const byDate = new Map<string, PresenzaRecord[]>();
      for (const row of att ?? []) {
        const d = row.session_date as string;
        if (!byDate.has(d)) byDate.set(d, []);
        byDate.get(d)!.push({ athlete_id: row.athlete_id, status: row.status });
      }
      const giorni: GiornataPresenze[] = [];
      byDate.forEach((records, date) => {
        giorni.push({
          date,
          presenti: records.filter((r) => r.status === "presente").map((r) => r.athlete_id),
          totale: atletiList.length,
        });
      });
      setStorico(giorni);
      setLoadingData(false);
    };
    fetchData();
  }, [session?.user, teamId]);

  const toggleAtleta = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const salvaPresenze = async () => {
    if (!formDate) { toast.error("Seleziona una data"); return; }
    setSaving(true);

    const rows = atleti.map((a) => ({
      team_id: teamId,
      athlete_id: a.id,
      session_date: formDate,
      status: (selected.has(a.id) ? "presente" : "assente") as "presente" | "assente",
      recorded_by: session!.user.id,
    }));

    const { error } = await supabase
      .from("attendance")
      .upsert(rows, { onConflict: "team_id,athlete_id,session_date" });

    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Presenze salvate");
    setSelected(new Set());

    const { data: att } = await supabase
      .from("attendance")
      .select("session_date, athlete_id, status")
      .eq("team_id", teamId)
      .order("session_date", { ascending: false });
    const byDate = new Map<string, PresenzaRecord[]>();
    for (const row of att ?? []) {
      const d = row.session_date as string;
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d)!.push({ athlete_id: row.athlete_id, status: row.status });
    }
    const giorni: GiornataPresenze[] = [];
    byDate.forEach((records, date) => {
      giorni.push({
        date,
        presenti: records.filter((r) => r.status === "presente").map((r) => r.athlete_id),
        totale: atleti.length,
      });
    });
    setStorico(giorni);
  };

  if (loading || loadingData || !profile) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const atletaName = (id: string) =>
    atleti.find((a) => a.id === id)?.full_name ?? "Atleta";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader name={profile.full_name ?? "Coach"} role={role} onSignOut={signOut} />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          to="/coach/team/$teamId"
          params={{ teamId }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ChevronLeft className="h-4 w-4" />
          Torna alla squadra
        </Link>

        <h1 className="text-2xl font-bold tracking-tight">Presenze</h1>
        <p className="text-sm text-muted-foreground">
          Registro sessioni — ultimi 30 giorni
        </p>

        <section className="mt-6 rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Registra presenze
          </h2>

          <div className="mb-4">
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">
              Data sessione
            </label>
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            />
          </div>

          {atleti.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun atleta nella squadra.</p>
          ) : (
            <div className="rounded-md border divide-y">
              {atleti.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAtleta(a.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <span className="text-sm">{a.full_name ?? "Atleta"}</span>
                  <span
                    className={
                      "text-[10px] font-mono uppercase tracking-wider rounded px-1.5 py-0.5 border " +
                      (selected.has(a.id)
                        ? "bg-primary/10 text-primary border-primary/20"
                        : "text-muted-foreground")
                    }
                  >
                    {selected.has(a.id) ? "presente" : "assente"}
                  </span>
                </button>
              ))}
            </div>
          )}

          <Button onClick={salvaPresenze} disabled={saving || atleti.length === 0} className="mt-4">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salva presenze
          </Button>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Storico sessioni
          </h2>

          {storico.length === 0 ? (
            <div className="rounded-lg border bg-card p-8 text-center">
              <UserCheck className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Nessuna sessione registrata negli ultimi 30 giorni.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {storico.map((g) => (
                <div key={g.date} className="rounded-lg border bg-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold capitalize">
                      {new Date(g.date + "T00:00:00").toLocaleDateString("it-IT", {
                        weekday: "long", day: "numeric", month: "long",
                      })}
                    </div>
                    <div className="text-xs font-mono text-muted-foreground">
                      {g.presenti.length} / {g.totale}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {g.presenti.map((id) => (
                      <span
                        key={id}
                        className="text-xs rounded-full bg-primary/10 text-primary px-2.5 py-0.5"
                      >
                        {atletaName(id)}
                      </span>
                    ))}
                    {g.presenti.length === 0 && (
                      <span className="text-xs text-muted-foreground">Nessun presente</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
