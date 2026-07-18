import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Loader2, ChevronLeft, Dumbbell } from "lucide-react";
import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/atleta/storico")({
  component: AtletaStoricoPage,
});

type SetLogRow = {
  id: string;
  esercizio_name: string;
  reps: number | null;
  load_value: number | null;
  load_unit: string | null;
  rpe: number | null;
};

type SessioneRow = {
  id: string;
  session_date: string;
  duration_minutes: number | null;
  rpe: number | null;
  notes: string | null;
  team_name: string;
  set_logs: SetLogRow[];
};

function AtletaStoricoPage() {
  const { loading, session, profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [sessioni, setSessioni] = useState<SessioneRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/login" });
    else if (!profile?.onboarded || !role) navigate({ to: "/onboarding" });
    else if (role === "coach") navigate({ to: "/coach" });
  }, [loading, session, profile, role, navigate]);

  useEffect(() => {
    if (!session?.user) return;
    const fetchData = async () => {
      setLoadingData(true);
      const { data: sess, error } = await supabase
        .from("sessions")
        .select("id, session_date, duration_minutes, rpe, notes, teams(name), set_logs(id, reps, load_value, load_unit, rpe, esercizi_catalogo(name))")
        .eq("athlete_id", session.user.id)
        .order("session_date", { ascending: false })
        .limit(30);
      if (error) { toast.error(error.message); setLoadingData(false); return; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: SessioneRow[] = (sess ?? []).map((s: any) => ({
        id: s.id,
        session_date: s.session_date,
        duration_minutes: s.duration_minutes,
        rpe: s.rpe,
        notes: s.notes,
        team_name: s.teams?.name ?? "Squadra",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        set_logs: (s.set_logs ?? []).map((l: any) => ({
          id: l.id,
          esercizio_name: l.esercizi_catalogo?.name ?? "Esercizio",
          reps: l.reps,
          load_value: l.load_value,
          load_unit: l.load_unit,
          rpe: l.rpe,
        })),
      }));
      setSessioni(rows);
      setLoadingData(false);
    };
    fetchData();
  }, [session?.user]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const rpeColor = (r: number) =>
    r <= 3 ? "text-emerald-500" : r <= 6 ? "text-amber-500" : r <= 8 ? "text-orange-500" : "text-red-500";

  if (loading || loadingData || !profile) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader
        name={profile.full_name ?? "Atleta"}
        role={role}
        onSignOut={signOut}
        maxWidth="max-w-3xl"
      />
      <main className="flex-1 container mx-auto max-w-3xl px-4 py-8 space-y-4">
        <Link to="/atleta" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
          Torna alla home
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Storico allenamenti</h1>
          <p className="text-sm text-muted-foreground mt-1">Ultime 30 sessioni registrate</p>
        </div>

        <div className="rounded-xl border bg-card divide-y overflow-hidden">
          {sessioni.length === 0 ? (
            <div className="p-10 text-center">
              <div className="mx-auto h-12 w-12 grid place-items-center rounded-full bg-secondary">
                <Dumbbell className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="mt-4 font-semibold">Nessuna sessione registrata</h3>
              <p className="mt-1 text-sm text-muted-foreground">Registra la tua prima seduta per vederla qui.</p>
            </div>
          ) : (
            sessioni.map((s) => (
              <div key={s.id}>
                <button
                  onClick={() => toggleExpand(s.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm capitalize">
                      {new Date(s.session_date + "T00:00:00").toLocaleDateString("it-IT", {
                        weekday: "long", day: "numeric", month: "long",
                      })}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{s.team_name}</span>
                      {s.duration_minutes && <span>{s.duration_minutes} min</span>}
                      {s.set_logs.length > 0 && <span>{s.set_logs.length} serie</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {s.rpe != null && (
                      <span className={`text-lg font-bold tabular-nums ${rpeColor(s.rpe)}`}>{s.rpe}</span>
                    )}
                    <span className="text-xs text-muted-foreground">{expanded.has(s.id) ? "▲" : "▼"}</span>
                  </div>
                </button>
                {expanded.has(s.id) && (
                  <div className="px-4 pb-4 space-y-3 bg-muted/20">
                    {s.notes && <p className="text-sm italic text-muted-foreground">{s.notes}</p>}
                    {s.set_logs.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nessun esercizio registrato.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {s.set_logs.map((l) => (
                          <div key={l.id} className="flex items-center justify-between text-sm rounded-md bg-background border px-3 py-2">
                            <span className="font-medium">{l.esercizio_name}</span>
                            <span className="text-xs text-muted-foreground font-mono">
                              {l.reps != null ? `${l.reps} reps` : ""}
                              {l.load_value != null ? ` · ${l.load_value} ${l.load_unit ?? "kg"}` : ""}
                              {l.rpe != null ? ` · RPE ${l.rpe}` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}