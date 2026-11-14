-- Two features that need server pieces the owner turns on later (see README, "Optional features").
-- The tables and rules ship now so nothing else is needed in the database when he does.

-- 1) Photo food estimates: a per-person, per-day counter so the Edge Function can cap usage.
create table if not exists public.ai_usage (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day     date not null default current_date,
  kind    text not null check (kind in ('food')),
  n       integer not null default 0 check (n >= 0),
  primary key (user_id, day, kind)
);
alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage: see own" on public.ai_usage;
create policy "ai_usage: see own" on public.ai_usage
  for select to authenticated using (user_id = auth.uid());

revoke all on public.ai_usage from anon, authenticated;
grant select on public.ai_usage to authenticated;

-- Counts one use for the caller today. Returns false, and counts nothing, once today's limit is reached.
-- The limit comes from the Edge Function. Calling this directly can only use up your own allowance.
create or replace function public.use_ai(p_kind text, p_limit integer)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  insert into public.ai_usage as u (user_id, day, kind, n)
  values (auth.uid(), current_date, p_kind, 1)
  on conflict (user_id, day, kind) do update set n = u.n + 1 where u.n < p_limit
  returning n into v_n;
  return v_n is not null and v_n <= greatest(p_limit, 0);
end;
$$;
revoke all on function public.use_ai(text, integer) from public, anon;
grant execute on function public.use_ai(text, integer) to authenticated;

-- 2) Reminders: where to send each device's push notifications, and at which local hours.
create table if not exists public.push_subs (
  endpoint   text primary key check (char_length(endpoint) between 20 and 1000),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh     text not null check (char_length(p256dh) <= 200),
  auth       text not null check (char_length(auth) <= 100),
  tz         text not null default 'America/Chicago' check (char_length(tz) <= 64),
  morning    smallint not null default 8 check (morning between 0 and 23),   -- weigh-in nudge
  evening    smallint not null default 18 check (evening between 0 and 23),  -- workout nudge
  created_at timestamptz not null default now()
);
alter table public.push_subs enable row level security;
create index if not exists push_subs_user_idx on public.push_subs (user_id);

drop policy if exists "push_subs: see own" on public.push_subs;
create policy "push_subs: see own" on public.push_subs
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "push_subs: add own" on public.push_subs;
create policy "push_subs: add own" on public.push_subs
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "push_subs: change own" on public.push_subs;
create policy "push_subs: change own" on public.push_subs
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "push_subs: remove own" on public.push_subs;
create policy "push_subs: remove own" on public.push_subs
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.push_subs from anon, authenticated;
grant select, insert, update, delete on public.push_subs to authenticated;
