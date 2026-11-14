-- Board: what's needed for "Sam finished Push today" and the shared weekly goal.
-- Still totals and a session title only: no exercises, weights or food.
alter table public.board add column if not exists planned integer not null default 0 check (planned between 0 and 7);
alter table public.board add column if not exists last_workout date;
alter table public.board add column if not exists last_title text check (last_title is null or char_length(last_title) <= 40);
