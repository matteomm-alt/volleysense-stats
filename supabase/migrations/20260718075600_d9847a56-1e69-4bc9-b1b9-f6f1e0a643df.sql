CREATE TABLE public.atleti_placeholder (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  phone text,
  birth_date date,
  notes text,
  linked_athlete_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  linked_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atleti_placeholder TO authenticated;
GRANT ALL ON public.atleti_placeholder TO service_role;

CREATE INDEX idx_placeholder_team ON public.atleti_placeholder(team_id);
CREATE INDEX idx_placeholder_email ON public.atleti_placeholder(email);
CREATE INDEX idx_placeholder_linked ON public.atleti_placeholder(linked_athlete_id);

ALTER TABLE public.atleti_placeholder ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Placeholder: coach manages"
ON public.atleti_placeholder FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_coaches tc
    WHERE tc.team_id = atleti_placeholder.team_id
    AND tc.coach_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.team_coaches tc
    WHERE tc.team_id = atleti_placeholder.team_id
    AND tc.coach_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.link_placeholder_on_join()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _email text;
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = NEW.athlete_id;
  IF _email IS NOT NULL THEN
    UPDATE public.atleti_placeholder
    SET linked_athlete_id = NEW.athlete_id, linked_at = now()
    WHERE team_id = NEW.team_id
    AND lower(email) = lower(_email)
    AND linked_athlete_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_link_placeholder
AFTER INSERT ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.link_placeholder_on_join();