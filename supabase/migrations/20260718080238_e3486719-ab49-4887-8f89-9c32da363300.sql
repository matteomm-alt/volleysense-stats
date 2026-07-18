
-- Move join_team_with_code to private schema to remove PostgREST exposure
DROP FUNCTION IF EXISTS public.join_team_with_code(text);

CREATE OR REPLACE FUNCTION private.join_team_with_code(_user_id uuid, _code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _team_id uuid;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT private.has_role(_user_id, 'atleta') THEN RAISE EXCEPTION 'not_athlete'; END IF;
  SELECT id INTO _team_id FROM public.teams WHERE invite_code = upper(_code);
  IF _team_id IS NULL THEN RAISE EXCEPTION 'invalid_code'; END IF;
  INSERT INTO public.team_members (team_id, athlete_id) VALUES (_team_id, _user_id)
  ON CONFLICT DO NOTHING;
  RETURN _team_id;
END;
$$;

REVOKE ALL ON FUNCTION private.join_team_with_code(uuid, text) FROM PUBLIC, anon, authenticated;
ALTER FUNCTION private.join_team_with_code(uuid, text) OWNER TO postgres;

-- Ensure trigger functions in public are not exposed to signed-in users
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_owner_to_team_coaches() FROM PUBLIC, anon, authenticated;
