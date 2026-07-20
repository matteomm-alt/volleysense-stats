import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Loader2, BookMarked, Layers } from "lucide-react";
import { toast } from "sonner";

type SchedaRow = {
  id: string;
  order_index: number;
  sets: number | null;
  reps: string | null;
  load_value: number | null;
  load_unit: string | null;
  rpe_target: number | null;
  notes: string | null;
  esercizio_id: string | null;
};

// ─── Salva scheda corrente come template ────────────────────────────────
export function SaveAsTemplateDialog({
  open,
  onOpenChange,
  schedaId,
  coachId,
  defaultName,
  defaultDescription,
  defaultType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedaId: string;
  coachId: string;
  defaultName: string;
  defaultDescription?: string | null;
  defaultType?: string | null;
}) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState(defaultDescription ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(defaultName);
      setDescription(defaultDescription ?? "");
    }
  }, [open, defaultName, defaultDescription]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Nome obbligatorio");
      return;
    }
    setSaving(true);
    try {
      const { data: tpl, error: e1 } = await supabase
        .from("schede_template")
        .insert({
          coach_id: coachId,
          name: name.trim(),
          description: description.trim() || null,
          scheda_type: defaultType ?? null,
        })
        .select("id")
        .single();
      if (e1) throw e1;

      const { data: rows, error: e2 } = await supabase
        .from("scheda_esercizi")
        .select("esercizio_id, order_index, sets, reps, load_value, load_unit, rpe_target, notes")
        .eq("scheda_id", schedaId);
      if (e2) throw e2;

      if (rows && rows.length > 0) {
        const toInsert = rows.map((r) => ({ ...r, template_id: tpl.id }));
        const { error: e3 } = await supabase
          .from("schede_template_esercizi")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .insert(toInsert as any);
        if (e3) throw e3;
      }
      toast.success(`Template "${name.trim()}" salvato`);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookMarked className="h-4 w-4" /> Salva come template
          </DialogTitle>
          <DialogDescription>
            Il template verrà salvato nella tua libreria personale e potrai riutilizzarlo in altre schede.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Descrizione</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Note opzionali sull'uso di questo template"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salva template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Applica template a scheda corrente ────────────────────────────────
export function ApplyTemplateDialog({
  open,
  onOpenChange,
  schedaId,
  coachId,
  currentRowsCount,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedaId: string;
  coachId: string;
  currentRowsCount: number;
  onApplied: () => void;
}) {
  const [templates, setTemplates] = useState<
    { id: string; name: string; description: string | null; count: number }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [applying, setApplying] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const { data: tpls, error } = await supabase
        .from("schede_template")
        .select("id, name, description")
        .eq("coach_id", coachId)
        .order("updated_at", { ascending: false });
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
      const ids = (tpls ?? []).map((t) => t.id);
      const counts = new Map<string, number>();
      if (ids.length) {
        const { data: rows } = await supabase
          .from("schede_template_esercizi")
          .select("template_id")
          .in("template_id", ids);
        (rows ?? []).forEach((r) =>
          counts.set(r.template_id, (counts.get(r.template_id) ?? 0) + 1),
        );
      }
      setTemplates(
        (tpls ?? []).map((t) => ({ ...t, count: counts.get(t.id) ?? 0 })),
      );
      setLoading(false);
    })();
  }, [open, coachId]);

  const filtered = templates.filter((t) =>
    t.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const handleApply = async () => {
    if (!selectedId) return;
    setApplying(true);
    try {
      if (mode === "replace" && currentRowsCount > 0) {
        const { error: eDel } = await supabase
          .from("scheda_esercizi")
          .delete()
          .eq("scheda_id", schedaId);
        if (eDel) throw eDel;
      }
      const { data: tplRows, error: eR } = await supabase
        .from("schede_template_esercizi")
        .select("esercizio_id, order_index, sets, reps, load_value, load_unit, rpe_target, notes")
        .eq("template_id", selectedId)
        .order("order_index");
      if (eR) throw eR;

      const baseOrder = mode === "replace" ? 0 : currentRowsCount;
      const toInsert = (tplRows ?? []).map((r, i) => ({
        ...r,
        scheda_id: schedaId,
        order_index: baseOrder + i,
      }));
      if (toInsert.length > 0) {
        const { error: eIns } = await supabase
          .from("scheda_esercizi")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .insert(toInsert as any);
        if (eIns) throw eIns;
      }
      toast.success(`Template applicato (${toInsert.length} esercizi)`);
      onOpenChange(false);
      onApplied();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4" /> Applica template
          </DialogTitle>
          <DialogDescription>
            Copia gli esercizi di un template nella scheda corrente.
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Cerca template…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="max-h-72 divide-y overflow-y-auto rounded-md border">
          {loading ? (
            <div className="p-6 text-center">
              <Loader2 className="inline h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {templates.length === 0
                ? "Nessun template salvato. Salva prima una scheda come template."
                : "Nessun risultato"}
            </div>
          ) : (
            filtered.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={`w-full px-4 py-3 text-left transition-colors ${
                  selectedId === t.id ? "bg-primary/10" : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{t.name}</div>
                    {t.description && (
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {t.description}
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-mono text-secondary-foreground">
                    {t.count} ex
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        {currentRowsCount > 0 && (
          <div className="space-y-2 rounded-md bg-muted/40 p-3 text-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Modalità
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                checked={mode === "append"}
                onChange={() => setMode("append")}
                className="mt-1"
              />
              <div>
                <div className="font-medium">Aggiungi in coda</div>
                <div className="text-xs text-muted-foreground">
                  Mantiene i {currentRowsCount} esercizi attuali
                </div>
              </div>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                checked={mode === "replace"}
                onChange={() => setMode("replace")}
                className="mt-1"
              />
              <div>
                <div className="font-medium text-destructive">Sostituisci tutto</div>
                <div className="text-xs text-muted-foreground">
                  Elimina gli esercizi attuali
                </div>
              </div>
            </label>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleApply} disabled={!selectedId || applying}>
            {applying && <Loader2 className="h-4 w-4 animate-spin" />}
            Applica
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { SchedaRow };