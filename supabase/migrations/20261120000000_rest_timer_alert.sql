-- Rest timer alert: when you leave the app mid-rest, the app asks the rest-alert function to push
-- "Rest done" at the moment the timer ends. This column holds when that alert is due for a device.
-- Coming back to the app clears it, and the function checks it before sending, so a stale alert never fires.
-- No new policies are needed: push_subs already lets a person change only their own rows.
alter table public.push_subs add column if not exists rest_until timestamptz;
