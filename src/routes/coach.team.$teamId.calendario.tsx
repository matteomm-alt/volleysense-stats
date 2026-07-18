import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  ChevronRight,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";

type EventoRow = {
  id: string;
  data: string;
  tipo: string;
  titolo: string | null;
  note: string | null;
  scheda_id: string | null;
  scheda_title: string | null;
};

type ViewMode = "mese" | "settimana";

const TIPI = ["allenamento", "riposo", "gara", "test", "altro"] as const;

const TIPO_COLOR: Record<string, string> = {
  allenamento: "bg-blue-100 text-blue-800 border-blue-200",
  riposo: "bg-gray-100 text-gray-600 border-gray-200",
  gara: "bg-red-100 text-red-800 border-red-200",
  test: "bg-purple-100 text-purple-800 border-purple-200",
  altro: "bg-yellow-100 text-yellow-800 border-yellow-200",
};

const MONTHS = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];
const DAYS_SHORT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeek(d: Date): Date {
  const nd = new Date(d);
  const day = (nd.getDay() + 6) % 7; // Mon=0
  nd.setDate(nd.getDate() - day);
  nd.setHours(0, 0, 0, 0);
  return nd;
}

function addDays(d: Date, n: number): Date {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + n);
  return nd;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export const Route = createFileRoute("/coach/team/$teamId/calendario")({
  component: CalendarioPage,
});

