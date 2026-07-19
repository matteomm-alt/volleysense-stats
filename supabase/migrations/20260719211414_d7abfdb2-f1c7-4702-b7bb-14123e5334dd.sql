
ALTER TABLE public.schede
  ADD COLUMN IF NOT EXISTS placeholder_id uuid REFERENCES public.atleti_placeholder(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS schede_placeholder_id_idx ON public.schede(placeholder_id);

CREATE OR REPLACE FUNCTION private.link_placeholder_on_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _email text;
  _linked_ids uuid[];
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = NEW.athlete_id;
  IF _email IS NOT NULL THEN
    WITH upd AS (
      UPDATE public.atleti_placeholder
         SET linked_athlete_id = NEW.athlete_id,
             linked_at = now()
       WHERE team_id = NEW.team_id
         AND lower(email) = lower(_email)
         AND linked_athlete_id IS NULL
      RETURNING id
    )
    SELECT array_agg(id) INTO _linked_ids FROM upd;

    IF _linked_ids IS NOT NULL AND array_length(_linked_ids, 1) > 0 THEN
      UPDATE public.schede
         SET athlete_id = NEW.athlete_id,
             placeholder_id = NULL
       WHERE placeholder_id = ANY(_linked_ids);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
