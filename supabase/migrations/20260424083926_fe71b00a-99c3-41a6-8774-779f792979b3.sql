
-- Roles enum
create type public.app_role as enum ('admin', 'coach', 'atleta');

-- Profiles table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  birth_date date,
  avatar_url text,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- User roles table (separate to avoid privilege escalation)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

-- Security definer to check role without RLS recursion
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Helper to get a user's primary role
create or replace function public.get_user_role(_user_id uuid)
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.user_roles
  where user_id = _user_id
  order by case role when 'admin' then 1 when 'coach' then 2 when 'atleta' then 3 end
  limit 1
$$;

-- Profiles RLS
create policy "Profiles: users read own" on public.profiles
  for select using (auth.uid() = id);
create policy "Profiles: coaches read all" on public.profiles
  for select using (public.has_role(auth.uid(), 'coach') or public.has_role(auth.uid(), 'admin'));
create policy "Profiles: users update own" on public.profiles
  for update using (auth.uid() = id);
create policy "Profiles: users insert own" on public.profiles
  for insert with check (auth.uid() = id);

-- user_roles RLS
create policy "Roles: users read own" on public.user_roles
  for select using (auth.uid() = user_id);
create policy "Roles: users insert own (signup)" on public.user_roles
  for insert with check (auth.uid() = user_id);
create policy "Roles: admins manage" on public.user_roles
  for all using (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
