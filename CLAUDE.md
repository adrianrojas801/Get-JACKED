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
| `tests/` | `check_syntax.js`, `check_sql.py`, `smoke.py` with `mock-supabase.js` |
| `.github/workflows/` | `ci.yml` (every PR and `main`), `deploy.yml` (Supabase migrations and auth settings after CI passes on `main`) and `labeler.yml` (path labels on PRs) |
| `.github/labeler.yml` | Which paths get the `app`, `database`, `ci` and `docs` labels |
| `README.md` | Human setup guide |

## Architecture you must preserve

- **Single-file app, no framework, no build step.** Don't add a bundler, framework or npm dependencies unless the owner asks. External network calls go only to Supabase.
- **Data adapter:** `makeDb(uid)` in `index.html` makes Supabase look like the document store the UI was written for: `doc(path).get/set/update/onSnapshot` and `collection(name).onSnapshot`. Paths are `days/<YYYY-MM-DD>`, `workouts/<date>_<prog>` and `settings/main`. Keep the UI talking to this interface, not to Supabase directly.
- **Writes:** `set` means a full upsert. `update` means the `patch_doc` RPC (a top-level `jsonb ||` merge). Field-level edits must use the patch path so two devices don't overwrite each other.
- **Save pipeline:** `save()` / `flush()` / `pending{}` writes taps instantly, debounces typing by about 700 ms, writes one document at a time, retries once on `unavailable`, flushes on `pagehide`/`visibilitychange`, and shows "Not saved yet…" after 5 seconds. Snapshots for docs with pending writes are skipped. Don't regress any of this.
- **Loading:** show "Loading your data…" until days, workouts and settings have all arrived. Never render an empty Today screen that looks like lost data.
- **Sync:** Realtime on `public.docs`, filtered to `user_id`, plus a refetch on focus or when the app comes back online.

## Database and security rules

- **Every new table gets RLS turned on in the same migration.** "Automatically expose new tables" is turned off on this project, so add explicit `grant`s to `authenticated` only. Never grant to `anon`.
- `docs` is private per user (`user_id = auth.uid()`). **Admins must not be able to read other people's docs.** Anything shared between users, such as leaderboards, goes in a separate, read-only summary table or view that holds only what's meant to be shared.
- `profiles.is_admin` can only be set from SQL. Never let the client write it (`display_name` has its own column-level grant).
- `security definer` functions must pin `search_path` and revoke execute from `public` and `anon`.
- **Secrets:** only the publishable key goes in the repo. The secret / `service_role` key, the database password and any API keys (Anthropic, etc.) never go in the repo or client code. Server-side secrets live in Supabase Edge Function secrets or Vercel environment variables.
- Public sign-ups are disabled. Accounts are created in Supabase → Authentication → Users → Add user, with Auto Confirm on. Supabase's built-in email only reaches project team members, so don't build features that depend on emailing other people without setting up custom SMTP.

## Testing and CI

CI (`.github/workflows/ci.yml`) runs these on every PR. Run them locally before pushing:

```bash
node tests/check_syntax.js     # inline <script> + config.js syntax
python3 tests/check_sql.py     # migrations parse, RLS on every table, no anon grants, file naming
python3 tests/smoke.py         # headless sign-in, save, import, reload (mocked Supabase)
```

- `main`'s ruleset requires one check: **Merge gate**, which passes only when every other CI job passed. When you add a CI job, add it to the gate's `needs:` list, or it won't block merging.
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
- **No scheduled deloads.** Suggest an easier week only after a stall of 2+ weeks or when the person feels beat up.
- **Lean bulk:** aim for 0.25–0.5 lb a week on the 7-day weight average. Suggest calorie changes in ±150 steps. Protein target about 160 g. Track waist growth against weight gain.
- **Gym:** Planet Fitness (Smith machine, cable crossover, hack squat, dumbbells, machines). There's no free barbell rack, so suggest exercises that exist there.
- **Units:** pounds, inches, US formats.

## Writing style for UI text and docs

Plain, direct, short sentences. No hype or filler. Spell out what the user should do ("Tap **Import**"), not how the code works.

## Planned work (for context)

1. Photo food estimates through a Supabase Edge Function that holds the Anthropic key (per-user daily limit, a monthly spending limit set in the Console)
2. Per-user workout programs stored in `settings`, plus an intake form for new users
3. A leaderboard from a shared summary table (steps, protein days, workouts, strength percentage gains)
4. Steps sent automatically from an iOS Shortcut to a dedicated endpoint
