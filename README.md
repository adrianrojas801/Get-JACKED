# Get Jacked

A private workout, food and bodyweight tracker for a few people. It's a static web app (no build step) that installs to an iPhone home screen. Supabase handles sign-in, the database and live sync. Vercel hosts it.

New to the repo? Read **Start here**, then **How the app works**. Rules for commits and PRs are in `CLAUDE.md`. Read that file before your first PR.

## Start here

1. Run it: `python3 -m http.server 8000` from the repo root, then open `http://localhost:8000`. There's no install step and no build.
2. It talks to the real Supabase project in `config.js`. Sign-ups are off, so you need an account the owner created. Don't test destructive changes against it.
3. Before you push, run the checks in **Tests** below.
4. Work on a branch (`feat/...`, `fix/...`, `chore/...`, `docs/...`) and open a PR. Never push to `main`. The owner merges with a merge commit.

## What's in the repo

| Path | What it is |
|---|---|
| `index.html` | Page shell. Loads the scripts in `js/` in a fixed order. |
| `js/*.js` | The whole app (see the next table). |
| `css/app.css` | All styles. |
| `sw.js` | Service worker. Caches the app's own files so it opens offline, and shows push reminders. |
| `config.js` | Supabase URL and **publishable** key. Public on purpose: row-level security (RLS) keeps data private. |
| `vendor/supabase.js` | supabase-js, kept in the repo so there's no CDN. |
| `supabase/migrations/` | Every database change, applied in order. |
| `supabase/functions/` | Three optional server functions: `food-estimate`, `send-reminders` and `rest-alert`. |
| `tests/` | Syntax, SQL, database-rules and browser smoke tests. |
| `docs/EVIDENCE.md` | The research or practice behind every coaching rule. |
| `.github/workflows/` | `ci.yml` (every PR), `deploy.yml` (after CI passes on `main`), `labeler.yml`. |

The scripts in `js/` share one global scope and load in this order, so a file can only use what earlier files define at load time:

| File | Holds |
|---|---|
| `program.js` | Workout programs and the intake math that builds one |
| `core.js` | Helpers, app state `S`, the save pipeline, the offline copy, reading days/workouts/settings |
| `training.js` | Today's targets, lift history, bests, stalls, rest timer |
| `shared.js` | Week totals, streaks, the board, head to head, toast, charts |
| `today.js` | Today tab: food logging, the Add foods sheet, photo estimates |
| `workout.js` | Muscle figure and the Workout tab |
| `progress.js` | Progress tab, weekly check-in, phases, suggestions, photos, measurements |
| `plan.js` | Plan tab, intake form, program editor, and `render()` |
| `events.js` | Every tap, change and input is handled here |
| `app.js` | Start-up: Supabase data layer, sign-in, steps, reminders, loading |

## How the app works

- **No framework.** `render()` (in `plan.js`) builds an HTML string for the current tab and sets `#app.innerHTML`. State lives in the global object `S`. `softRender()` re-renders without losing your place.
- **Events.** One click, change and input handler per type in `events.js` reads `data-act="..."` from the tapped element. To add a button, put `data-act="mything"` on it and add a branch for it there.
- **Data adapter.** The UI never calls Supabase for its data. It uses `makeDb(uid)` in `app.js`, which looks like a document store: `doc(path).get/set/update/onSnapshot`. Paths are `days/<YYYY-MM-DD>`, `workouts/<date>_<program>` and `settings/main`. Behind it, everything is one table, `docs`.
- **Saving.** `save()` writes taps right away and waits about 700 ms after typing stops. It writes one document at a time, retries once, and flushes when you leave the page. If a save takes over 5 seconds the status says "Not saved yet…". `update` means a partial merge (`patch_doc`), so two phones don't overwrite each other. `set` replaces the whole doc.
- **Live sync.** Realtime on `docs` pushes changes between a person's devices. The app waits for days, workouts and settings before drawing Today, so it never shows an empty screen that looks like lost data.
- **Offline.** The last synced data is kept in localStorage and unsent writes are kept in an outbox. Supabase is still the source of truth, and its data replaces the copy when it connects. Never cache Supabase responses in `sw.js`.
- **Programs.** Each person's program is in their `settings/main` doc. Read it with `PROG()`, `dayOf()`, `titleOf()` and `schedOn()`. Never hard-code a program.
- **Coaching math lives in one place each.** What to lift today: `targetFor()`. Weight changes and calorie advice: `weightTrend()`. Hard sets per muscle: `muscleWork()`. Use these helpers instead of re-deriving. `CLAUDE.md` lists them all.
- **Logging food.** Every path (quick-add button, custom entry, photo estimate) goes through `addFood()`.

### Screens

- **Today:** progress rings, today's workout, six top foods, the food log, a short body card. **Add foods** opens the full list. The camera button next to it appears only when photo estimates are set up.
- **Workout:** one open exercise at a time with sets, a target, and a rest timer.
- **Progress:** Body, Lifts and Friends. A section with no data yet is hidden or one line.
- **Plan:** targets and the program editor. Account (top-right initial) has sharing, steps, reminders and intake requests for the admin.

