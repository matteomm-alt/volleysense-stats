
-- 1) Scope coach access to profiles
DROP POLICY IF EXISTS "Profiles: coaches read all" ON public.profiles;

CREATE POLICY "Profiles: coaches read team athletes"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'coach')
    AND public.coach_owns_athlete(auth.uid(), profiles.id)
  )
);

-- 2) Revoke EXECUTE on trigger-only SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_owner_to_team_coaches() FROM PUBLIC, anon, authenticated;
