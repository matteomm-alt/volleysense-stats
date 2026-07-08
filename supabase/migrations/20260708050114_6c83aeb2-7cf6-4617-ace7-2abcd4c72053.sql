CREATE POLICY "coaches_can_insert_periodi"
ON public.periodi
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.team_coaches
    WHERE team_coaches.team_id = periodi.team_id
    AND team_coaches.coach_id = auth.uid()
  )
);

CREATE POLICY "coaches_can_read_periodi"
ON public.periodi
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_coaches
    WHERE team_coaches.team_id = periodi.team_id
    AND team_coaches.coach_id = auth.uid()
  )
);

CREATE POLICY "coaches_can_delete_periodi"
ON public.periodi
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_coaches
    WHERE team_coaches.team_id = periodi.team_id
    AND team_coaches.coach_id = auth.uid()
  )
);