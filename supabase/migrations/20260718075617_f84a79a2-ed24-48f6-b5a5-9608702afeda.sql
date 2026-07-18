DROP TRIGGER IF EXISTS trg_link_placeholder ON public.team_members;

DROP FUNCTION IF EXISTS public.link_placeholder_on_join();

CREATE OR REPLACE FUNCTION private.link_placeholder_on_join()
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
FOR EACH ROW EXECUTE FUNCTION private.link_placeholder_on_join();

REVOKE ALL ON FUNCTION private.link_placeholder_on_join() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.link_placeholder_on_join() FROM authenticated;
REVOKE ALL ON FUNCTION private.link_placeholder_on_join() FROM anon;

GRANT EXECUTE ON FUNCTION private.link_placeholder_on_join() TO postgres;
GRANT EXECUTE ON FUNCTION private.link_placeholder_on_join() TO service_role;