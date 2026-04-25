-- Add invite_code to teams
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS invite_code text;

-- Generate codes for any existing rows
UPDATE public.teams
SET invite_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
WHERE invite_code IS NULL;

ALTER TABLE public.teams
  ALTER COLUMN invite_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS teams_invite_code_idx ON public.teams (invite_code);

-- Function to generate a default code
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  code text;
  done boolean := false;
BEGIN
  WHILE NOT done LOOP
    code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    IF NOT EXISTS (SELECT 1 FROM public.teams WHERE invite_code = code) THEN
      done := true;
    END IF;
  END LOOP;
  RETURN code;
END;
$$;

ALTER TABLE public.teams
  ALTER COLUMN invite_code SET DEFAULT public.generate_invite_code();

-- Allow any authenticated user to read a team by code (lookup before joining)
DROP POLICY IF EXISTS "Authenticated can lookup team by code" ON public.teams;
CREATE POLICY "Authenticated can lookup team by code"
ON public.teams
FOR SELECT
TO authenticated
USING (true);

-- Function: athlete joins a team via code
CREATE OR REPLACE FUNCTION public.join_team_with_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _team_id uuid;
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.has_role(_user_id, 'atleta') THEN
    RAISE EXCEPTION 'not_athlete';
  END IF;

  SELECT id INTO _team_id FROM public.teams WHERE invite_code = upper(_code);

  IF _team_id IS NULL THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;

  INSERT INTO public.team_members (team_id, athlete_id)
  VALUES (_team_id, _user_id)
  ON CONFLICT DO NOTHING;

  RETURN _team_id;
END;
$$;

-- Ensure a member can only appear once per team
CREATE UNIQUE INDEX IF NOT EXISTS team_members_unique_idx
  ON public.team_members (team_id, athlete_id);