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
