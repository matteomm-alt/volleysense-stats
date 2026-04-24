-- ==========================================
-- ENUMS
-- ==========================================
create type public.injury_severity as enum ('lieve', 'moderato', 'grave');
create type public.injury_status as enum ('attivo', 'in_recupero', 'risolto');
create type public.attendance_status as enum ('presente', 'assente', 'giustificato', 'infortunato');
create type public.exercise_category as enum ('forza', 'potenza', 'resistenza', 'mobilita', 'pliometria', 'tecnica', 'riscaldamento', 'recupero', 'core', 'altro');

-- ==========================================
-- TEAMS
-- ==========================================
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  season text,
  description text,
  owner_coach_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_teams_owner on public.teams(owner_coach_id);
alter table public.teams enable row level security;

create trigger trg_teams_updated before update on public.teams
  for each row execute function public.set_updated_at();

-- ==========================================
-- TEAM MEMBERS (atleti)
-- ==========================================
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  athlete_id uuid not null references auth.users(id) on delete cascade,
  jersey_number int,
  position text,
  joined_at timestamptz not null default now(),
  unique(team_id, athlete_id)
);

create index idx_team_members_team on public.team_members(team_id);
create index idx_team_members_athlete on public.team_members(athlete_id);
alter table public.team_members enable row level security;

-- ==========================================
-- TEAM COACHES (coach assistenti)
-- ==========================================
create table public.team_coaches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  coach_id uuid not null references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  unique(team_id, coach_id)
);

create index idx_team_coaches_team on public.team_coaches(team_id);
create index idx_team_coaches_coach on public.team_coaches(coach_id);
alter table public.team_coaches enable row level security;

-- ==========================================
-- HELPER FUNCTIONS (security definer per evitare ricorsione RLS)
-- ==========================================
create or replace function public.is_team_coach(_user_id uuid, _team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.teams where id = _team_id and owner_coach_id = _user_id
  ) or exists (
    select 1 from public.team_coaches where team_id = _team_id and coach_id = _user_id
  )
$$;

create or replace function public.is_team_member(_user_id uuid, _team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members where team_id = _team_id and athlete_id = _user_id
  )
$$;

create or replace function public.coach_owns_athlete(_coach_id uuid, _athlete_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where tm.athlete_id = _athlete_id
      and (t.owner_coach_id = _coach_id or exists (
        select 1 from public.team_coaches tc where tc.team_id = t.id and tc.coach_id = _coach_id
      ))
  )
$$;

-- ==========================================
-- TEAMS RLS
-- ==========================================
create policy "Teams: coach owner manages" on public.teams
  for all using (auth.uid() = owner_coach_id) with check (auth.uid() = owner_coach_id);

create policy "Teams: assistant coaches view" on public.teams
  for select using (
    exists (select 1 from public.team_coaches where team_id = teams.id and coach_id = auth.uid())
  );

create policy "Teams: athletes view their teams" on public.teams
  for select using (
    exists (select 1 from public.team_members where team_id = teams.id and athlete_id = auth.uid())
  );

