CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
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