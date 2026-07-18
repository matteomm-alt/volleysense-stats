
ALTER TABLE public.schede
  ADD COLUMN IF NOT EXISTS settimana_id uuid REFERENCES public.settimane(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS day_label text,
  ADD COLUMN IF NOT EXISTS day_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scheda_type text;

CREATE INDEX IF NOT EXISTS schede_settimana_idx ON public.schede(settimana_id);
