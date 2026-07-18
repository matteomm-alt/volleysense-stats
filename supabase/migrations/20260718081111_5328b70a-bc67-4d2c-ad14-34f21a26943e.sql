CREATE OR REPLACE FUNCTION public.join_team_with_code(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _team_id uuid;
  _user_id uuid := auth.uid();
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

REVOKE ALL ON FUNCTION public.join_team_with_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_team_with_code(text) TO authenticated;