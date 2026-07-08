
ALTER TABLE public.schede
ADD COLUMN IF NOT EXISTS athlete_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_schede_athlete_id ON public.schede(athlete_id);
