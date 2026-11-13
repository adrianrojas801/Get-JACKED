-- Get Jacked: database setup
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: it only creates things that don't exist yet.

-- 1) Profiles: one row per person. Only an admin can see other people's names.
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Helper: is the signed-in person an admin? (security definer so it can read profiles without recursion)
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "profiles: read own, admin reads all" on public.profiles;
create policy "profiles: read own, admin reads all" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- People can change their own display name, never their admin flag.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

-- Create a profile automatically whenever a user is added (Authentication -> Users -> Add user).
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profiles for anyone who already exists.
insert into public.profiles (id, display_name)
select u.id, split_part(u.email, '@', 1) from auth.users u
on conflict (id) do nothing;

-- 2) Docs: each person's tracker data (days, workouts, settings), private to that person.
-- Even the admin can't read anyone else's docs.
create table if not exists public.docs (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  coll       text not null check (coll in ('days', 'workouts', 'settings')),
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, coll, id)
);
alter table public.docs enable row level security;

drop policy if exists "docs: own rows only" on public.docs;
create policy "docs: own rows only" on public.docs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.docs from anon, authenticated;
grant select, insert, update, delete on public.docs to authenticated;

-- Merge a few fields into a doc without overwriting the rest (creates it if missing).
create or replace function public.patch_doc(p_coll text, p_id text, p_patch jsonb)
returns void
language sql security invoker
set search_path = public
as $$
  insert into public.docs (user_id, coll, id, data, updated_at)
  values (auth.uid(), p_coll, p_id, p_patch, now())
  on conflict (user_id, coll, id)
  do update set data = public.docs.data || excluded.data, updated_at = now();
$$;
revoke all on function public.patch_doc(text, text, jsonb) from public, anon;
grant execute on function public.patch_doc(text, text, jsonb) to authenticated;

-- 3) Live updates between your phone and computer.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'docs'
  ) then
    alter publication supabase_realtime add table public.docs;
  end if;
end $$;
