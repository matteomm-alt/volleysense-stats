
-- tipi_test
CREATE TABLE public.tipi_test (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  unit text NOT NULL,
  higher_is_better boolean NOT NULL DEFAULT true,
  esercizio_id uuid REFERENCES public.esercizi_catalogo(id) ON DELETE SET NULL,
  is_public boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tipi_test TO authenticated;
GRANT ALL ON public.tipi_test TO service_role;
ALTER TABLE public.tipi_test ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tipi test: read public or own" ON public.tipi_test FOR SELECT
  USING (is_public = true OR auth.uid() = created_by OR private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Tipi test: coach insert" ON public.tipi_test FOR INSERT
  WITH CHECK (private.has_role(auth.uid(), 'coach'::app_role) OR private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Tipi test: creator updates own" ON public.tipi_test FOR UPDATE
  USING (auth.uid() = created_by OR private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Tipi test: creator deletes own" ON public.tipi_test FOR DELETE
  USING (auth.uid() = created_by OR private.has_role(auth.uid(), 'admin'::app_role));

-- Seed public test types
INSERT INTO public.tipi_test (name, category, unit, higher_is_better, is_public) VALUES
  ('Squat 1RM', 'Forza', 'kg', true, true),
  ('Panca Piana 1RM', 'Forza', 'kg', true, true),
  ('Stacco 1RM', 'Forza', 'kg', true, true),
  ('Salto Verticale CMJ', 'Potenza', 'cm', true, true),
  ('Salto in Lungo da Fermo', 'Potenza', 'cm', true, true),
  ('Sprint 20m', 'Velocità', 'sec', false, true),
  ('T-Test Agilità', 'Agilità', 'sec', false, true),
  ('Yo-Yo IR1', 'Resistenza', 'm', true, true);

-- test_risultati
CREATE TABLE public.test_risultati (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  athlete_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  placeholder_id uuid REFERENCES public.atleti_placeholder(id) ON DELETE SET NULL,
  tipo_test_id uuid NOT NULL REFERENCES public.tipi_test(id) ON DELETE RESTRICT,
  value numeric NOT NULL,
  tested_at date NOT NULL DEFAULT current_date,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT test_risultati_target_check CHECK (
    (athlete_id IS NOT NULL AND placeholder_id IS NULL) OR
    (athlete_id IS NULL AND placeholder_id IS NOT NULL)
  )
);
CREATE INDEX idx_test_risultati_team ON public.test_risultati(team_id);
CREATE INDEX idx_test_risultati_athlete ON public.test_risultati(athlete_id);
CREATE INDEX idx_test_risultati_placeholder ON public.test_risultati(placeholder_id);
CREATE INDEX idx_test_risultati_tipo ON public.test_risultati(tipo_test_id);
CREATE INDEX idx_test_risultati_tested_at ON public.test_risultati(tested_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_risultati TO authenticated;
GRANT ALL ON public.test_risultati TO service_role;
ALTER TABLE public.test_risultati ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Test risultati: coach manage team" ON public.test_risultati FOR ALL
  USING (private.is_team_coach(auth.uid(), team_id) OR private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.is_team_coach(auth.uid(), team_id) OR private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Test risultati: athlete reads own" ON public.test_risultati FOR SELECT
  USING (auth.uid() = athlete_id);

-- Extend link_placeholder_on_join to migrate test results too
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

      UPDATE public.test_risultati
         SET athlete_id = NEW.athlete_id,
             placeholder_id = NULL
       WHERE placeholder_id = ANY(_linked_ids);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
