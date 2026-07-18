CREATE TABLE public.eventi_calendario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  scheda_id uuid REFERENCES public.schede(id) ON DELETE SET NULL,
  data date NOT NULL,
  tipo text NOT NULL DEFAULT 'allenamento' CHECK (tipo IN ('allenamento','riposo','gara','test','altro')),
  titolo text,
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.eventi_calendario TO authenticated;
GRANT ALL ON public.eventi_calendario TO service_role;

CREATE INDEX idx_eventi_team ON public.eventi_calendario(team_id);
CREATE INDEX idx_eventi_data ON public.eventi_calendario(data);
CREATE INDEX idx_eventi_scheda ON public.eventi_calendario(scheda_id);

ALTER TABLE public.eventi_calendario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach manages eventi"
ON public.eventi_calendario FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_coaches tc
    WHERE tc.team_id = eventi_calendario.team_id
    AND tc.coach_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.team_coaches tc
    WHERE tc.team_id = eventi_calendario.team_id
    AND tc.coach_id = auth.uid()
  )
);

CREATE POLICY "Atleti read eventi"
ON public.eventi_calendario FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = eventi_calendario.team_id
    AND tm.athlete_id = auth.uid()
  )
);