"""Runs every migration (twice, to prove they're re-runnable) on a throwaway local Postgres
with a small Supabase stand-in, then checks the access rules as different people.

Needs PostgreSQL 16+ binaries (preinstalled on GitHub's ubuntu-latest). Set PG_BIN to override.
"""
import glob, os, pathlib, shutil, subprocess, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
BIN = os.environ.get("PG_BIN") or (sorted(glob.glob("/usr/lib/postgresql/*/bin")) or [""])[-1]
RESULTS = []
A, B, ADMIN = ("00000000-0000-0000-0000-00000000000" + c for c in "abc")


def tool(name):
    path = shutil.which(name, path=BIN) or shutil.which(name)
    if not path:
        sys.exit(f"Can't find {name}. Install PostgreSQL or set PG_BIN.")
    return path


def check(ok, name):
    RESULTS.append((bool(ok), name))
    print(("PASS  " if ok else "FAIL  ") + name)


def main():
    tmp = tempfile.mkdtemp(prefix="gjdb-")
    os.chmod(tmp, 0o777)
    data, sock = os.path.join(tmp, "data"), tmp
    as_pg = [] if os.geteuid() else ["runuser", "-u", "postgres", "--"]  # initdb refuses to run as root
    subprocess.run(as_pg + [tool("initdb"), "-D", data, "-U", "postgres", "-A", "trust"], check=True, capture_output=True)
    # -l sends the server's output to a file; otherwise the server holds our pipe open and this never returns.
    subprocess.run(as_pg + [tool("pg_ctl"), "-D", data, "-l", os.path.join(tmp, "server.log"),
                            "-o", f"-k {sock} -c listen_addresses=''", "-w", "start"],
                   check=True, capture_output=True, timeout=60)
    try:
        def psql(sql, user=None, ok=True):
            """Run SQL as the postgres superuser, or as `authenticated` with the given user id."""
            if user:
                sql = (f"begin; set local role authenticated; "
                       f"select set_config('request.jwt.claim.sub', '{user}', true); {sql}; commit;")
            r = subprocess.run([tool("psql"), "-h", sock, "-U", "postgres", "-d", "postgres", "-X", "-q", "-t", "-A",
                                "-v", "ON_ERROR_STOP=1", "-c", sql], capture_output=True, text=True)
            if ok and r.returncode:
                raise RuntimeError(r.stderr.strip())
            return r

        def val(sql, user=None):
            out = psql(sql, user).stdout.strip().splitlines()
            return out[-1] if out else ""

        def fails(sql, user):
            return psql(sql, user, ok=False).returncode != 0

        psql((ROOT / "tests/db/supabase_shim.sql").read_text())
        migrations = sorted((ROOT / "supabase/migrations").glob("*.sql"))
        for _ in range(2):
            for m in migrations:
                psql(m.read_text())
        check(True, f"All {len(migrations)} migrations run twice without errors")

        # Sign-ups: Supabase's auth service inserts users as supabase_auth_admin; the trigger makes profiles.
        for uid, email in [(A, "a@x.com"), (B, "b@x.com"), (ADMIN, "admin@x.com")]:
            psql(f"set role supabase_auth_admin; insert into auth.users (id, email) values ('{uid}', '{email}')")
        check(val("select count(*) from public.profiles") == "3", "New sign-ups still get a profile (trigger works)")
        psql(f"update public.profiles set is_admin = true where id = '{ADMIN}'")

        # Private logs stay private, even from the admin.
        psql("insert into public.docs (coll, id, data) values ('days', '2026-11-14', '{\"weight\":170}')", A)
        check(val("select count(*) from public.docs", ADMIN) == "0", "Admin can't read anyone else's logs")
        check(fails("select public.handle_new_user()", A), "Nobody can call the sign-up trigger function directly")

        # Intake requests.
        psql("insert into public.intake_requests (answers) values ('{\"routine\":\"bench 3x8\"}')", A)
        req = val(f"select id from public.intake_requests where user_id = '{A}'")
        check(len(req) == 36, "A person can send their intake answers")
        check(fails(f"insert into public.intake_requests (user_id, answers) values ('{B}', '{{}}')", A),
              "Nobody can file a request as someone else")
        check(fails("insert into public.intake_requests (answers, status, plan) values ('{}', 'sent', '{}')", A),
              "Nobody can set a plan or status when filing")
        check(fails(f"update public.intake_requests set answers = '{{}}' where id = '{req}'", A),
              "Requests can't be edited directly")
        check(val("select count(*) from public.intake_requests", B) == "0", "Other people can't see someone's request")
        check(val("select count(*) from public.intake_requests", ADMIN) == "1", "The admin sees requests")
        names = val("select string_agg(display_name, ',' order by display_name) from public.profiles", ADMIN)
        check(names == "a,admin,b", "The admin can see names to match requests to people")

        plan = '{"program":{"days":{"a":{"t":"Upper","ex":[]}},"order":["a"],"sched":["rest","a","rest","rest","rest","rest","rest"]}}'
        check(fails(f"select public.send_intake_plan('{req}', '{plan}')", B), "Only the admin can send a program")
        check(fails(f"select public.send_intake_plan('{req}', '{{\"program\":{{}}}}')", ADMIN),
              "A program without days is rejected")
        psql(f"select public.send_intake_plan('{req}', '{plan}')", ADMIN)
        check(val(f"select status from public.intake_requests where id = '{req}'", A) == "sent",
              "The admin can send a program and the person sees it")
        psql(f"select public.mark_intake_applied('{req}')", B)
        check(val(f"select status from public.intake_requests where id = '{req}'", A) == "sent",
              "Other people can't mark someone's program as applied")
        psql(f"select public.mark_intake_applied('{req}')", A)
        check(val(f"select status from public.intake_requests where id = '{req}'", A) == "applied",
              "The person can mark their program as applied")
        check(psql("set role anon; select count(*) from public.intake_requests", ok=False).returncode != 0,
              "Signed-out visitors (anon) can't read requests")
        # The board: shared weekly totals.
        row = "(week, name, workouts, protein_days, steps, strength) values ('2026-11-08', 'a', 4, 5, 8200, 2.5)"
        psql(f"insert into public.board {row}", A)
        check(val("select name || ':' || workouts from public.board", B) == "a:4", "Everyone signed in can read the board")
        check(fails(f"insert into public.board (user_id, week, name) values ('{A}', '2026-11-01', 'fake')", B),
              "Nobody can post to the board as someone else")
        psql("update public.board set workouts = 14", B)
        psql("delete from public.board", B)
        check(val("select workouts from public.board", A) == "4", "Nobody can change or remove someone else's board row")
        check(fails("insert into public.board (week, name, workouts) values ('2026-11-01', 'a', 99)", A)
              and fails("insert into public.board (week, name, steps) values ('2026-11-01', 'a', 9999999)", A),
              "Board totals outside sensible ranges are rejected")
        psql("update public.board set workouts = 5", A)
        psql("delete from public.board", A)
        check(val("select count(*) from public.board", B) == "0", "A person can update and remove their own board rows")
        check(psql("set role anon; select count(*) from public.board", ok=False).returncode != 0,
              "Signed-out visitors (anon) can't read the board")
        # Automatic steps: a personal link token that can only set a step count.
        tok = val("select public.new_steps_token()", A)
        check(len(tok) == 64 and val("select count(*) from public.step_tokens", B) == "0",
              "A person can make a steps link, and nobody else sees it exists")
        check(fails("select token_hash from public.step_tokens", A), "The stored token can't be read back")
        check(fails(f"insert into public.step_tokens (user_id, token_hash) values ('{B}', 'x')", B),
              "Tokens can only be made through the function")
        anon = lambda sql: psql(f"set role anon; {sql}", ok=False)
        psql("insert into public.docs (coll, id, data) values ('days', current_date::text, '{\"weight\":171}') "
             "on conflict (user_id, coll, id) do update set data = excluded.data", A)
        today = f"from public.docs where user_id = '{A}' and id = current_date::text"
        check(anon(f"select public.log_steps('{tok}', 9123)").returncode == 0 and val(f"select data ->> 'steps' {today}") == "9123",
              "The Shortcut (signed out, with the token) can set today's steps")
        check(val(f"select data ->> 'weight' {today}") == "171", "Setting steps keeps the rest of that day's log")
        check(anon(f"select public.log_steps('{tok}', 300, (current_date - 1))").returncode == 0
              and val(f"select data ->> 'steps' from public.docs where user_id = '{A}' and id = (current_date - 1)::text") == "300",
              "It can also fill in a day that has no log yet")
        check(anon("select public.log_steps('" + "0" * 64 + "', 5000)").returncode != 0, "A wrong token is rejected")
        check(anon(f"select public.log_steps('{tok}', -5)").returncode != 0
              and anon(f"select public.log_steps('{tok}', 5000, '2020-01-01')").returncode != 0,
              "Bad step counts and old dates are rejected")
        check(anon("select count(*) from public.docs").returncode != 0 and anon("select public.new_steps_token()").returncode != 0,
              "Signed-out callers still can't read logs or make tokens")
        tok2 = val("select public.new_steps_token()", A)
        check(anon(f"select public.log_steps('{tok}', 1)").returncode != 0 and anon(f"select public.log_steps('{tok2}', 7000)").returncode == 0,
              "Making a new link turns the old one off")
        psql("delete from public.step_tokens", A)
        check(anon(f"select public.log_steps('{tok2}', 1)").returncode != 0, "Turning automatic steps off kills the link")
    except Exception as e:  # a setup step failed
        check(False, f"Database test setup: {e}")
    finally:
        subprocess.run(as_pg + [tool("pg_ctl"), "-D", data, "-m", "immediate", "stop"], capture_output=True)
        shutil.rmtree(tmp, ignore_errors=True)

    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a") as f:
            f.write("### Database rules\n\n" + "\n".join(f"- {'✅' if ok else '❌'} {n}" for ok, n in RESULTS) + "\n")
    sys.exit(0 if RESULTS and all(ok for ok, _ in RESULTS) else 1)


main()