function CalendarioPage() {
  const { teamId } = Route.useParams();
  const { loading, session, profile, role, signOut } = useAuth();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<ViewMode>("mese");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [eventi, setEventi] = useState<EventoRow[]>([]);
  const [schede, setSchede] = useState<{ id: string; title: string }[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [newEventoOpen, setNewEventoOpen] = useState(false);
  const [newEventoData, setNewEventoData] = useState({
    data: toIsoDate(new Date()),
    tipo: "allenamento",
    scheda_id: "",
    titolo: "",
    note: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/login" });
    else if (!profile?.onboarded || !role) navigate({ to: "/onboarding" });
    else if (role === "atleta") navigate({ to: "/atleta" });
  }, [loading, session, profile, role, navigate]);

  const range = useMemo(() => {
    if (viewMode === "mese") {
      const first = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const last = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      const start = startOfWeek(first);
      const end = addDays(startOfWeek(last), 6);
      return { start, end };
    }
    const start = startOfWeek(currentDate);
    return { start, end: addDays(start, 6) };
  }, [viewMode, currentDate]);

  const fetchSchede = async () => {
    const { data, error } = await supabase
      .from("schede")
      .select("id, title")
      .eq("team_id", teamId)
      .order("title");
    if (error) {
      toast.error(error.message);
      return;
    }
    setSchede(data ?? []);
  };

  const fetchEventi = async () => {
    setLoadingData(true);
    const { data, error } = await supabase
      .from("eventi_calendario")
      .select("id, data, tipo, titolo, note, scheda_id, schede(title)")
      .eq("team_id", teamId)
      .gte("data", toIsoDate(range.start))
      .lte("data", toIsoDate(range.end))
      .order("data");
    setLoadingData(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEventi(
      (data ?? []).map((e: any) => ({
        id: e.id,
        data: e.data,
        tipo: e.tipo,
        titolo: e.titolo,
        note: e.note,
        scheda_id: e.scheda_id,
        scheda_title: e.schede?.title ?? null,
      })),
    );
  };

  useEffect(() => {
    if (session?.user) fetchSchede();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user, teamId]);

  useEffect(() => {
    if (session?.user) fetchEventi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user, teamId, viewMode, currentDate]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventoRow[]>();
    for (const e of eventi) {
      const arr = map.get(e.data) ?? [];
      arr.push(e);
      map.set(e.data, arr);
    }
    return map;
  }, [eventi]);

  const openNewEvento = (date?: Date) => {
    setNewEventoData({
      data: toIsoDate(date ?? currentDate),
      tipo: "allenamento",
      scheda_id: "",
      titolo: "",
      note: "",
    });
    setNewEventoOpen(true);
  };

  const saveEvento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;
    if (!newEventoData.data) {
      toast.error("Data obbligatoria");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("eventi_calendario").insert({
      team_id: teamId,
      data: newEventoData.data,
      tipo: newEventoData.tipo,
      titolo: newEventoData.titolo.trim() || null,
      scheda_id: newEventoData.scheda_id || null,
      note: newEventoData.note.trim() || null,
      created_by: session.user.id,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Evento aggiunto");
    setNewEventoOpen(false);
    fetchEventi();
  };

  const deleteEvento = async (id: string) => {
    const { error } = await supabase.from("eventi_calendario").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Evento eliminato");
    fetchEventi();
  };

  const navigatePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === "mese") d.setMonth(d.getMonth() - 1);
    else d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };
  const navigateNext = () => {
    const d = new Date(currentDate);
    if (viewMode === "mese") d.setMonth(d.getMonth() + 1);
    else d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  const label = useMemo(() => {
    if (viewMode === "mese") {
      return `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
    const start = startOfWeek(currentDate);
    const end = addDays(start, 6);
    return `${start.getDate()} ${MONTHS[start.getMonth()].slice(0, 3)} – ${end.getDate()} ${MONTHS[end.getMonth()].slice(0, 3)} ${end.getFullYear()}`;
  }, [viewMode, currentDate]);

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
      <main className="flex-1 container mx-auto max-w-6xl px-6 py-10">
        <Link
          to="/coach/team/$teamId"
          params={{ teamId }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Squadra
        </Link>

        <div className="mt-4 flex items-end justify-between flex-wrap gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Calendario</h1>
        </div>

        <div className="mt-6 flex items-center justify-between flex-wrap gap-3">
          <div className="inline-flex rounded-full border bg-card p-1">
            <button
              onClick={() => setViewMode("mese")}
              className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
                viewMode === "mese" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mese
            </button>
            <button
              onClick={() => setViewMode("settimana")}
              className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
                viewMode === "settimana" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Settimana
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={navigatePrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[180px] text-center text-sm font-medium capitalize">{label}</div>
            <Button variant="outline" size="icon" onClick={navigateNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button onClick={() => openNewEvento(new Date())}>
            <Plus className="h-4 w-4" /> Evento
          </Button>
        </div>

        <div className="mt-6">
          {loadingData ? (
            <div className="rounded-lg border bg-card p-12 grid place-items-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : viewMode === "mese" ? (
            <MonthView
              currentDate={currentDate}
              rangeStart={range.start}
              eventsByDay={eventsByDay}
              onDayClick={openNewEvento}
              onDelete={deleteEvento}
            />
          ) : (
            <WeekView
              rangeStart={range.start}
              eventsByDay={eventsByDay}
              onDayClick={openNewEvento}
              onDelete={deleteEvento}
            />
          )}
        </div>
      </main>

      <Dialog open={newEventoOpen} onOpenChange={setNewEventoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuovo evento</DialogTitle>
            <DialogDescription>Aggiungi un evento al calendario della squadra.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveEvento} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ev-data">Data *</Label>
                <Input
                  id="ev-data"
                  type="date"
                  required
                  value={newEventoData.data}
                  onChange={(e) => setNewEventoData((p) => ({ ...p, data: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ev-tipo">Tipo</Label>
                <select
                  id="ev-tipo"
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={newEventoData.tipo}
                  onChange={(e) => setNewEventoData((p) => ({ ...p, tipo: e.target.value }))}
                >
                  {TIPI.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="ev-titolo">Titolo</Label>
                <Input
                  id="ev-titolo"
                  value={newEventoData.titolo}
                  onChange={(e) => setNewEventoData((p) => ({ ...p, titolo: e.target.value }))}
                  placeholder="es. Amichevole vs …"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="ev-scheda">Scheda collegata</Label>
                <select
                  id="ev-scheda"
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={newEventoData.scheda_id}
                  onChange={(e) => setNewEventoData((p) => ({ ...p, scheda_id: e.target.value }))}
                >
                  <option value="">Nessuna scheda</option>
                  {schede.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="ev-note">Note</Label>
                <Textarea
                  id="ev-note"
                  rows={3}
                  value={newEventoData.note}
                  onChange={(e) => setNewEventoData((p) => ({ ...p, note: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewEventoOpen(false)}>
                Annulla
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Salva
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EventoPill({
  evento,
  onDelete,
}: {
  evento: EventoRow;
  onDelete: (id: string) => void;
}) {
  const color = TIPO_COLOR[evento.tipo] ?? TIPO_COLOR.altro;
  const label = evento.titolo || evento.scheda_title || evento.tipo;
  return (
    <div
      className={`group/ev relative flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] leading-tight ${color}`}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="truncate flex-1">{label}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (confirm("Eliminare l'evento?")) onDelete(evento.id);
        }}
        className="opacity-0 group-hover/ev:opacity-100 transition-opacity shrink-0"
        aria-label="Elimina"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function MonthView({
  currentDate,
  rangeStart,
  eventsByDay,
  onDayClick,
  onDelete,
}: {
  currentDate: Date;
  rangeStart: Date;
  eventsByDay: Map<string, EventoRow[]>;
  onDayClick: (d: Date) => void;
  onDelete: (id: string) => void;
}) {
  const today = new Date();
  const currentMonth = currentDate.getMonth();
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) days.push(addDays(rangeStart, i));

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="grid grid-cols-7 border-b bg-muted/40 text-xs font-medium text-muted-foreground">
        {DAYS_SHORT.map((d) => (
          <div key={d} className="px-2 py-2 text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const iso = toIsoDate(d);
          const evs = eventsByDay.get(iso) ?? [];
          const inMonth = d.getMonth() === currentMonth;
          const isToday = sameDay(d, today);
          const visible = evs.slice(0, 3);
          const rest = evs.length - visible.length;
          return (
            <div
              key={i}
              onClick={() => onDayClick(d)}
              className={`min-h-[110px] border-b border-r p-1.5 cursor-pointer hover:bg-muted/30 transition-colors ${
                inMonth ? "" : "opacity-40"
              } ${i % 7 === 6 ? "border-r-0" : ""}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-xs font-medium ${
                    isToday
                      ? "bg-primary text-primary-foreground rounded-full h-5 w-5 grid place-items-center"
                      : ""
                  }`}
                >
                  {d.getDate()}
                </span>
                {isToday && !inMonth ? null : null}
              </div>
              <div className="space-y-0.5">
                {visible.map((e) => (
                  <EventoPill key={e.id} evento={e} onDelete={onDelete} />
                ))}
                {rest > 0 && (
                  <div className="text-[10px] text-muted-foreground px-1">+ {rest} altri</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({
  rangeStart,
  eventsByDay,
  onDayClick,
  onDelete,
}: {
  rangeStart: Date;
  eventsByDay: Map<string, EventoRow[]>;
  onDayClick: (d: Date) => void;
  onDelete: (id: string) => void;
}) {
  const today = new Date();
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) days.push(addDays(rangeStart, i));
  const fasce = ["Mattina", "Pomeriggio", "Sera"] as const;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="grid grid-cols-[80px_repeat(7,minmax(0,1fr))] border-b bg-muted/40 text-xs font-medium text-muted-foreground">
        <div className="px-2 py-2" />
        {days.map((d, i) => {
          const isToday = sameDay(d, today);
          return (
            <div key={i} className="px-2 py-2 text-center">
              <div>{DAYS_SHORT[i]}</div>
              <div
                className={`mt-0.5 text-sm ${
                  isToday ? "text-primary font-semibold" : "text-foreground"
                }`}
              >
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>
      {fasce.map((fascia) => (
        <div
          key={fascia}
          className="grid grid-cols-[80px_repeat(7,minmax(0,1fr))] border-b last:border-b-0"
        >
          <div className="px-2 py-3 text-xs text-muted-foreground border-r bg-muted/20 flex items-start">
            {fascia}
          </div>
          {days.map((d, i) => {
            const iso = toIsoDate(d);
            const evs = fascia === "Mattina" ? eventsByDay.get(iso) ?? [] : [];
            return (
              <div
                key={i}
                onClick={() => onDayClick(d)}
                className={`min-h-[90px] border-r last:border-r-0 p-1.5 cursor-pointer hover:bg-muted/30 transition-colors space-y-1`}
              >
                {evs.map((e) => (
                  <EventoPill key={e.id} evento={e} onDelete={onDelete} />
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}