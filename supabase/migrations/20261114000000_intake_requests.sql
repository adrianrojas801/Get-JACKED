-- Intake requests: a new person's setup answers, shared with the admin on purpose,
-- so the admin can have a custom program written and send it back.
-- This is the only thing an admin can see about another person. Their logs stay in
-- public.docs, which admins still can't read.

create table if not exists public.intake_requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  answers    jsonb not null check (jsonb_typeof(answers) = 'object' and pg_column_size(answers) < 20000),
  plan       jsonb check (plan is null or (jsonb_typeof(plan) = 'object' and pg_column_size(plan) < 100000)),
  status     text not null default 'new' check (status in ('new', 'sent', 'applied')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.intake_requests enable row level security;
create index if not exists intake_requests_user_idx on public.intake_requests (user_id, created_at desc);

-- People see their own requests. Admins see everyone's.
drop policy if exists "intake: read own, admin reads all" on public.intake_requests;
create policy "intake: read own, admin reads all" on public.intake_requests
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- People can only file requests as themselves.
drop policy if exists "intake: insert own" on public.intake_requests;
create policy "intake: insert own" on public.intake_requests
  for insert to authenticated
  with check (user_id = auth.uid());

-- The client can only insert the answers. Everything else is a default or changed by the functions below.
revoke all on public.intake_requests from anon, authenticated;
grant select on public.intake_requests to authenticated;
grant insert (answers) on public.intake_requests to authenticated;

-- Admin sends a written program back on a request.
create or replace function public.send_intake_plan(p_id uuid, p_plan jsonb)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can send a program' using errcode = '42501';
  end if;
  -- coalesce: a missing key gives null, and null <> 'object' would let it through.
  if coalesce(jsonb_typeof(p_plan -> 'program' -> 'days'), '') <> 'object' then
    raise exception 'That program is missing its days' using errcode = '22023';
  end if;
  update public.intake_requests
     set plan = p_plan, status = 'sent', updated_at = now()
   where id = p_id;
  if not found then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.send_intake_plan(uuid, jsonb) from public, anon;
grant execute on function public.send_intake_plan(uuid, jsonb) to authenticated;

-- The person marks a sent program as applied once they've switched to it.
create or replace function public.mark_intake_applied(p_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  update public.intake_requests
     set status = 'applied', updated_at = now()
   where id = p_id and user_id = auth.uid() and status = 'sent';
end;
$$;
revoke all on function public.mark_intake_applied(uuid) from public, anon;
grant execute on function public.mark_intake_applied(uuid) to authenticated;

-- Housekeeping: the sign-up trigger function from the first migration is security definer
-- but never had execute revoked. It only runs as a trigger, so revoke direct execute.
revoke all on function public.handle_new_user() from public, anon, authenticated;
