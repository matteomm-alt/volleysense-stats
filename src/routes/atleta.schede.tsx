import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Loader2, ChevronLeft, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { findCurrentWeeksForTeam } from "@/lib/currentWeek";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/atleta/schede")({
  component: AtletaSchedePage,
});

type EsercizioRow = {
  id: string;
  order_index: number;
  sets: number | null;
  reps: string | null;
  load_value: number | null;
  load_unit: string | null;
  rpe_target: number | null;
  notes: string | null;
  esercizio_name: string;
};

type SchedaWithEsercizi = {
  id: string;
  title: string;
  description: string | null;
  periodo_title: string;
  team_name: string;
  day_label: string | null;
  scheda_type: string | null;
  esercizi: EsercizioRow[];
};

function AtletaSchedePage() {
  const { loading, session, profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [schede, setSchede] = useState<SchedaWithEsercizi[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/login" });
    else if (!profile?.onboarded || !role) navigate({ to: "/onboarding" });
    else if (role === "coach") navigate({ to: "/coach" });
  }, [loading, session, profile, role, navigate]);

  useEffect(() => {
    if (!session?.user) return;
    const fetchSchede = async () => {
      setLoadingData(true);
      const { data: memberships, error: mErr } = await supabase
        .from("team_members")
        .select("team_id, teams(id, name)")
        .eq("athlete_id", session.user.id);
      if (mErr) { toast.error(mErr.message); setLoadingData(false); return; }

      const results: SchedaWithEsercizi[] = [];

      for (const m of memberships ?? []) {
        const team = m.teams as { id: string; name: string } | null;
        if (!team) continue;

        const currentWeeks = await findCurrentWeeksForTeam(team.id);
        for (const cw of currentWeeks) {
          const { data: schedeList } = await supabase
            .from("schede")
            .select("id, title, description, day_label, scheda_type")
            .eq("team_id", team.id)
            .eq("settimana_id", cw.settimana_id)
            .or(`athlete_id.eq.${session.user.id},athlete_id.is.null`);

          for (const scheda of schedeList ?? []) {
            const { data: righe } = await supabase
              .from("scheda_esercizi")
              .select("id, order_index, sets, reps, load_value, load_unit, rpe_target, notes, esercizio_id")
              .eq("scheda_id", scheda.id)
              .order("order_index", { ascending: true });

            const ids = (righe ?? []).map((r) => r.esercizio_id).filter(Boolean) as string[];
            const nameMap = new Map<string, string>();
            if (ids.length) {
              const { data: ex } = await supabase
                .from("esercizi_catalogo")
                .select("id, name")
                .in("id", ids);
              (ex ?? []).forEach((e) => nameMap.set(e.id, e.name));
            }

            results.push({
              id: scheda.id,
              title: scheda.title,
              description: scheda.description,
              periodo_title: cw.periodo_name,
              team_name: team.name,
              day_label: (scheda as { day_label: string | null }).day_label ?? null,
              scheda_type: (scheda as { scheda_type: string | null }).scheda_type ?? null,
              esercizi: (righe ?? []).map((r) => ({
                id: r.id,
                order_index: r.order_index,
                sets: r.sets,
                reps: r.reps,
                load_value: r.load_value,
                load_unit: r.load_unit,
                rpe_target: r.rpe_target,
                notes: r.notes,
                esercizio_name: r.esercizio_id ? (nameMap.get(r.esercizio_id) ?? "Esercizio") : "Esercizio",
              })),
            });
          }
        }
      }

      setSchede(results);
      setLoadingData(false);
    };
    fetchSchede();
  }, [session?.user]);

  if (loading || loadingData || !profile) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        name={profile.full_name ?? "Atleta"}
        role={role}
        onSignOut={signOut}
        maxWidth="max-w-3xl"
      />
      <main className="flex-1 container mx-auto max-w-3xl px-6 py-10">
        <Link to="/atleta" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" /> Torna alla home
        </Link>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Schede del giorno</h1>
        <p className="mt-2 text-muted-foreground">Esercizi assegnati dal coach nel periodo attivo.</p>

        <div className="mt-8 space-y-6">
          {schede.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/30 p-10 text-center">
              <div className="mx-auto h-12 w-12 grid place-items-center rounded-full bg-secondary">
                <ClipboardList className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="mt-4 font-semibold">Nessuna scheda attiva</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                Il coach non ha ancora pianificato schede per il periodo corrente.
              </p>
            </div>
          ) : (
            schede.map((s) => (
              <div key={s.id} className="rounded-lg border bg-card p-6">
                <div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{s.team_name}</span>
                    <span>·</span>
                    <span>{s.periodo_title}</span>
                    {s.day_label && (<><span>·</span><span>{s.day_label}</span></>)}
                    {s.scheda_type && (<><span>·</span><span className="uppercase tracking-wide">{s.scheda_type}</span></>)}
                  </div>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight">{s.title}</h2>
                  {s.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                  )}
                </div>

                {s.esercizi.length === 0 ? (
                  <p className="mt-6 text-sm text-muted-foreground">Nessun esercizio aggiunto.</p>
                ) : (
                  <ol className="mt-6 space-y-3">
                    {s.esercizi.map((e, idx) => (
                      <li key={e.id} className="flex items-start gap-3 rounded-md border bg-background p-3">
                        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-xs">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm">{e.esercizio_name}</div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {e.sets != null && e.reps && <span>{e.sets} × {e.reps}</span>}
                            {e.load_value != null && <span>{e.load_value} {e.load_unit ?? "kg"}</span>}
                            {e.rpe_target != null && <span>RPE {e.rpe_target}</span>}
                            {e.notes && <span className="italic">{e.notes}</span>}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}

                <Link to={"/atleta/registro" as any}>
                  <Button className="mt-6" variant="outline" size="sm">
                    Registra questa seduta
                  </Button>
                </Link>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}