### Data model

- `profiles`: one row per person (`display_name`, `is_admin`). People can rename themselves but can't make themselves admin. Admin can only be set from SQL.
- `docs`: each person's data, keyed by `(user_id, coll, id)`, where `coll` is `days`, `workouts` or `settings`. RLS allows only `user_id = auth.uid()`. **Nobody, including the admin, can read someone else's docs.**
- `board`: weekly totals people chose to share (workouts, protein days, steps, strength change, latest session name). Everyone signed in can read it. Each person writes only their own rows. It never holds food, bodyweight or individual lifts.
- `intake_requests`: answers a new person sent so the admin can write a custom program.
- `ai_usage` and `use_ai()`: the daily allowance for photo estimates.
- `push_subs`: where to send each device's reminders. `step_tokens` and `log_steps()`: the iPhone Shortcut for automatic steps. This is the only function `anon` can call, and it checks a personal token itself.
- Progress photos live in a private `progress` storage bucket, in a folder named after the person's user id.

## Changing things

- **A screen or button:** edit the file for that area, and add the `data-act` branch in `events.js`. If you add a new file in `js/`, also add its `<script>` to `index.html` and to `SHELL` in `sw.js`. `check_syntax.js` fails if they disagree.
- **A coaching rule:** check the research first, then update `docs/EVIDENCE.md` and the `SOURCES` list in the app. Don't label a Practice rule as proven.
- **The database:** add a new file `supabase/migrations/YYYYMMDDHHMMSS_short_name.sql`. Never edit one that's been merged. Migrations must be re-runnable (`if not exists`, `drop policy if exists`). Every new table turns on RLS in the same migration and is granted to `authenticated` only, never `anon`. Then extend `tests/check_db.py` to prove who can and can't use it.
- **One-tap removals** (a food, an exercise) show a toast with Undo through `toast(msg, undoFn)`.
- **UI text:** plain, direct, short sentences. Say what to tap ("Tap **Build my plan**"), not how the code works.
- **Secrets:** only the publishable key and the *public* push key go in the repo. The `service_role` key, database password and API keys live in Supabase secrets or GitHub secrets.

## Tests

Run these before you push. CI runs the same ones on every PR.

```bash
node tests/check_syntax.js                  # every js/ file parses; index.html, js/ and sw.js agree on the file list
deno check supabase/functions/*/index.ts    # type-checks the Edge Functions (npx deno works too)
python3 tests/check_sql.py                  # migrations parse, RLS on every table, no anon grants (needs: pip install pglast)
python3 tests/check_db.py                   # runs migrations on a local Postgres 16+ and checks who can read or write what
python3 tests/smoke.py                      # headless browser: sign-in, intake, save, reload, all tabs (needs Playwright + Chromium)
```

- The smoke test uses `tests/mock-supabase.js`, a fake Supabase. If your feature needs a new Supabase call, add it there.
- New feature → add checks to `tests/smoke.py`. New table, policy or function → add checks to `tests/check_db.py`.
- CI also runs a secret scan. **Merge gate** passes only when every job passes, and it's the one check `main` requires.

## Pull requests and deploys

1. Open a PR from a branch. CI runs, labels are added from the files you changed, and Vercel posts a **preview URL**. Previews use the real Supabase project.
2. Write the description the way `CLAUDE.md` says: summary, why, what changed, database changes, security notes, testing (checked boxes only, with untested items as plain bullets under **Not tested**), deploy checklist, and known limitations.
3. The owner merges with **Create a merge commit**. Vercel deploys the app to production.
4. After CI passes on `main`, the **Deploy** workflow applies new migrations (`supabase db push`), turns off public sign-ups, sets the Site URL and redirect URLs, and makes `ADMIN_EMAIL` an admin. It also deploys the Edge Functions when the repo variable `DEPLOY_FUNCTIONS` is `true`. You can re-run it by hand under Actions → Deploy → Run workflow.

## One-time setup (owner)

1. **Vercel:** Add New → Project → import this repo → Framework preset **Other** → Deploy. There's no build command.
2. **GitHub → Settings → Secrets and variables → Actions:**
   - Secrets: `SUPABASE_ACCESS_TOKEN` (supabase.com → Account → Access Tokens), `SUPABASE_DB_PASSWORD`, `ADMIN_EMAIL`
   - Variables: `SUPABASE_PROJECT_ID`, `SITE_URL` (the Vercel production URL)
3. **GitHub → Settings → General → Pull Requests:** allow merge commits only. **Settings → Rules → Rulesets:** a ruleset on `main` that requires a pull request and the **Merge gate** check, with **Require linear history** off.
4. **Your account:** Supabase → Authentication → Users → Add user → Create new user (email and temporary password, **Auto Confirm User** checked). Run Actions → Deploy once so you become admin, sign in, and change the password from the round account button.

## Adding a person