create policy "Teams: admins all" on public.teams
  for all using (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- TEAM MEMBERS RLS
-- ==========================================
create policy "TeamMembers: coach manages" on public.team_members
  for all using (public.is_team_coach(auth.uid(), team_id))
  with check (public.is_team_coach(auth.uid(), team_id));

create policy "TeamMembers: athlete views own" on public.team_members
  for select using (auth.uid() = athlete_id);

create policy "TeamMembers: athlete views teammates" on public.team_members
  for select using (public.is_team_member(auth.uid(), team_id));

create policy "TeamMembers: admins all" on public.team_members
  for all using (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- TEAM COACHES RLS
-- ==========================================
create policy "TeamCoaches: owner manages" on public.team_coaches
  for all using (
    exists (select 1 from public.teams where id = team_coaches.team_id and owner_coach_id = auth.uid())
  ) with check (
    exists (select 1 from public.teams where id = team_coaches.team_id and owner_coach_id = auth.uid())
  );

create policy "TeamCoaches: coach views own" on public.team_coaches
  for select using (auth.uid() = coach_id);

create policy "TeamCoaches: admins all" on public.team_coaches
  for all using (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- PERIODI
-- ==========================================
create table public.periodi (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  description text,
  start_date date not null,
  end_date date not null,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_periodi_team on public.periodi(team_id);
alter table public.periodi enable row level security;
create trigger trg_periodi_updated before update on public.periodi
  for each row execute function public.set_updated_at();

create policy "Periodi: coach manages" on public.periodi
  for all using (public.is_team_coach(auth.uid(), team_id))
  with check (public.is_team_coach(auth.uid(), team_id));

create policy "Periodi: athlete views team" on public.periodi
  for select using (public.is_team_member(auth.uid(), team_id));

create policy "Periodi: admins all" on public.periodi
  for all using (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- ESERCIZI CATALOGO (globale)
-- ==========================================
create table public.esercizi_catalogo (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category public.exercise_category not null default 'altro',
  muscle_group text,
  description text,
  video_url text,
  image_url text,
  default_unit text default 'kg',
  created_by uuid references auth.users(id) on delete set null,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_esercizi_category on public.esercizi_catalogo(category);
create index idx_esercizi_name on public.esercizi_catalogo(name);
alter table public.esercizi_catalogo enable row level security;
create trigger trg_esercizi_updated before update on public.esercizi_catalogo
  for each row execute function public.set_updated_at();

create policy "Esercizi: read all authenticated" on public.esercizi_catalogo
  for select to authenticated using (true);

create policy "Esercizi: coach insert" on public.esercizi_catalogo
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'coach') or public.has_role(auth.uid(), 'admin'));

create policy "Esercizi: creator updates own" on public.esercizi_catalogo
  for update using (auth.uid() = created_by or public.has_role(auth.uid(), 'admin'));

create policy "Esercizi: creator deletes own" on public.esercizi_catalogo
  for delete using (auth.uid() = created_by or public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- SCHEDE
-- ==========================================
create table public.schede (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  periodo_id uuid references public.periodi(id) on delete set null,
  title text not null,
  description text,
  order_index int not null default 0,
  is_template boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_schede_team on public.schede(team_id);
create index idx_schede_periodo on public.schede(periodo_id);
alter table public.schede enable row level security;
create trigger trg_schede_updated before update on public.schede
  for each row execute function public.set_updated_at();

create policy "Schede: coach manages" on public.schede
  for all using (public.is_team_coach(auth.uid(), team_id))
  with check (public.is_team_coach(auth.uid(), team_id));

create policy "Schede: athlete views team" on public.schede
  for select using (public.is_team_member(auth.uid(), team_id));

create policy "Schede: admins all" on public.schede
  for all using (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- SCHEDA ESERCIZI
-- ==========================================
create table public.scheda_esercizi (
  id uuid primary key default gen_random_uuid(),
  scheda_id uuid not null references public.schede(id) on delete cascade,
  esercizio_id uuid not null references public.esercizi_catalogo(id) on delete restrict,
  order_index int not null default 0,
  sets int,
  reps text,
  load_value numeric,
  load_unit text default 'kg',
  rest_seconds int,
  tempo text,
  rpe_target numeric,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_scheda_esercizi_scheda on public.scheda_esercizi(scheda_id);
alter table public.scheda_esercizi enable row level security;

create or replace function public.scheda_team_id(_scheda_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select team_id from public.schede where id = _scheda_id
$$;

create policy "SchedaEs: coach manages" on public.scheda_esercizi
  for all using (public.is_team_coach(auth.uid(), public.scheda_team_id(scheda_id)))
  with check (public.is_team_coach(auth.uid(), public.scheda_team_id(scheda_id)));

create policy "SchedaEs: athlete views team" on public.scheda_esercizi
  for select using (public.is_team_member(auth.uid(), public.scheda_team_id(scheda_id)));

create policy "SchedaEs: admins all" on public.scheda_esercizi
  for all using (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- SESSIONS (allenamenti svolti)
-- ==========================================
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  scheda_id uuid references public.schede(id) on delete set null,
  session_date date not null default current_date,
  duration_minutes int,
  rpe numeric,
  notes text,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_sessions_athlete on public.sessions(athlete_id);
create index idx_sessions_team on public.sessions(team_id);
create index idx_sessions_date on public.sessions(session_date);
alter table public.sessions enable row level security;
create trigger trg_sessions_updated before update on public.sessions
  for each row execute function public.set_updated_at();

create policy "Sessions: athlete manages own" on public.sessions
  for all using (auth.uid() = athlete_id) with check (auth.uid() = athlete_id);

create policy "Sessions: coach views team" on public.sessions
  for select using (public.is_team_coach(auth.uid(), team_id));

create policy "Sessions: coach updates team" on public.sessions
  for update using (public.is_team_coach(auth.uid(), team_id));

create policy "Sessions: admins all" on public.sessions
  for all using (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- SET LOGS
-- ==========================================
create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  scheda_esercizio_id uuid references public.scheda_esercizi(id) on delete set null,
  esercizio_id uuid not null references public.esercizi_catalogo(id) on delete restrict,
  set_number int not null,
  reps int,
  load_value numeric,
  load_unit text default 'kg',
  rpe numeric,
  notes text,
  completed boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_set_logs_session on public.set_logs(session_id);
create index idx_set_logs_esercizio on public.set_logs(esercizio_id);
alter table public.set_logs enable row level security;

create or replace function public.session_athlete_id(_session_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select athlete_id from public.sessions where id = _session_id
$$;

create or replace function public.session_team_id(_session_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select team_id from public.sessions where id = _session_id
$$;

create policy "SetLogs: athlete manages own" on public.set_logs
  for all using (auth.uid() = public.session_athlete_id(session_id))
  with check (auth.uid() = public.session_athlete_id(session_id));

create policy "SetLogs: coach views team" on public.set_logs
  for select using (public.is_team_coach(auth.uid(), public.session_team_id(session_id)));

create policy "SetLogs: admins all" on public.set_logs
  for all using (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- ATTENDANCE (presenze)
-- ==========================================
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  athlete_id uuid not null references auth.users(id) on delete cascade,
  session_date date not null,
  status public.attendance_status not null default 'presente',
  notes text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(team_id, athlete_id, session_date)
);

create index idx_attendance_team on public.attendance(team_id);
create index idx_attendance_athlete on public.attendance(athlete_id);
create index idx_attendance_date on public.attendance(session_date);
alter table public.attendance enable row level security;
create trigger trg_attendance_updated before update on public.attendance
  for each row execute function public.set_updated_at();

create policy "Attendance: coach manages" on public.attendance
  for all using (public.is_team_coach(auth.uid(), team_id))
  with check (public.is_team_coach(auth.uid(), team_id));

create policy "Attendance: athlete views own" on public.attendance
  for select using (auth.uid() = athlete_id);

create policy "Attendance: admins all" on public.attendance
  for all using (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- INFORTUNI
-- ==========================================
create table public.infortuni (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  body_zone text not null,
  side text,
  severity public.injury_severity not null default 'lieve',
  status public.injury_status not null default 'attivo',
  injury_date date not null default current_date,
  expected_return_date date,
  actual_return_date date,
  description text,
  diagnosis text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_infortuni_athlete on public.infortuni(athlete_id);
create index idx_infortuni_team on public.infortuni(team_id);
create index idx_infortuni_status on public.infortuni(status);
alter table public.infortuni enable row level security;
create trigger trg_infortuni_updated before update on public.infortuni
  for each row execute function public.set_updated_at();

create policy "Infortuni: athlete views own" on public.infortuni
  for select using (auth.uid() = athlete_id);

create policy "Infortuni: athlete inserts own" on public.infortuni
  for insert with check (auth.uid() = athlete_id);

create policy "Infortuni: coach manages athletes" on public.infortuni
  for all using (public.coach_owns_athlete(auth.uid(), athlete_id))
  with check (public.coach_owns_athlete(auth.uid(), athlete_id));

create policy "Infortuni: admins all" on public.infortuni
  for all using (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- INFORTUNI ESERCIZI (recupero)
-- ==========================================
create table public.infortuni_esercizi (
  id uuid primary key default gen_random_uuid(),
  infortunio_id uuid not null references public.infortuni(id) on delete cascade,
  esercizio_id uuid references public.esercizi_catalogo(id) on delete set null,
  custom_name text,
  sets int,
  reps text,
  frequency text,
  notes text,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_inf_esercizi_inf on public.infortuni_esercizi(infortunio_id);
alter table public.infortuni_esercizi enable row level security;

create or replace function public.infortunio_athlete_id(_infortunio_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select athlete_id from public.infortuni where id = _infortunio_id
$$;

create policy "InfEs: athlete views own" on public.infortuni_esercizi
  for select using (auth.uid() = public.infortunio_athlete_id(infortunio_id));

create policy "InfEs: coach manages" on public.infortuni_esercizi
  for all using (public.coach_owns_athlete(auth.uid(), public.infortunio_athlete_id(infortunio_id)))
  with check (public.coach_owns_athlete(auth.uid(), public.infortunio_athlete_id(infortunio_id)));

create policy "InfEs: admins all" on public.infortuni_esercizi
  for all using (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- INFORTUNI LOG (aggiornamenti recupero)
-- ==========================================
create table public.infortuni_log (
  id uuid primary key default gen_random_uuid(),
  infortunio_id uuid not null references public.infortuni(id) on delete cascade,
  log_date date not null default current_date,
  pain_level int,
  mobility_level int,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_inf_log_inf on public.infortuni_log(infortunio_id);
alter table public.infortuni_log enable row level security;

create policy "InfLog: athlete manages own" on public.infortuni_log
  for all using (auth.uid() = public.infortunio_athlete_id(infortunio_id))
  with check (auth.uid() = public.infortunio_athlete_id(infortunio_id));

create policy "InfLog: coach manages" on public.infortuni_log
  for all using (public.coach_owns_athlete(auth.uid(), public.infortunio_athlete_id(infortunio_id)))
  with check (public.coach_owns_athlete(auth.uid(), public.infortunio_athlete_id(infortunio_id)));

create policy "InfLog: admins all" on public.infortuni_log
  for all using (public.has_role(auth.uid(), 'admin'));