# CLAUDE.md

Instructions for any AI assistant working in this repo. Follow them exactly.

## Git and PR rules (non-negotiable)

- **Never add AI attribution anywhere.** No `Co-Authored-By` trailers, no session links, no "Generated with Claude Code" (or similar) lines. This applies to commits, PR titles and bodies, comments, and code. Commits are authored as the repo owner only.
- **Commit identity:** `Adrian Rojas <145087441+adrianrojas801@users.noreply.github.com>`, unsigned. The repo is public, so never use a personal email address.
- **Never force-push or rewrite pushed history.** Fix mistakes with a new commit or a new branch.
- **Never push to `main`.** Do each change on its own branch (`feat/...`, `fix/...`, `chore/...`) and open a PR. The owner merges with a **merge commit** (squash and rebase are turned off), so never rewrite a branch to tidy it up.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`), an imperative subject of 72 characters or fewer, and a body that explains *what* and *why* when it isn't obvious.
- **PR descriptions must be thorough**, written the way a real developer would write them, never bare-bones. Use this structure:
  1. **Summary**: what changed, in 2–3 sentences
  2. **Why**: the motivation
  3. **What's in this PR**: grouped by area (App / Data layer / Database / PWA / Dependencies)
  4. **Database changes**: tables, policies, grants and functions (a table works well), plus the new migration file's name
  5. **Security notes**: anything touching auth, RLS, keys or data exposure
  6. **Testing**: what was actually tested and how, as checked boxes (`- [x]`). Put anything untested under a **Not tested** sub-list of plain bullets.
  7. **Deploy checklist**: only steps that are still manual, as a numbered list (most deploys are automatic, see Deploys below)
  8. **Known limitations and follow-ups**
- **No unchecked boxes (`- [ ]`) anywhere in a PR.** GitHub shows them as "3 of 8 tasks", which makes a finished PR look unfinished. Use checked boxes for what was done, and plain bullets or numbered lists for everything else.
- Don't claim something was tested if it wasn't. List it under **Not tested**.

## What this is

**Get Jacked** is a private workout, food and bodyweight tracker for the owner and a few invited friends. It's a static web app (no build step) that installs to an iPhone home screen, backed by Supabase (Postgres, Auth, Realtime). It's hosted on Vercel: `main` deploys to production, and every branch gets a preview URL.

## Layout

| Path | What it is |
|---|---|
| `index.html` | The whole app: CSS, markup and vanilla JS in one file |
| `config.js` | Supabase project URL and **publishable** key (public by design) |
| `vendor/supabase.js` | supabase-js 2.119.0 browser build, kept in the repo (no CDN at runtime) |
| `manifest.webmanifest`, `icons/` | PWA name, colors and icons |
| `supabase/migrations/` | All schema changes, as `YYYYMMDDHHMMSS_short_name.sql` (`20261113000000_init.sql` is the base) |
| `supabase/config.toml` | Minimal CLI project file. Never run `supabase config push`: auth settings are managed by the Deploy workflow. |
| `tests/` | `check_syntax.js`, `check_sql.py`, `check_db.py` (with `db/supabase_shim.sql`), `smoke.py` with `mock-supabase.js` |
| `.github/workflows/` | `ci.yml` (every PR and `main`), `deploy.yml` (Supabase migrations and auth settings after CI passes on `main`) and `labeler.yml` (path labels on PRs) |
| `.github/labeler.yml` | Which paths get the `app`, `database`, `ci` and `docs` labels |
| `README.md` | Human setup guide |

## Architecture you must preserve

- **Single-file app, no framework, no build step.** Don't add a bundler, framework or npm dependencies unless the owner asks. External network calls go only to Supabase.
- **Data adapter:** `makeDb(uid)` in `index.html` makes Supabase look like the document store the UI was written for: `doc(path).get/set/update/onSnapshot` and `collection(name).onSnapshot`. Paths are `days/<YYYY-MM-DD>`, `workouts/<date>_<prog>` and `settings/main`. Keep the UI talking to this interface, not to Supabase directly.
- **Per-person programs:** each person's program lives in `settings/main` as `program = {days:{key:{t, ex:[{n,s,r,rest,ss?,note?}]}}, order, sched}` (`sched` is Sun–Sat, a day key or `'rest'`). Read it through `PROG()`, `dayOf()`, `titleOf()` and `schedOn()`, never a hard-coded program. New people get one from the intake form (`calcTargets` + `buildProgram`). `LEGACY_PROGRAM` is the owner's original program and is only used once by `ensureProgram()` to move him over (`settings.legacy = true` keeps his personal notes, food groups and cheat sheet). Never show legacy-only content to anyone else.
- **Custom programs:** the intake also sends open-ended answers to `intake_requests`. The admin's Account page lists them, **Copy for Claude** builds a prompt (`reqPrompt`) with the answers, the training rules and the JSON format (`PLAN_FORMAT`), and **Send program** checks the pasted JSON with `normPlan()` before sending. The person gets a "new program is ready" card and chooses **Use it**. Keep `reqPrompt`'s rules in line with the product rules below.
- **Shared helpers, use them instead of re-deriving:** lift math goes through `bestSet()`, `liftHistory()`, `bestOf()`, `stallOf()`, `isBest()` and `volumeOf()`; week totals through `weekStats()`, `streaks()` and `plannedPerWeek()`; every way of logging food through `addFood()`. Bodyweight lifts (no weight entered) are tracked by reps.
- **The board:** `publishBoard()` upserts two rows (this week and last) into `public.board` with four totals from `weekStats()` and `strengthGain()`. It talks to Supabase directly, like intake requests, because it isn't a doc. `settings.board === false` means the person opted out, and turning it off deletes their rows. Never add a column that exposes food, bodyweight or individual lifts.
- **Automatic steps:** Account → Automatic steps calls `new_steps_token()` and shows Shortcut instructions. The Shortcut posts to `/rest/v1/rpc/log_steps` with the publishable key and the token. The step count arrives through the normal Realtime sync.
- **Writes:** `set` means a full upsert. `update` means the `patch_doc` RPC (a top-level `jsonb ||` merge). Field-level edits must use the patch path so two devices don't overwrite each other.
- **Save pipeline:** `save()` / `flush()` / `pending{}` writes taps instantly, debounces typing by about 700 ms, writes one document at a time, retries once on `unavailable`, flushes on `pagehide`/`visibilitychange`, and shows "Not saved yet…" after 5 seconds. Snapshots for docs with pending writes are skipped. Don't regress any of this.
- **Loading:** show "Loading your data…" until days, workouts and settings have all arrived. Never render an empty Today screen that looks like lost data.
- **Sync:** Realtime on `public.docs`, filtered to `user_id`, plus a refetch on focus or when the app comes back online.

## Database and security rules

- **Every new table gets RLS turned on in the same migration.** "Automatically expose new tables" is turned off on this project, so add explicit `grant`s to `authenticated` only. Never grant to `anon`.
- `docs` is private per user (`user_id = auth.uid()`). **Admins must not be able to read other people's docs.** Anything shared between users, such as leaderboards, goes in a separate, read-only summary table or view that holds only what's meant to be shared.
- `intake_requests` is the one place an admin can read anything about another person: the setup answers they chose to send. Admins send a written program back only through `send_intake_plan()`, and the person applies it themselves (`mark_intake_applied()`). Never give admins a way to write into someone's `docs`.
- `board` holds the weekly totals people chose to share. Everyone signed in can read it; each person writes only their own rows.
- **The one anon exception is `log_steps()`.** An iOS Shortcut can't sign in, so this function is granted to `anon` and checks a personal token itself (only the hash is stored, in `step_tokens`). It can only set `steps` on one of the owner's day logs from the last week. `tests/check_sql.py` allows anon only for functions in `ANON_OK`; don't add to that list without a token check inside the function and tests in `check_db.py`.
- `profiles.is_admin` can only be set from SQL. Never let the client write it (`display_name` has its own column-level grant).
- `security definer` functions must pin `search_path` and revoke execute from `public` and `anon`.
- **Secrets:** only the publishable key goes in the repo. The secret / `service_role` key, the database password and any API keys (Anthropic, etc.) never go in the repo or client code. Server-side secrets live in Supabase Edge Function secrets or Vercel environment variables.
- Public sign-ups are disabled. Accounts are created in Supabase → Authentication → Users → Add user, with Auto Confirm on. Supabase's built-in email only reaches project team members, so don't build features that depend on emailing other people without setting up custom SMTP.

## Testing and CI

CI (`.github/workflows/ci.yml`) runs these on every PR. Run them locally before pushing:

```bash
node tests/check_syntax.js     # inline <script> + config.js syntax
python3 tests/check_sql.py     # migrations parse, RLS on every table, no anon grants, definer functions locked down, naming
python3 tests/check_db.py      # runs migrations twice on a local Postgres and checks who can read/write what
python3 tests/smoke.py         # headless sign-in, intake, editor, save, reload (mocked Supabase)
```

- `main`'s ruleset requires one check: **Merge gate**, which passes only when every other CI job passed. When you add a CI job, add it to the gate's `needs:` list, or it won't block merging.
- When you add a table, policy or function, **extend `tests/check_db.py`** to prove who can and can't use it.
- When you add a feature, **extend `tests/smoke.py`** (and `tests/mock-supabase.js` if you need new Supabase calls) to cover it.
- Migrations must be re-runnable (`if not exists`, `drop policy if exists`) and must never be edited after they've been merged. Add a new file instead.
- Put what was tested, and what wasn't, in the PR's Testing section.

## Deploys (automatic)

- **App:** Vercel's Git integration. `main` goes to production, and every branch/PR gets a preview URL. Previews use the production Supabase project, so don't test destructive data changes on previews.
- **Database and auth:** `deploy.yml` runs after CI passes on `main` (or by hand). It applies migrations with `supabase db push`, sets `disable_signup`, `site_url` and `uri_allow_list` through the Management API, and grants admin to `ADMIN_EMAIL`.
- Required GitHub settings: secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `ADMIN_EMAIL`. Variables `SUPABASE_PROJECT_ID`, `SITE_URL`.
- A PR's **Deploy checklist** should only list steps that are still manual, such as a new secret to add. Write "None, fully automatic" when there aren't any.

Local preview: `python3 -m http.server 8000` from the repo root.

## Product rules (training logic is evidence-based, so keep it consistent)

- **Progression (double progression):** when the last session hit the top of the rep range on every set, suggest adding weight. Otherwise, suggest the same weight plus a rep. Log working sets only, not warm-ups.
- **Effort:** most sets 0–2 reps short of failure. Isolation exercises can go to failure, and a drop set on the last set of an isolation exercise is fine. Heavy Smith lifts stay 1–2 reps short of failure.
- **Rest:** 2–3 minutes on compounds, at least 90 seconds on isolation. Rests inside a superset can be shorter.
- **No scheduled deloads.** Suggest an easier week only after a stall of 2+ weeks or when the person feels beat up. A stall is 3+ sessions and 2+ weeks without beating the lift's best (`stallOf`); the suggestion is about 10% off, then build back up.
- **Goals** (from the intake, `settings.profile.goal`). Suggest calorie changes in ±150 steps for all of them.
  - **Lean bulk:** aim for 0.25–0.5 lb a week on the 7-day weight average. Track waist growth against weight gain. (The owner's protein target is about 160 g.)
  - **Cut:** lose about 0.5–1% of body weight a week. Protein about 1 g per lb. Keep lifting heavy.
  - **Maintain:** keep the 7-day average within about a pound of the start.
- **Intake targets:** Mifflin-St Jeor × activity (1.4 / 1.55 / 1.75, which already counts the lifting), then +250 bulk, −400 cut, 0 maintain, rounded to 50, with a floor of 1,600 (men) / 1,300 (women). Protein 0.9 g/lb (1 g/lb on a cut), capped at 220 g.
- **Generated programs:** 3 days = full body A/B/C, 4 = upper/lower ×2, 5 = upper, lower, push, pull, legs, 6 = push/pull/legs ×2. Compounds first, about 10–20 sets per muscle a week. People lifting under a year get at most 3 sets per exercise and 7 exercises per day.
- **Gym:** Planet Fitness (Smith machine, cable crossover, hack squat, dumbbells, machines). There's no free barbell rack, so suggest exercises that exist there.
- **Units:** pounds, inches, US formats.

## Writing style for UI text and docs

Plain, direct, short sentences. No hype or filler. Spell out what the user should do ("Tap **Build my plan**"), not how the code works.

## Planned work (for context)

1. Photo food estimates through a Supabase Edge Function that holds the Anthropic key (per-user daily limit, a monthly spending limit set in the Console)
2. ~~Per-user workout programs stored in `settings`, plus an intake form for new users~~ (done)
3. ~~A leaderboard from a shared summary table (steps, protein days, workouts, strength percentage gains)~~ (done: the board)
4. ~~Steps sent automatically from an iOS Shortcut to a dedicated endpoint~~ (done: `log_steps`)
