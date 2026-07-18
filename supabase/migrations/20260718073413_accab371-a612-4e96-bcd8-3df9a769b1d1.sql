
-- 1) Private schema for internal RLS helpers
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, anon, service_role;

-- 2) Recreate helper functions in private schema
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION private.get_user_role(_user_id uuid)
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'coach' THEN 2 WHEN 'atleta' THEN 3 END
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.is_team_coach(_user_id uuid, _team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_coaches WHERE team_id = _team_id AND coach_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION private.is_team_member(_user_id uuid, _team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = _team_id AND athlete_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION private.is_team_member_direct(_user_id uuid, _team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = _team_id AND athlete_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION private.coach_owns_athlete(_coach_id uuid, _athlete_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
    WHERE tm.athlete_id = _athlete_id
      AND (t.owner_coach_id = _coach_id OR EXISTS (
        SELECT 1 FROM public.team_coaches tc WHERE tc.team_id = t.id AND tc.coach_id = _coach_id
      ))
  )
$$;

CREATE OR REPLACE FUNCTION private.session_athlete_id(_session_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT athlete_id FROM public.sessions WHERE id = _session_id
$$;

CREATE OR REPLACE FUNCTION private.session_team_id(_session_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT team_id FROM public.sessions WHERE id = _session_id
$$;

CREATE OR REPLACE FUNCTION private.scheda_team_id(_scheda_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT team_id FROM public.schede WHERE id = _scheda_id
$$;

CREATE OR REPLACE FUNCTION private.infortunio_athlete_id(_infortunio_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT athlete_id FROM public.infortuni WHERE id = _infortunio_id
$$;

-- Lock down and grant EXECUTE only to authenticated (needed for policy evaluation)
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated, service_role;

-- 3) Recreate all policies that referenced public helpers, now pointing to private.*
-- user_roles
DROP POLICY IF EXISTS "Roles: admins manage" ON public.user_roles;
CREATE POLICY "Roles: admins manage" ON public.user_roles FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- teams
DROP POLICY IF EXISTS "Teams: admins all" ON public.teams;
CREATE POLICY "Teams: admins all" ON public.teams FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Teams: assistant coaches view" ON public.teams;
CREATE POLICY "Teams: assistant coaches view" ON public.teams FOR SELECT TO authenticated
  USING (private.is_team_coach(auth.uid(), id));
DROP POLICY IF EXISTS "Teams: athletes view their teams" ON public.teams;
CREATE POLICY "Teams: athletes view their teams" ON public.teams FOR SELECT TO authenticated
  USING (private.is_team_member_direct(auth.uid(), id));

-- team_members
DROP POLICY IF EXISTS "TeamMembers: coach manages" ON public.team_members;
CREATE POLICY "TeamMembers: coach manages" ON public.team_members FOR ALL TO authenticated
  USING (private.is_team_coach(auth.uid(), team_id))
  WITH CHECK (private.is_team_coach(auth.uid(), team_id));
DROP POLICY IF EXISTS "TeamMembers: admins all" ON public.team_members;
CREATE POLICY "TeamMembers: admins all" ON public.team_members FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "TeamMembers: athlete views teammates" ON public.team_members;
CREATE POLICY "TeamMembers: athlete views teammates" ON public.team_members FOR SELECT TO authenticated
  USING (private.is_team_member_direct(auth.uid(), team_id));

-- team_coaches
DROP POLICY IF EXISTS "TeamCoaches: admins all" ON public.team_coaches;
CREATE POLICY "TeamCoaches: admins all" ON public.team_coaches FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- periodi
DROP POLICY IF EXISTS "Periodi: coach manages" ON public.periodi;
CREATE POLICY "Periodi: coach manages" ON public.periodi FOR ALL TO authenticated
  USING (private.is_team_coach(auth.uid(), team_id))
  WITH CHECK (private.is_team_coach(auth.uid(), team_id));
DROP POLICY IF EXISTS "Periodi: athlete views team" ON public.periodi;
CREATE POLICY "Periodi: athlete views team" ON public.periodi FOR SELECT TO authenticated
  USING (private.is_team_member(auth.uid(), team_id));
DROP POLICY IF EXISTS "Periodi: admins all" ON public.periodi;
CREATE POLICY "Periodi: admins all" ON public.periodi FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- esercizi_catalogo (also fix is_public issue)
DROP POLICY IF EXISTS "Esercizi: read all authenticated" ON public.esercizi_catalogo;
CREATE POLICY "Esercizi: read public or own" ON public.esercizi_catalogo FOR SELECT TO authenticated
  USING (
    is_public = true
    OR auth.uid() = created_by
    OR private.has_role(auth.uid(), 'admin')
  );
DROP POLICY IF EXISTS "Esercizi: coach insert" ON public.esercizi_catalogo;
CREATE POLICY "Esercizi: coach insert" ON public.esercizi_catalogo FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'coach') OR private.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Esercizi: creator updates own" ON public.esercizi_catalogo;
CREATE POLICY "Esercizi: creator updates own" ON public.esercizi_catalogo FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR private.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Esercizi: creator deletes own" ON public.esercizi_catalogo;
CREATE POLICY "Esercizi: creator deletes own" ON public.esercizi_catalogo FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR private.has_role(auth.uid(), 'admin'));

-- schede
DROP POLICY IF EXISTS "Schede: coach manages" ON public.schede;
CREATE POLICY "Schede: coach manages" ON public.schede FOR ALL TO authenticated
  USING (private.is_team_coach(auth.uid(), team_id))
  WITH CHECK (private.is_team_coach(auth.uid(), team_id));
DROP POLICY IF EXISTS "Schede: athlete views team" ON public.schede;
CREATE POLICY "Schede: athlete views team" ON public.schede FOR SELECT TO authenticated
  USING (private.is_team_member(auth.uid(), team_id));
DROP POLICY IF EXISTS "Schede: admins all" ON public.schede;
CREATE POLICY "Schede: admins all" ON public.schede FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- scheda_esercizi
DROP POLICY IF EXISTS "SchedaEs: coach manages" ON public.scheda_esercizi;
CREATE POLICY "SchedaEs: coach manages" ON public.scheda_esercizi FOR ALL TO authenticated
  USING (private.is_team_coach(auth.uid(), private.scheda_team_id(scheda_id)))
  WITH CHECK (private.is_team_coach(auth.uid(), private.scheda_team_id(scheda_id)));
DROP POLICY IF EXISTS "SchedaEs: athlete views team" ON public.scheda_esercizi;
CREATE POLICY "SchedaEs: athlete views team" ON public.scheda_esercizi FOR SELECT TO authenticated
  USING (private.is_team_member(auth.uid(), private.scheda_team_id(scheda_id)));
DROP POLICY IF EXISTS "SchedaEs: admins all" ON public.scheda_esercizi;
CREATE POLICY "SchedaEs: admins all" ON public.scheda_esercizi FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- sessions
DROP POLICY IF EXISTS "Sessions: coach views team" ON public.sessions;
CREATE POLICY "Sessions: coach views team" ON public.sessions FOR SELECT TO authenticated
  USING (private.is_team_coach(auth.uid(), team_id));
DROP POLICY IF EXISTS "Sessions: coach updates team" ON public.sessions;
CREATE POLICY "Sessions: coach updates team" ON public.sessions FOR UPDATE TO authenticated
  USING (private.is_team_coach(auth.uid(), team_id));
DROP POLICY IF EXISTS "Sessions: admins all" ON public.sessions;
CREATE POLICY "Sessions: admins all" ON public.sessions FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- set_logs
DROP POLICY IF EXISTS "SetLogs: athlete manages own" ON public.set_logs;
CREATE POLICY "SetLogs: athlete manages own" ON public.set_logs FOR ALL TO authenticated
  USING (auth.uid() = private.session_athlete_id(session_id))
  WITH CHECK (auth.uid() = private.session_athlete_id(session_id));
DROP POLICY IF EXISTS "SetLogs: coach views team" ON public.set_logs;
CREATE POLICY "SetLogs: coach views team" ON public.set_logs FOR SELECT TO authenticated
  USING (private.is_team_coach(auth.uid(), private.session_team_id(session_id)));
DROP POLICY IF EXISTS "SetLogs: admins all" ON public.set_logs;
CREATE POLICY "SetLogs: admins all" ON public.set_logs FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- attendance
DROP POLICY IF EXISTS "Attendance: coach manages" ON public.attendance;
CREATE POLICY "Attendance: coach manages" ON public.attendance FOR ALL TO authenticated
  USING (private.is_team_coach(auth.uid(), team_id))
  WITH CHECK (private.is_team_coach(auth.uid(), team_id));
DROP POLICY IF EXISTS "Attendance: admins all" ON public.attendance;
CREATE POLICY "Attendance: admins all" ON public.attendance FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- infortuni
DROP POLICY IF EXISTS "Infortuni: coach manages athletes" ON public.infortuni;
CREATE POLICY "Infortuni: coach manages athletes" ON public.infortuni FOR ALL TO authenticated
  USING (private.coach_owns_athlete(auth.uid(), athlete_id))
  WITH CHECK (private.coach_owns_athlete(auth.uid(), athlete_id));
DROP POLICY IF EXISTS "Infortuni: admins all" ON public.infortuni;
CREATE POLICY "Infortuni: admins all" ON public.infortuni FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- infortuni_esercizi
DROP POLICY IF EXISTS "InfEs: athlete views own" ON public.infortuni_esercizi;
CREATE POLICY "InfEs: athlete views own" ON public.infortuni_esercizi FOR SELECT TO authenticated
  USING (auth.uid() = private.infortunio_athlete_id(infortunio_id));
DROP POLICY IF EXISTS "InfEs: coach manages" ON public.infortuni_esercizi;
CREATE POLICY "InfEs: coach manages" ON public.infortuni_esercizi FOR ALL TO authenticated
  USING (private.coach_owns_athlete(auth.uid(), private.infortunio_athlete_id(infortunio_id)))
  WITH CHECK (private.coach_owns_athlete(auth.uid(), private.infortunio_athlete_id(infortunio_id)));
DROP POLICY IF EXISTS "InfEs: admins all" ON public.infortuni_esercizi;
CREATE POLICY "InfEs: admins all" ON public.infortuni_esercizi FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- infortuni_log
DROP POLICY IF EXISTS "InfLog: athlete manages own" ON public.infortuni_log;
CREATE POLICY "InfLog: athlete manages own" ON public.infortuni_log FOR ALL TO authenticated
  USING (auth.uid() = private.infortunio_athlete_id(infortunio_id))
  WITH CHECK (auth.uid() = private.infortunio_athlete_id(infortunio_id));
DROP POLICY IF EXISTS "InfLog: coach manages" ON public.infortuni_log;
CREATE POLICY "InfLog: coach manages" ON public.infortuni_log FOR ALL TO authenticated
  USING (private.coach_owns_athlete(auth.uid(), private.infortunio_athlete_id(infortunio_id)))
  WITH CHECK (private.coach_owns_athlete(auth.uid(), private.infortunio_athlete_id(infortunio_id)));
DROP POLICY IF EXISTS "InfLog: admins all" ON public.infortuni_log;
CREATE POLICY "InfLog: admins all" ON public.infortuni_log FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- profiles
DROP POLICY IF EXISTS "Profiles: coaches read team athletes" ON public.profiles;
CREATE POLICY "Profiles: coaches read team athletes" ON public.profiles FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin')
    OR (private.has_role(auth.uid(), 'coach') AND private.coach_owns_athlete(auth.uid(), id))
  );

-- 4) Update join_team_with_code to use private helper, then drop public helpers
CREATE OR REPLACE FUNCTION public.join_team_with_code(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _team_id uuid;
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT private.has_role(_user_id, 'atleta') THEN RAISE EXCEPTION 'not_athlete'; END IF;
  SELECT id INTO _team_id FROM public.teams WHERE invite_code = upper(_code);
  IF _team_id IS NULL THEN RAISE EXCEPTION 'invalid_code'; END IF;
  INSERT INTO public.team_members (team_id, athlete_id) VALUES (_team_id, _user_id)
  ON CONFLICT DO NOTHING;
  RETURN _team_id;
END;
$$;

-- 5) Drop public helper functions (no longer referenced)
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.get_user_role(uuid);
DROP FUNCTION IF EXISTS public.is_team_coach(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_team_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_team_member_direct(uuid, uuid);
DROP FUNCTION IF EXISTS public.coach_owns_athlete(uuid, uuid);
DROP FUNCTION IF EXISTS public.session_athlete_id(uuid);
DROP FUNCTION IF EXISTS public.session_team_id(uuid);
DROP FUNCTION IF EXISTS public.scheda_team_id(uuid);
DROP FUNCTION IF EXISTS public.infortunio_athlete_id(uuid);

-- 6) Lock down trigger-only definer functions in public
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_owner_to_team_coaches() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_invite_code() FROM PUBLIC, anon, authenticated;

-- Keep join_team_with_code executable by authenticated (intentional RPC)
REVOKE ALL ON FUNCTION public.join_team_with_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_team_with_code(text) TO authenticated;
