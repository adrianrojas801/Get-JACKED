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
- `docs`: each person's tracker data, keyed by `(user_id, coll, id)`, where `coll` is `days`, `workouts` or `settings`. The RLS policy only allows `user_id = auth.uid()`. Each person's workout program, targets and quick-add foods live in their own `settings` doc.
- `patch_doc(coll, id, patch)`: merges changed fields into a doc so two devices don't overwrite each other's edits.

### What's shared between people

Logs are private. Two things are shared on purpose:

- **The board** (Progress tab): weekly totals per person (workouts done and planned, protein days, average steps, strength change) plus the name and day of their latest session. Turn it off under your account with **Show me on the board**.
- **Intake answers**: sent to the admin once, so a custom program can be written.

### Using it with no signal

Once you've opened the app on your phone while online, it opens and logs without a connection. The status under your initial says **Offline · saved on this phone**, and everything sends when you're back online. Signing out clears the copy kept on the phone.

### Automatic steps

Under your account, tap **Set up automatic steps** and follow the steps to build a Shortcut on your iPhone. It sends your Apple Health step count to the app with a personal token. **Make a new link** replaces the token, and **Turn off** deletes it.

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
4. **Your account:** Supabase → Authentication → Users → Add user → Create new user (email and a temporary password, with **Auto Confirm User** checked). Then run Actions → Deploy once so you become admin, sign in, and change the password from the round account button in the top-right corner.

## Adding a person

Authentication → Users → Add user → Create new user (with Auto Confirm checked). Send them the link and their temporary password, and have them change it from the round account button in the top-right corner. The first time they sign in, a short set of questions builds a standard workout program and daily targets, so they can start logging right away. They can edit both later under Plan.

To give them a custom program:
1. Their answers show up under **Intake requests** on your account page (tap your initial in the top-right corner).
2. Tap **Copy for Claude**, paste it into Claude, and copy the program Claude writes.
3. Tap **Send program**, paste it, and tap **Send**.
4. Next time they open the app, they see "Your new program is ready" and tap **Use it**. Their logs stay.
