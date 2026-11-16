-- Per-device switches for each kind of notification. Everything stays on until a person turns it off.
alter table public.push_subs add column if not exists notify_weigh boolean not null default true;
alter table public.push_subs add column if not exists notify_train boolean not null default true;
alter table public.push_subs add column if not exists notify_rest  boolean not null default true;
