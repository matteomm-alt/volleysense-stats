
-- 1. Fix teams_invite_code_public_exposure: drop overly permissive SELECT policy.
-- Athletes join via join_team_with_code RPC (SECURITY DEFINER) so no public SELECT is needed.
DROP POLICY IF EXISTS "Authenticated can lookup team by code" ON public.teams;

-- 2. Fix user_roles_self_insert: restrict self-insert to 'atleta' only.
DROP POLICY IF EXISTS "Roles: users insert own (signup)" ON public.user_roles;
CREATE POLICY "Roles: users self-insert atleta only"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND role = 'atleta'::app_role);

-- 3. Fix SECURITY DEFINER function EXECUTE exposure.
-- These helpers are used inside RLS policies / triggers; they don't need to be
-- callable directly from the Data API. Revoke EXECUTE from anon and authenticated.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_team_coach(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_team_member_direct(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.coach_owns_athlete(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.scheda_team_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.session_athlete_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.session_team_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.infortunio_athlete_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_invite_code() FROM PUBLIC, anon, authenticated;

-- Keep join_team_with_code callable by authenticated users — it is the intended RPC entrypoint.
REVOKE EXECUTE ON FUNCTION public.join_team_with_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_team_with_code(text) TO authenticated;
