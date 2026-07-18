
CREATE TABLE public.settimane (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id uuid NOT NULL REFERENCES public.periodi(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  week_number integer NOT NULL DEFAULT 0,
  is_template boolean NOT NULL DEFAULT false,
  load_increment_pct numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (periodo_id, week_number, is_template)
);

CREATE INDEX settimane_periodo_idx ON public.settimane(periodo_id);
CREATE INDEX settimane_team_idx ON public.settimane(team_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.settimane TO authenticated;
GRANT ALL ON public.settimane TO service_role;

ALTER TABLE public.settimane ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Settimane: coach manages" ON public.settimane FOR ALL TO authenticated
  USING (private.is_team_coach(auth.uid(), team_id))
  WITH CHECK (private.is_team_coach(auth.uid(), team_id));

CREATE POLICY "Settimane: athlete views team" ON public.settimane FOR SELECT TO authenticated
  USING (private.is_team_member(auth.uid(), team_id));

CREATE POLICY "Settimane: admins all" ON public.settimane FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

CREATE TRIGGER settimane_set_updated_at
  BEFORE UPDATE ON public.settimane
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
