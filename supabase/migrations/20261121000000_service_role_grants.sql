-- The server functions (send-reminders, rest-alert) use the service role. "Automatically expose new tables"
-- is off on this project, so the service role had no rights on these tables and every read failed with
-- "permission denied". That is why reminders and the rest alert never sent anything.
-- Grant only what those functions need: read and update push subscriptions (and delete dead ones),
-- and read docs to decide whether a nudge is due. Row security is unchanged.
grant usage on schema public to service_role;
grant select, update, delete on public.push_subs to service_role;
grant select on public.docs to service_role;
