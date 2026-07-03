
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member_direct(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_coach(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.coach_owns_athlete(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.session_athlete_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.session_team_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.infortunio_athlete_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.scheda_team_id(uuid) TO authenticated;
