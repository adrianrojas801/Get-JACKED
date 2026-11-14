-- The board: weekly totals people choose to share with everyone else on the app.
-- This is the only table one person can read about another (besides intake requests, admin only).
-- It holds totals only: never food, weights, bodyweight or workout details.

create table if not exists public.board (
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week         date not null,                      -- the Sunday the week starts on
  name         text not null check (char_length(name) between 1 and 40),
  workouts     integer not null default 0 check (workouts between 0 and 14),
  protein_days integer not null default 0 check (protein_days between 0 and 7),
  steps        integer not null default 0 check (steps between 0 and 100000),   -- daily average
  strength     numeric(5, 1) check (strength is null or strength between -100 and 500), -- % change, last 4 weeks
  updated_at   timestamptz not null default now(),
  primary key (user_id, week)
);
alter table public.board enable row level security;

drop policy if exists "board: everyone signed in can read" on public.board;
create policy "board: everyone signed in can read" on public.board
  for select to authenticated using (true);

drop policy if exists "board: add own rows" on public.board;
create policy "board: add own rows" on public.board
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "board: change own rows" on public.board;
create policy "board: change own rows" on public.board
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "board: remove own rows" on public.board;
create policy "board: remove own rows" on public.board
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.board from anon, authenticated;
grant select, insert, update, delete on public.board to authenticated;