Supabase → Authentication → Users → Add user → Create new user (with Auto Confirm checked). Send them the link and temporary password, and have them change it from the round account button. On first sign-in, a short set of questions builds a standard program and daily targets. They can edit both later under Plan.

To give them a custom program:
1. Their answers appear under **Intake requests** on your account page.
2. Tap **Copy for Claude**, paste it into Claude, and copy the program it writes.
3. Tap **Send program**, paste it, and tap **Send**.
4. Next time they open the app they see "Your new program is ready" and tap **Use it**. Their logs stay.

## Features people can turn on

- **The board:** weekly totals shared with the others. Turn it off with **Show me on the board** under your account. Turning it off deletes your rows.
- **Automatic steps:** under your account, tap **Set up automatic steps** and build the iPhone Shortcut. It sends your Apple Health steps with a personal token. **Make a new link** replaces the token. **Turn off** deletes it.
- **Progress photos:** under **Progress → Body**. Only you can open them, not even the admin. Deleting one is permanent.
- **Offline:** once you've opened the app online, it opens and logs with no signal. The status says **Offline · saved on this phone**, and everything sends when you're back online. Signing out clears the copy on the phone.

## Optional server features

Both stay hidden in the app until they're set up. Neither needs a code change.

### Deploying the server functions (needed for both)

1. In Supabase, go to **Account → Access Tokens** and make a token with **Edge Functions** (read and write) added.
2. In GitHub, replace the `SUPABASE_ACCESS_TOKEN` secret with it.
3. On the **Variables** tab, add `DEPLOY_FUNCTIONS` = `true`.
4. Run Actions → Deploy → Run workflow. After that, every deploy also deploys the functions.

### Photo food estimates

1. At console.anthropic.com, buy a small amount of credits (the minimum is $5) and leave auto-reload off. Credits are prepaid, so that balance is your spending cap. Create an API key.
2. In Supabase, go to **Edge Functions → Secrets** and add `ANTHROPIC_API_KEY`. Never put the key in the repo, in chat or in client code.
3. Deploy the functions (above) if you haven't.
4. Fully close and reopen the app. On Today, a **camera button** appears next to **Add foods**. Tap it, take a photo, add an optional one-line note (up to 60 characters), tap **Send**, check the estimate, and tap **Add to log**. **Add foods** also has **Snap or describe**, which takes a photo and/or a longer description.

Each person gets 20 estimates a day. Change that with a `FOOD_DAILY_LIMIT` secret, or pick another model with `FOOD_MODEL` (the default is `claude-sonnet-5-5`; `claude-haiku-5-5` is cheaper but less accurate on named menu items). The function lets the model search the web for a company's published nutrition numbers (up to 5 searches per estimate, billed by Anthropic per search). Add a `FOOD_SEARCH` secret set to `off` to stop that. If it fails, check Supabase → Edge Functions → `food-estimate` → **Logs**.

### Reminders

1. On any computer, run `npx web-push generate-vapid-keys`. It prints a public key and a private key.
2. In Supabase, go to **Edge Functions → Secrets** and add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:` plus your email) and `CRON_SECRET` (any long random text).
3. Put the **public** key in `config.js` as `vapidPublicKey` and merge that change. The private key never goes in the repo.
4. Deploy the functions (above) if you haven't.
5. In Supabase, go to **Database → Extensions** and turn on `pg_cron` and `pg_net`.
6. In the **SQL Editor**, run this once with your project ref and `CRON_SECRET` filled in:

   ```sql
   select cron.schedule('gj-reminders', '0 * * * *', $$
     select net.http_post(
       url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-reminders',
       headers := '{"x-cron-secret": "YOUR-CRON-SECRET"}'::jsonb
     )
   $$);
   ```

7. On your iPhone, open the app from the home screen, tap your initial, and tap **Turn on reminders**.

**Not getting notifications?** Open the home-screen app, tap your initial, and tap **Send a test** under Reminders. It shows what the push service answered. A refusal usually means `vapidPublicKey` in `config.js` doesn't match `VAPID_PRIVATE_KEY` in Supabase.

**Rest timer alert.** Once reminders are on, leaving the app while the rest timer runs sends a "Rest done" push when it ends. Coming back to the app cancels it. It uses the `rest-alert` function (deployed with the others, same VAPID secrets, no cron job). Supabase may stop background work after about 2.5 minutes on the free plan, so a rest longer than that may not alert.

## Troubleshooting

- **Blank screen or "Loading your data…" forever:** check the browser console. A script error in `js/` stops everything after it. Run `node tests/check_syntax.js`.
- **Your change doesn't show on the phone:** fully close and reopen the home-screen app. `sw.js` caches the app's files, and you should bump `CACHE` in it when the list of files changes.
- **A feature button is missing:** photo estimates and reminders stay hidden until set up. See **Optional server features**.
- **A migration fails in Deploy:** read the Deploy log in Actions. Fix it with a *new* migration file, not by editing the old one.
- **"Not saved yet…":** the phone is offline or Supabase didn't answer. The change is kept on the phone and retried.
