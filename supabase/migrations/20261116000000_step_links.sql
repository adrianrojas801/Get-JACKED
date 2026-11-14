-- Automatic steps: an iOS Shortcut posts the day's step count with a personal link token.
-- The Shortcut can't sign in, so log_steps() is the one function signed-out callers (anon) may run.
-- It can only set the `steps` number on one of the token owner's recent day logs. Nothing can be read through it.

create table if not exists public.step_tokens (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  token_hash text not null unique,          -- sha256 of the token; the token itself is never stored
  created_at timestamptz not null default now(),
  last_used  timestamptz
);
alter table public.step_tokens enable row level security;

drop policy if exists "step_tokens: see own" on public.step_tokens;
create policy "step_tokens: see own" on public.step_tokens
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "step_tokens: remove own" on public.step_tokens;
create policy "step_tokens: remove own" on public.step_tokens
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.step_tokens from anon, authenticated;
grant select (user_id, created_at, last_used), delete on public.step_tokens to authenticated;

-- Makes (or replaces) the caller's token and returns it once. Only the hash is kept.
create or replace function public.new_steps_token()
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  insert into public.step_tokens (user_id, token_hash, created_at, last_used)
  values (auth.uid(), encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), now(), null)
  on conflict (user_id) do update
    set token_hash = excluded.token_hash, created_at = now(), last_used = null;
  return v_token;
end;
$$;
revoke all on function public.new_steps_token() from public, anon;
grant execute on function public.new_steps_token() to authenticated;

-- Sets the step count on the token owner's day log (creating the day if needed).
create or replace function public.log_steps(p_token text, p_steps integer, p_date date default null)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_day  date := coalesce(p_date, current_date);
begin
  if p_token is null or char_length(p_token) < 32 then
    raise exception 'Unknown link' using errcode = '28000';
  end if;
  select user_id into v_user from public.step_tokens
   where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  if v_user is null then
    raise exception 'Unknown link' using errcode = '28000';
  end if;
  if p_steps is null or p_steps < 0 or p_steps > 200000 then
    raise exception 'Steps must be between 0 and 200000';
  end if;
  if v_day < current_date - 7 or v_day > current_date + 1 then
    raise exception 'The date must be within the last week';
  end if;
  insert into public.docs (user_id, coll, id, data, updated_at)
  values (v_user, 'days', v_day::text,
          jsonb_build_object('date', v_day::text, 'food', '[]'::jsonb, 'steps', p_steps), now())
  on conflict (user_id, coll, id) do update
    set data = public.docs.data || jsonb_build_object('steps', p_steps), updated_at = now();
  update public.step_tokens set last_used = now() where user_id = v_user;
  return 'ok';
end;
$$;
revoke all on function public.log_steps(text, integer, date) from public, anon;
-- The one deliberate exception for signed-out callers (see the note at the top, and ANON_OK in tests/check_sql.py).
grant execute on function public.log_steps(text, integer, date) to anon, authenticated;
