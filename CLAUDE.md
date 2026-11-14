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
| `index.html` | The page shell: header, tab bar, and the `<script>` tags that load the app in order |
| `css/app.css` | All styles |
| `js/*.js` | The app, split by area and loaded in this order: `program`, `core`, `training`, `shared`, `today`, `workout`, `progress`, `plan`, `events`, `app`. Each file says what it holds at the top. |
| `supabase/functions/` | Edge Functions: `food-estimate` (photo food estimates) and `send-reminders` (push reminders). Deployed only when the repo variable `DEPLOY_FUNCTIONS` is `true`. |
| `docs/EVIDENCE.md` | The research or practice behind every coaching rule |
| `sw.js` | Service worker that keeps the app's own files on the phone so it opens offline |
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

- **No framework, no build step.** The app is plain scripts in `js/`, loaded in order by `index.html`, sharing one global scope. Put new code in the file for its area, or add a file (then add it to `index.html` and to `SHELL` in `sw.js`; `check_syntax.js` fails if they disagree). Code that runs at load time can only use what earlier files define. Don't add a bundler, framework or npm dependencies unless the owner asks. External network calls go only to Supabase.
- **Data adapter:** `makeDb(uid)` in `js/app.js` makes Supabase look like the document store the UI was written for: `doc(path).get/set/update/onSnapshot` and `collection(name).onSnapshot`. Paths are `days/<YYYY-MM-DD>`, `workouts/<date>_<prog>` and `settings/main`. Keep the UI talking to this interface, not to Supabase directly.
- **Per-person programs:** each person's program lives in `settings/main` as `program = {days:{key:{t, ex:[{n,s,r,rest,ss?,note?}]}}, order, sched}` (`sched` is Sun–Sat, a day key or `'rest'`). Read it through `PROG()`, `dayOf()`, `titleOf()` and `schedOn()`, never a hard-coded program. New people get one from the intake form (`calcTargets` + `buildProgram`). `LEGACY_PROGRAM` is the owner's original program and is only used once by `ensureProgram()` to move him over (`settings.legacy = true` keeps his personal notes, food groups and cheat sheet). Never show legacy-only content to anyone else.
- **Custom programs:** the intake also sends open-ended answers to `intake_requests`. The admin's Account page lists them, **Copy for Claude** builds a prompt (`reqPrompt`) with the answers, the training rules and the JSON format (`PLAN_FORMAT`), and **Send program** checks the pasted JSON with `normPlan()` before sending. The person gets a "new program is ready" card and chooses **Use it**. Keep `reqPrompt`'s rules in line with the product rules below.
- **Shared helpers, use them instead of re-deriving:** lift math goes through `bestSet()`, `liftHistory()`, `bestOf()`, `stallOf()`, `isBest()` and `volumeOf()`; week totals through `weekStats()`, `streaks()` and `plannedPerWeek()`; every way of logging food through `addFood()`. Bodyweight lifts (no weight entered) are tracked by reps.
- **Targets:** `targetFor(last, ex, stall)` is the one place that decides what to aim for today (double progression, stall back-off). The Workout tab shows it, uses it as the placeholders, and Done on an empty set logs it. The weight to add comes from `jumpFor()`: the exercise's `inc` in the program, else 10 lbs on Smith lifts and 5 elsewhere.
- **Weekly advice:** `weightTrend(end)` gives the weight verdict and calorie change for the current goal; `calButton()` allows one change a week (`settings.calAdj`). `checkinCard()` builds the weekly check-in from `weekStats()`, `weightTrend()` and `liftsMoved()`; `settings.checkin` holds the week it was last dismissed.
- **Goal phases:** `settings.profile.goal` is the phase and `settings.phaseStart` its start date. `nextPhases()` works out the targets for the next phase from the current ones with `GOAL_ADJ`, and is only offered once `goalReached()`.
- **Muscles:** `muscleWork(end)` counts hard sets per muscle from `musFor()`. `settings.focus` is the list of focus muscle keys. It is set from the person's goals, never left for them to discover: `focusFrom()` reads the intake's "what do you want to improve" answer, a written program can carry `"focus"`, and `ensureFocus()` fills it once for anyone who predates this (the owner gets `LEGACY_FOCUS`). After that the stars are theirs to change. Only focus muscles are flagged under 10 sets; others only under 4.
- **Offline:** `sw.js` caches the app's own files (network-first, same-origin GETs only; bump `CACHE` when the file list changes). `keepCopy()`/`openCopy()` keep the last synced data in localStorage per person, and `keepOutbox()` keeps unsent writes. `dbErr()` returns `offline` for network failures; `flush()` then calls `hold()` instead of `fail()`, and the write is retried on a timer and when the phone comes back online. Supabase is still the source of truth: its snapshot replaces the copy. Never cache Supabase responses in the service worker.
- **The board:** `publishBoard()` upserts two rows (this week and last) into `public.board` with totals from `weekStats()` and `strengthGain()`, the planned workout count, and the name and day of the latest session (`buddyLine()` and `teamGoal()` read those). It talks to Supabase directly, like intake requests, because it isn't a doc. `settings.board === false` means the person opted out, and turning it off deletes their rows. Never add a column that exposes food, bodyweight or individual lifts.
- **Automatic steps:** Account → Automatic steps calls `new_steps_token()` and shows Shortcut instructions. The Shortcut posts to `/rest/v1/rpc/log_steps` with the publishable key and the token. The step count arrives through the normal Realtime sync.
- **Screens:** Today is a dashboard (rings, workout card, six `topFoods()` buttons, the log, a short body card). The full food list and its editor live in `foodSheet()`, shown when `S.sheet === 'foods'`; sheets render inside `#app` so the one click handler still works. Every food button reads its list from `FOOD_SRC`. Workout shows one open exercise (`exCard()`, `S.exOpen`, `nextOpen()`); the set you're on uses `setDefault()` for what an empty field means. Progress is three sections (`S.psec`: body, lifts, friends). Plan holds targets and the program; rules and food tips sit in a folded "How this works".
- **Undo:** anything removed with one tap (a logged food, a quick-add food, an exercise) calls `toast(msg, undoFn)` through `undoDay` / `undoSettings` / `undoWorkout`. Do the same for new one-tap removals.
- **Muscle figure:** `bodySVG(lv, cls, opts)` draws half a body and mirrors it. Muscle keys are in `MUS_NAME`; `MUS_RULES` maps exercise names to main and helping muscles (first match wins, so specific patterns go first). A new muscle needs a key, a path in `bodySVG`, and at least one rule.
- **Suggestions:** `suggestions()` proposes program changes (more sets or a new lift for a focus muscle whose *planned* sets are under 10; a swap for a lift stalled 4+ weeks). They only change the program when the person taps **Do it**, always with Undo. New lifts come from `MOVES`, which must only hold exercises the gym has and that `musFor()` maps to that muscle (the smoke test checks this).
- **Measurements and photos:** tape measurements are fields on the day doc (`MEAS`). Progress photos are files in the private `progress` storage bucket under `<user id>/<date>_<pose>_<time>.jpg`, shrunk in the browser by `shrinkImage()`.
- **Head to head:** `weekScore()` scores one week's board rows with the categories in `H2H`. It reads the board; it must not need anything the board doesn't already share.
- **Optional server features:** photo estimates (`probeEstimates()` → `edgeSampler()` → the `food-estimate` function) and reminders (`remindersCard()`, `push_subs`, the `send-reminders` function, the `push` handler in `sw.js`). Both stay hidden until configured: estimates until the function answers `{ready:true}`, reminders until `config.js` has `vapidPublicKey`. Keep them hidden-by-default; never show a button that can't work.
- **Design rules:**
  - Advice always uses the coach style: build it with `coachOpen(title)` (check-in, suggestions, phase change, new program, the setup checklist). Don't invent another highlighted card.
  - Keep cards to numbers and actions. Put the explanation behind the (i) button with `titled(id, title, text)`.
  - A section with nothing in it yet is left out or shrunk to one line (Waist, Measurements, Last 7 days, Lifts, the board, head to head, Photos). When you add a card, decide what it does with no data.
  - `firstStepsCard()` is the only onboarding: a checklist on Today that disappears when the basics are done or on Hide (`settings.welcomed`).
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
- Progress photos are private per person through `storage.objects` policies keyed on the folder name. Admins can't open them. Don't add a policy that widens that.
- `use_ai()` is the daily allowance for AI calls. The Edge Function passes the limit; a person calling it directly can only use up their own.
- `send-reminders` runs with the service role and may read only what it needs to decide whether to nudge (today's weight, the schedule, whether a workout is logged). It must never return a person's data to its caller.
- **Secrets:** only the publishable key and the *public* push key (`vapidPublicKey`) go in the repo. The secret / `service_role` key, the database password and any API keys (Anthropic, etc.) never go in the repo or client code. Server-side secrets live in Supabase Edge Function secrets or Vercel environment variables.
- Public sign-ups are disabled. Accounts are created in Supabase → Authentication → Users → Add user, with Auto Confirm on. Supabase's built-in email only reaches project team members, so don't build features that depend on emailing other people without setting up custom SMTP.

## Testing and CI

CI (`.github/workflows/ci.yml`) runs these on every PR. Run them locally before pushing:

```bash
node tests/check_syntax.js     # every js/ file, config.js and sw.js; index.html, js/ and sw.js must agree on the file list
deno check supabase/functions/*/index.ts   # type-checks the Edge Functions (npx deno works too)
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

**Every rule here has its backing listed in `docs/EVIDENCE.md`**, marked Research or Practice. Before changing a rule or adding one, check the research, update that file, and keep the app's "Where the rules come from" list (`SOURCES`) in step. Don't present a Practice rule in the UI as proven.

- **Progression (double progression):** when the last session hit the top of the rep range on every set, add the exercise's jump and start again at the bottom of the range. Otherwise, the same weight plus one rep on the first set that isn't at the top. Log working sets only, not warm-ups.
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
- **Phases:** when the 7-day average reaches the goal weight, offer the next phase. After a bulk: a 6–8 week mini-cut (maintenance −400, 1 g/lb protein, goal about 5% lighter) or keep bulking (+5 lbs). After a cut: hold (maintenance) or lean bulk (+250, goal +8 lbs).
- **Volume:** about 10–20 hard sets a week for focus muscles. Main muscles count a full set, helping muscles half. Growth still happens from about 4 sets, so don't call 5–9 sets "low" for a muscle that isn't a focus.
- **Units:** pounds, inches, US formats.

## Writing style for UI text and docs

Plain, direct, short sentences. No hype or filler. Spell out what the user should do ("Tap **Build my plan**"), not how the code works.

## Planned work (for context)

1. ~~Photo food estimates through a Supabase Edge Function that holds the Anthropic key~~ (built; off until the owner adds the key, see README)
2. ~~Per-user workout programs stored in `settings`, plus an intake form for new users~~ (done)
3. ~~A leaderboard from a shared summary table (steps, protein days, workouts, strength percentage gains)~~ (done: the board)
4. ~~Steps sent automatically from an iOS Shortcut to a dedicated endpoint~~ (done: `log_steps`)
