-- Security definer function that bypasses RLS to check membership directly
CREATE OR REPLACE FUNCTION public.is_team_member_direct(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id AND athlete_id = _user_id
  )
$$;

-- Replace the recursive policy on teams
DROP POLICY IF EXISTS "Teams: athletes view their teams" ON public.teams;
CREATE POLICY "Teams: athletes view their teams"
ON public.teams
FOR SELECT
USING (public.is_team_member_direct(auth.uid(), id));

-- Replace the recursive policy on team_members
DROP POLICY IF EXISTS "TeamMembers: athlete views teammates" ON public.team_members;
CREATE POLICY "TeamMembers: athlete views teammates"
ON public.team_members
FOR SELECT
USING (public.is_team_member_direct(auth.uid(), team_id));