import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  ChevronLeft,
  BookMarked,
  Trash2,
  Pencil,
  Search,
  Plus,
  Dumbbell,
} from "lucide-react";
import { toast } from "sonner";

type Template = {
  id: string;
  name: string;
  description: string | null;
  scheda_type: string | null;
  category: string | null;
  updated_at: string;
  count: number;
};

type TemplateRow = {
  id: string;
  order_index: number;
  sets: number | null;
  reps: string | null;
  load_value: number | null;
  load_unit: string | null;
  rpe_target: number | null;
  notes: string | null;
  esercizio_id: string | null;
  esercizio_name?: string | null;
};

export const Route = createFileRoute("/coach/templates")({
  component: TemplatesPage,
});

function TemplatesPage() {
  const { loading, session, profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Template | null>(null);
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [renaming, setRenaming] = useState<Template | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameDesc, setRenameDesc] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/login" });
    else if (!profile?.onboarded || !role) navigate({ to: "/onboarding" });
    else if (role === "atleta") navigate({ to: "/atleta" });
  }, [loading, session, profile, role, navigate]);

  const fetchTemplates = useCallback(async () => {
    if (!session?.user) return;
    setLoadingData(true);
    const { data: tpls, error } = await supabase
      .from("schede_template")
      .select("id, name, description, scheda_type, category, updated_at")
      .eq("coach_id", session.user.id)
      .order("updated_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoadingData(false);
      return;
    }
    const ids = (tpls ?? []).map((t) => t.id);
    const counts = new Map<string, number>();
    if (ids.length) {
      const { data: exRows } = await supabase
        .from("schede_template_esercizi")
        .select("template_id")
        .in("template_id", ids);
      (exRows ?? []).forEach((r) =>
        counts.set(r.template_id, (counts.get(r.template_id) ?? 0) + 1),
      );
    }
    setTemplates((tpls ?? []).map((t) => ({ ...t, count: counts.get(t.id) ?? 0 })));
    setLoadingData(false);
  }, [session?.user]);

  useEffect(() => {
    if (session?.user) fetchTemplates();
  }, [session?.user, fetchTemplates]);

  const openDetail = async (t: Template) => {
    setSelected(t);
    setLoadingDetail(true);
    const { data: rowsData, error } = await supabase
      .from("schede_template_esercizi")
      .select("*")
      .eq("template_id", t.id)
      .order("order_index");
    if (error) {
      toast.error(error.message);
      setLoadingDetail(false);
      return;
    }
    const ids = (rowsData ?? []).map((r) => r.esercizio_id).filter(Boolean) as string[];
    const nameMap = new Map<string, string>();
    if (ids.length) {
      const { data: ex } = await supabase
        .from("esercizi_catalogo")
        .select("id, name")
        .in("id", ids);
      (ex ?? []).forEach((e) => nameMap.set(e.id, e.name));
    }
    setRows(
      (rowsData ?? []).map((r) => ({
        ...r,
        esercizio_name: r.esercizio_id ? nameMap.get(r.esercizio_id) ?? "Esercizio" : "Esercizio",
      })),
    );
    setLoadingDetail(false);
  };

  const handleDelete = async (t: Template) => {
    if (!confirm(`Eliminare il template "${t.name}"?`)) return;
    const { error } = await supabase.from("schede_template").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Template eliminato");
    if (selected?.id === t.id) {
      setSelected(null);
      setRows([]);
    }
    fetchTemplates();
  };

  const startRename = (t: Template) => {
    setRenaming(t);
    setRenameName(t.name);
    setRenameDesc(t.description ?? "");
  };

  const saveRename = async () => {
    if (!renaming) return;
    if (!renameName.trim()) {
      toast.error("Nome obbligatorio");
      return;
    }
    const { error } = await supabase
      .from("schede_template")
      .update({
        name: renameName.trim(),
        description: renameDesc.trim() || null,
      })
      .eq("id", renaming.id);
    if (error) return toast.error(error.message);
    toast.success("Template aggiornato");
    setRenaming(null);
    fetchTemplates();
    if (selected?.id === renaming.id) {
      setSelected({ ...selected, name: renameName.trim(), description: renameDesc.trim() || null });
    }
  };

  const filtered = templates.filter((t) =>
    t.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

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
          to="/coach"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Dashboard
        </Link>

        <div className="mt-4 flex items-end justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Libreria</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Template schede</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Salva schede riutilizzabili e applicale a nuove sedute o settimane tipo.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <section>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cerca template..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {loadingData ? (
              <div className="rounded-lg border bg-card p-8 grid place-items-center">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center">
                <div className="mx-auto h-12 w-12 grid place-items-center rounded-full bg-secondary">
                  <BookMarked className="h-5 w-5 text-muted-foreground" />
                </div>
                <h3 className="mt-4 font-semibold text-sm">Nessun template</h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-xs mx-auto">
                  Apri una scheda e usa "Salva come template" per iniziare la tua libreria.
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
                Nessun risultato per "{search}"
              </div>
            ) : (
              <div className="rounded-lg border bg-card divide-y overflow-hidden">
                {filtered.map((t) => (
                  <div
                    key={t.id}
                    className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3 transition-colors ${
                      selected?.id === t.id ? "bg-primary/5" : "hover:bg-muted/40"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => openDetail(t)}
                      className="min-w-0 text-left"
                    >
                      <div className="truncate text-sm font-medium">{t.name}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="font-mono">{t.count} esercizi</span>
                        {t.scheda_type && <span>· {t.scheda_type}</span>}
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startRename(t)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Rinomina"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(t)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Elimina"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            {!selected ? (
              <div className="rounded-lg border border-dashed bg-muted/20 p-10 text-center">
                <div className="mx-auto h-12 w-12 grid place-items-center rounded-full bg-secondary">
                  <BookMarked className="h-5 w-5 text-muted-foreground" />
                </div>
                <h3 className="mt-4 font-semibold text-sm">Seleziona un template</h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                  Clicca su un template a sinistra per vederne gli esercizi.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border bg-card">
                <div className="border-b p-5">
                  <h2 className="font-semibold">{selected.name}</h2>
                  {selected.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{selected.description}</p>
                  )}
                  <div className="mt-2 text-xs text-muted-foreground">
                    Aggiornato {new Date(selected.updated_at).toLocaleDateString("it")}
                  </div>
                </div>
                {loadingDetail ? (
                  <div className="p-8 grid place-items-center">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : rows.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    <Dumbbell className="mx-auto h-8 w-8 opacity-40" />
                    <div className="mt-2">Nessun esercizio nel template</div>
                  </div>
                ) : (
                  <ol className="divide-y">
                    {rows.map((r, idx) => (
                      <li key={r.id} className="flex items-start gap-3 px-5 py-3">
                        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-xs">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium">{r.esercizio_name}</div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {r.sets != null && r.reps && <span>{r.sets} × {r.reps}</span>}
                            {r.load_value != null && (
                              <span>{r.load_value} {r.load_unit ?? "kg"}</span>
                            )}
                            {r.rpe_target != null && <span>RPE {r.rpe_target}</span>}
                            {r.notes && <span className="italic">{r.notes}</span>}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
                <div className="border-t p-4 text-xs text-muted-foreground">
                  Per applicare questo template a una scheda, apri la scheda dal periodo e usa "Applica template".
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      <Dialog open={!!renaming} onOpenChange={(o) => { if (!o) setRenaming(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rinomina template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={renameName} onChange={(e) => setRenameName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Descrizione</Label>
              <Textarea rows={3} value={renameDesc} onChange={(e) => setRenameDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenaming(null)}>Annulla</Button>
            <Button onClick={saveRename}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}