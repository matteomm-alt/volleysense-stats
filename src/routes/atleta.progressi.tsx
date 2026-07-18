import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Loader2, ChevronLeft, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/atleta/progressi")({
  component: AtletaProgressiPage,
});

type RpePoint = { date: string; rpe: number };
type VolumePoint = { date: string; volume: number };
type EsercizioOption = { id: string; name: string };
type LoadPoint = { date: string; load: number; unit: string };

function AtletaProgressiPage() {
  const { loading, session, profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [rpeData, setRpeData] = useState<RpePoint[]>([]);
  const [volumeData, setVolumeData] = useState<VolumePoint[]>([]);
  const [esercizi, setEsercizi] = useState<EsercizioOption[]>([]);
  const [selectedEsercizio, setSelectedEsercizio] = useState<string>("");
  const [loadData, setLoadData] = useState<LoadPoint[]>([]);
  const [loadingData, setLoadingData] = useState(true);

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

      const { data: sess } = await supabase
        .from("sessions")
        .select("session_date, rpe")
        .eq("athlete_id", session.user.id)
        .not("rpe", "is", null)
        .order("session_date", { ascending: true })
        .limit(20);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setRpeData((sess ?? []).map((s: any) => ({
        date: new Date(s.session_date + "T00:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "short" }),
        rpe: Number(s.rpe),
      })));

      const { data: logs } = await supabase
        .from("set_logs")
        .select("created_at, sessions!inner(athlete_id)")
        .eq("sessions.athlete_id", session.user.id)
        .order("created_at", { ascending: true });

      const weekMap = new Map<string, number>();
      for (const l of logs ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = new Date((l as any).created_at);
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        const key = monday.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
        weekMap.set(key, (weekMap.get(key) ?? 0) + 1);
      }
      setVolumeData(Array.from(weekMap.entries()).slice(-12).map(([date, volume]) => ({ date, volume })));

      const { data: exIds } = await supabase
        .from("set_logs")
        .select("esercizio_id, sessions!inner(athlete_id)")
        .eq("sessions.athlete_id", session.user.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uniqueIds = [...new Set((exIds ?? []).map((l: any) => l.esercizio_id))].filter(Boolean) as string[];
      if (uniqueIds.length) {
        const { data: exNames } = await supabase
          .from("esercizi_catalogo")
          .select("id, name")
          .in("id", uniqueIds);
        setEsercizi(exNames ?? []);
        if (exNames?.length) setSelectedEsercizio(exNames[0].id);
      }
      setLoadingData(false);
    };
    fetchData();
  }, [session?.user]);

  useEffect(() => {
    if (!session?.user || !selectedEsercizio) return;
    const fetchLoad = async () => {
      const { data } = await supabase
        .from("set_logs")
        .select("load_value, load_unit, created_at, sessions!inner(athlete_id, session_date)")
        .eq("esercizio_id", selectedEsercizio)
        .eq("sessions.athlete_id", session.user.id)
        .not("load_value", "is", null)
        .order("created_at", { ascending: true })
        .limit(20);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setLoadData((data ?? []).map((l: any) => ({
        date: new Date(l.sessions?.session_date + "T00:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "short" }),
        load: Number(l.load_value),
        unit: l.load_unit ?? "kg",
      })));
    };
    fetchLoad();
  }, [selectedEsercizio, session?.user]);

  if (loading || loadingData || !profile) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const noData = rpeData.length === 0 && volumeData.length === 0;

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
          <h1 className="text-2xl font-semibold tracking-tight">Progressi</h1>
          <p className="text-sm text-muted-foreground mt-1">Andamento RPE, volume e carichi nel tempo</p>
        </div>

        {noData ? (
          <div className="rounded-xl border bg-card p-10 text-center">
            <div className="mx-auto h-12 w-12 grid place-items-center rounded-full bg-secondary">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="mt-4 font-semibold">Nessun dato disponibile</h3>
            <p className="mt-1 text-sm text-muted-foreground">Registra alcune sessioni per vedere i grafici.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rpeData.length > 1 && (
              <div className="rounded-xl border bg-card p-5">
                <h2 className="text-sm font-semibold mb-4">Fatica percepita (RPE) nel tempo</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={rpeData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" fontSize={11} />
                    <YAxis domain={[0, 10]} fontSize={11} />
                    <Tooltip />
                    <Line type="monotone" dataKey="rpe" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {volumeData.length > 1 && (
              <div className="rounded-xl border bg-card p-5">
                <h2 className="text-sm font-semibold mb-4">Volume settimanale (serie totali)</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={volumeData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="volume" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {esercizi.length > 0 && (
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center justify-between mb-4 gap-3">
                  <h2 className="text-sm font-semibold">Andamento carico</h2>
                  <select
                    value={selectedEsercizio}
                    onChange={(e) => setSelectedEsercizio(e.target.value)}
                    className="text-sm border rounded-md px-2 py-1 bg-background"
                  >
                    {esercizi.map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
                {loadData.length > 1 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={loadData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="date" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip formatter={(v) => [`${v} ${loadData[0]?.unit ?? "kg"}`, "Carico"]} />
                      <Line type="monotone" dataKey="load" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">Dati insufficienti per questo esercizio.</p>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}