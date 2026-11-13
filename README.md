# Get Jacked

A private workout, food and bodyweight tracker for a few people. It's a static web app (no build step) that installs to an iPhone home screen, with Supabase for sign-in and storage.

## How it's put together

- `index.html`: the whole app (UI and logic)
- `config.js`: the Supabase project URL and **publishable** key. This is public on purpose: row-level security keeps each person's data private.
- `vendor/supabase.js`: supabase-js v2.119.0 browser build, kept in the repo so the app doesn't depend on a CDN
- `manifest.webmanifest` and `icons/`: home-screen app name and icon
- `supabase/migrations/`: every database change, applied in order by the Deploy workflow
- `tests/`: syntax, SQL and smoke-test checks that CI runs on every PR
- `.github/workflows/`: CI (`ci.yml`) and Deploy (`deploy.yml`)

### Data model

- `profiles`: one row per person (`display_name`, `is_admin`). People can rename themselves but can't make themselves admin. An admin can see the list of names, but **never** anyone else's logs.
- `docs`: each person's tracker data, keyed by `(user_id, coll, id)`, where `coll` is `days`, `workouts` or `settings`. The RLS policy only allows `user_id = auth.uid()`.
- `patch_doc(coll, id, patch)`: merges changed fields into a doc so two devices don't overwrite each other's edits.

## How deploys work

1. Open a PR. **CI** runs: JavaScript syntax, SQL migration checks (parse, RLS on every table, no `anon` grants), a headless smoke test, and a secret scan. **Merge gate** passes once all of them pass, and it's the check `main` requires. The PR also gets labels (`app`, `database`, `ci`, `docs`) based on the files it changes. Vercel posts a **preview URL** on the PR.
2. Merge to `main` with **Create a merge commit**. Vercel deploys the app to production. Once CI passes on `main`, the **Deploy** workflow:
   - applies any new migrations (`supabase db push`)
   - turns off public sign-ups and sets the Site URL and Redirect URLs
   - makes `ADMIN_EMAIL` an admin, if that account exists
3. You can also re-run Deploy by hand: Actions → Deploy → Run workflow.

To change the database, add a new file to `supabase/migrations/` named `YYYYMMDDHHMMSS_short_name.sql`. Never edit a migration that's already been applied.

## One-time setup

1. **Vercel:** Add New → Project → import this repo → Framework preset **Other** → Deploy. There's no build command.
2. **GitHub → Settings → Secrets and variables → Actions:**
   - Secrets: `SUPABASE_ACCESS_TOKEN` (supabase.com → Account → Access Tokens), `SUPABASE_DB_PASSWORD`, `ADMIN_EMAIL`
   - Variables: `SUPABASE_PROJECT_ID` = `tdjogrkeovanphgorvys`, `SITE_URL` = the Vercel production URL
3. **GitHub → Settings → General → Pull Requests:** allow merge commits only (uncheck squash and rebase). **Settings → Rules → Rulesets:** a ruleset on `main` that requires a pull request and the **Merge gate** status check, with **Require linear history** off.
4. **Your account:** Supabase → Authentication → Users → Add user → Create new user (email and a temporary password, with **Auto Confirm User** checked). Then run Actions → Deploy once so you become admin, sign in, and change the password under Plan → Account.

## Adding a person

Authentication → Users → Add user → Create new user (with Auto Confirm checked). Send them the link and their temporary password, and have them change it under Plan → Account.

## Moving data in

In the old tracker, open Plan → Backup → **Copy all data**. In this app, open Plan → Import data, paste it and tap **Import**.
