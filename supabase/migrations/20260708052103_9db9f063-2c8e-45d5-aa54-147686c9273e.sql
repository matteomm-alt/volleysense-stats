
-- Backfill team_coaches with team owners
INSERT INTO public.team_coaches (team_id, coach_id)
SELECT id, owner_coach_id FROM public.teams
WHERE owner_coach_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Trigger to auto-add owner to team_coaches on team creation
CREATE OR REPLACE FUNCTION public.add_owner_to_team_coaches()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_coach_id IS NOT NULL THEN
    INSERT INTO public.team_coaches (team_id, coach_id)
    VALUES (NEW.id, NEW.owner_coach_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_add_owner_to_team_coaches ON public.teams;
CREATE TRIGGER trg_add_owner_to_team_coaches
AFTER INSERT ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.add_owner_to_team_coaches();
