-- Minimal stand-in for what Supabase provides before our migrations run:
-- the API roles, the auth schema with auth.users and auth.uid(), and the Realtime publication.
-- Only used by tests/check_db.py.
create role anon nologin;
create role authenticated nologin;
create role supabase_auth_admin nologin;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}');
grant usage on schema auth to supabase_auth_admin, authenticated, anon;
grant insert, select on auth.users to supabase_auth_admin;
grant usage on schema public to anon, authenticated, supabase_auth_admin;
grant insert on all tables in schema public to supabase_auth_admin;
alter default privileges in schema public grant insert on tables to supabase_auth_admin;
-- Supabase reads the signed-in user's id from the request's JWT claims.
create function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated, supabase_auth_admin;
create publication supabase_realtime;
-- Storage: buckets, objects (with row-level security on, as on Supabase) and the folder helper policies use.
create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id),
  name text, owner uuid, unique (bucket_id, name));
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as
$$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant execute on function storage.foldername(text) to anon, authenticated;
