-- Template schede personali del coach
CREATE TABLE public.schede_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  scheda_type text,
  category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_schede_template_coach ON public.schede_template(coach_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schede_template TO authenticated;
GRANT ALL ON public.schede_template TO service_role;

ALTER TABLE public.schede_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach owns templates select" ON public.schede_template
  FOR SELECT TO authenticated USING (coach_id = auth.uid());
CREATE POLICY "coach owns templates insert" ON public.schede_template
  FOR INSERT TO authenticated WITH CHECK (coach_id = auth.uid() AND private.has_role(auth.uid(), 'coach'));
CREATE POLICY "coach owns templates update" ON public.schede_template
  FOR UPDATE TO authenticated USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());
CREATE POLICY "coach owns templates delete" ON public.schede_template
  FOR DELETE TO authenticated USING (coach_id = auth.uid());

CREATE TRIGGER trg_schede_template_updated
  BEFORE UPDATE ON public.schede_template
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Righe esercizi del template
CREATE TABLE public.schede_template_esercizi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.schede_template(id) ON DELETE CASCADE,
  esercizio_id uuid REFERENCES public.esercizi_catalogo(id) ON DELETE SET NULL,
  order_index integer NOT NULL DEFAULT 0,
  sets integer,
  reps text,
  load_value numeric,
  load_unit text,
  rpe_target numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_template_esercizi_template ON public.schede_template_esercizi(template_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schede_template_esercizi TO authenticated;
GRANT ALL ON public.schede_template_esercizi TO service_role;

ALTER TABLE public.schede_template_esercizi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "template esercizi via owner select" ON public.schede_template_esercizi
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.schede_template t WHERE t.id = template_id AND t.coach_id = auth.uid())
  );
CREATE POLICY "template esercizi via owner insert" ON public.schede_template_esercizi
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.schede_template t WHERE t.id = template_id AND t.coach_id = auth.uid())
  );
CREATE POLICY "template esercizi via owner update" ON public.schede_template_esercizi
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.schede_template t WHERE t.id = template_id AND t.coach_id = auth.uid())
  );
CREATE POLICY "template esercizi via owner delete" ON public.schede_template_esercizi
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.schede_template t WHERE t.id = template_id AND t.coach_id = auth.uid())
  );