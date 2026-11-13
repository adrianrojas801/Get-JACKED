# Get Jacked

A private workout, food and bodyweight tracker for a few people. It's a static web app (no build step) that installs to an iPhone home screen, with Supabase for sign-in and storage.

## How it's put together

- `index.html`: the whole app (UI and logic)
- `config.js`: the Supabase project URL and **publishable** key. This is public on purpose: row-level security keeps each person's data private.
- `vendor/supabase.js`: supabase-js v2.119.0 browser build, kept in the repo so the app doesn't depend on a CDN
- `manifest.webmanifest` and `icons/`: home-screen app name and icon
- `supabase/schema.sql`: tables, security rules and helper functions

### Data model

- `profiles`: one row per person (`display_name`, `is_admin`). People can rename themselves but can't make themselves admin. An admin can see the list of names, but **never** anyone else's logs.
- `docs`: each person's tracker data, keyed by `(user_id, coll, id)`, where `coll` is `days`, `workouts` or `settings`. The RLS policy only allows `user_id = auth.uid()`.
- `patch_doc(coll, id, patch)`: merges changed fields into a doc so two devices don't overwrite each other's edits.

## One-time setup

1. **Database:** Supabase → SQL Editor → New query → paste `supabase/schema.sql` → Run.
2. **Turn off public sign-ups:** Authentication → Sign In / Providers → turn off **Allow new users to sign up**. Keep the Email provider on.
3. **Deploy:** Vercel → Add New → Project → import this repo → Framework preset **Other** → Deploy. There's no build command.
4. **Auth URLs:** Supabase → Authentication → URL Configuration → set **Site URL** to the Vercel URL and add it under **Redirect URLs**.
5. **Create your account:** Authentication → Users → Add user → Create new user (email and a temporary password, with **Auto Confirm User** checked). Then sign in to the app and change the password under Plan → Account.
6. **Make yourself admin:** SQL Editor:
   ```sql
   update public.profiles set is_admin = true
   where id = (select id from auth.users where email = 'you@example.com');
   ```

## Adding a person

Authentication → Users → Add user → Create new user (with Auto Confirm checked). Send them the link and their temporary password, and have them change it under Plan → Account.

## Moving data in

In the old tracker, open Plan → Backup → **Copy all data**. In this app, open Plan → Import data, paste it and tap **Import**.
