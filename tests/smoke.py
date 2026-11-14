"""Headless smoke test: sign-in, intake, program editor, account page, save, migration, reload.
Runs against tests/mock-supabase.js."""
import asyncio, datetime, json, os, pathlib, sys
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
MOCK = (ROOT / "tests" / "mock-supabase.js").read_text()
URL = (ROOT / "index.html").as_uri()
RESULTS = []


def check(ok, name):
    """Record one checklist item; stop the test on the first failure."""
    RESULTS.append((bool(ok), name))
    print(("PASS  " if ok else "FAIL  ") + name)
    if not ok:
        raise AssertionError(name)


def write_summary(errors):
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not path:
        return
    lines = ["### Smoke test", ""] + [f"- {'✅' if ok else '❌'} {name}" for ok, name in RESULTS]
    lines.append(f"- {'❌' if errors else '✅'} No JavaScript errors on the page")
    with open(path, "a") as f:
        f.write("\n".join(lines) + "\n")


async def new_page(browser, errors, seed=None, board=None):
    ctx = await browser.new_context(viewport={"width": 390, "height": 844})
    for key, rows in (("mockdocs", seed), ("mockboard", board)):
        if rows is not None:
            await ctx.add_init_script(f"if(!sessionStorage.getItem('{key}'))sessionStorage.setItem('{key}',{json.dumps(json.dumps(rows))})")
    page = await ctx.new_page()
    page.on("pageerror", lambda e: errors.append(str(e)))
    await page.route("**/vendor/supabase.js", lambda r: r.fulfill(body=MOCK, content_type="text/javascript"))
    await page.route("https://fonts.googleapis.com/**", lambda r: r.abort())
    await page.route("https://fonts.gstatic.com/**", lambda r: r.abort())
    return page


async def sign_in(page):
    await page.fill("#lem", "test@example.com"); await page.fill("#lpw", "pw12345678")
    await page.click("#lbtn"); await page.wait_for_timeout(700)


async def settings(page):
    return await page.evaluate("window.__docs['settings/main']||{}")


async def main():
    errors = []
    async with async_playwright() as p:
        browser = await p.chromium.launch()

        # ---- a new person ----
        page = await new_page(browser, errors)
        await page.goto(URL); await page.wait_for_timeout(400)
        check(await page.evaluate("document.body.classList.contains('signedout')"), "Opens on the sign-in screen")

        await page.fill("#lem", "test@example.com"); await page.fill("#lpw", "wrong")
        await page.click("#lbtn"); await page.wait_for_timeout(200)
        check("Wrong email or password" in await page.inner_text("#aerr"), "Wrong password shows an error")

        await page.fill("#lpw", "pw12345678"); await page.click("#lbtn"); await page.wait_for_timeout(700)
        check(not await page.evaluate("document.body.classList.contains('signedout')"), "Correct password signs in")
        check("Saved" in await page.inner_text("#status"), "Data finishes loading")

        check("set up your plan" in (await page.inner_text("#app")).lower()
              and not await page.is_visible("#nav"), "New person sees the intake form, without the tabs")
        await page.click("#me"); await page.wait_for_timeout(150)
        check("Sign out" in await page.inner_text("#app"), "Account menu opens during setup (so you can sign out)")
        await page.click("button[data-act=meback]"); await page.wait_for_timeout(150)
        await page.click("button[data-act=intake]"); await page.wait_for_timeout(150)
        check("Fill in" in await page.inner_text("#in_err"), "Intake asks for missing answers")

        await page.select_option("#in_sex", "m"); await page.fill("#in_age", "23")
        await page.fill("#in_ft", "5"); await page.fill("#in_inch", "10"); await page.fill("#in_wt", "170")
        await page.select_option("#in_goal", "cut"); await page.select_option("#in_act", "low")
        await page.select_option("#in_days", "4"); await page.select_option("#in_exp", "new")
        await page.fill("#in_routine", "Mon: bench 3x8 at 185, rows 3x10"); await page.fill("#in_focus", "Bigger chest")
        await page.click("button[data-act=intake]"); await page.wait_for_timeout(300)
        reqs = await page.evaluate("window.__reqs")
        check(len(reqs) == 1 and reqs[0]["answers"]["routine"].startswith("Mon: bench") and reqs[0]["answers"]["goal"]
              and "intakePending" not in await settings(page), "Intake answers are sent as a request")
        s = await settings(page)
        prog = s.get("program", {})
        check(len(prog.get("order", [])) == 4 and prog["sched"][1] == "upA"
              and all(e["s"] <= 3 for d in prog["days"].values() for e in d["ex"]),
              "Intake builds a 4-day program (3 sets max for a newer lifter)")
        # 170 lb, 5'10", 23, male, desk: BMR ≈ 1775, ×1.4 ≈ 2485, −400 → 2100. Protein 1 g/lb on a cut → 170.
        check(s.get("cal") == 2100 and s.get("pro") == 170 and s.get("goal") == 160 and not s.get("legacy"),
              "Intake sets calorie, protein and goal-weight targets")
        check(await page.is_visible("#nav") and "Your plan is ready" in await page.inner_text("#app"),
              "Tabs come back after the intake")

        await page.click("button[data-act=preset]")
        await page.fill("input[data-day=weight]", "170.2"); await page.wait_for_timeout(1500)
        docs = await page.evaluate("JSON.stringify(window.__docs)")
        check("170.2" in docs and '"food":[{' in docs, "Quick-add food and weight save")

        await page.click("nav button[data-tab=plan]"); await page.wait_for_timeout(200)
        check("Mom" not in await page.inner_text("#app") and "Pozole" not in await page.inner_text("#app"),
              "Plan tab has none of Pablo's personal notes")
        await page.click("details.pday summary")
        await page.fill("input[data-pd=upA][data-pe='0'][data-pf=n]", "DB bench press")
        await page.select_option("select[data-sched='3']", "loB"); await page.wait_for_timeout(1000)
        s = await settings(page)
        check(s["program"]["days"]["upA"]["ex"][0]["n"] == "DB bench press" and s["program"]["sched"][3] == "loB",
              "Program editor saves an exercise rename and a split change")
        await page.click("button[data-act=pexadd][data-k=upA]"); await page.wait_for_timeout(200)
        s = await settings(page)
        check(s["program"]["days"]["upA"]["ex"][-1]["n"] == "New exercise", "Program editor adds an exercise")

        await page.click("nav button[data-tab=workout]"); await page.wait_for_timeout(200)
        await page.select_option("#wprog", "upA"); await page.wait_for_timeout(200)
        check("db bench press" in (await page.inner_text("#app")).lower(), "Workout uses the edited program")

        await page.click("nav button[data-tab=plan]"); await page.wait_for_timeout(200)
        check("Copy all data" not in await page.inner_text("#app") and "Sign out" not in await page.inner_text("#app"),
              "Account and backup are no longer in Plan")
        await page.click("#me"); await page.wait_for_timeout(200)
        app = await page.inner_text("#app")
        check((await page.inner_text("#me")).upper() == "P" and "Sign out" in app and "Copy all data" in app,
              "Header button opens Account & data (account, backup)")
        await page.wait_for_timeout(200)
        app = await page.inner_text("#app")
        check("intake requests" in app.lower() and "pablo" in app and "· New" in app, "Admin sees the intake request")
        prompt = await page.evaluate("reqPrompt(window.__reqs[0], 'pablo')")
        check("Mon: bench 3x8 at 185" in prompt and "Bigger chest" in prompt and "Planet Fitness" in prompt
              and '"sched"' in prompt, "Copy for Claude includes the answers, the rules and the format")
        await page.click("button[data-act=reqcopy]"); await page.wait_for_timeout(300)
        app = await page.inner_text("#app")
        check("Copied ✓" in app or "Couldn’t copy automatically" in app, "Copy for Claude copies, or shows the text to copy")
        await page.click("button[data-act=reqopen]"); await page.fill("#reqplan", "here you go: not a program")
        await page.click("button[data-act=reqsend]"); await page.wait_for_timeout(200)
        check("has a problem" in await page.inner_text("#app") and (await page.evaluate("window.__reqs"))[0]["status"] == "new",
              "A bad program is rejected with a message")
        plan = {"program": {"days": {"a": {"t": "Chest day", "ex": [{"n": "Incline Smith press", "s": 4, "r": "6-10", "rest": 150}]},
                                     "b": {"t": "Leg day", "ex": [{"n": "Hack squat", "s": 3, "r": "8-12", "rest": 180}]}},
                            "order": ["a", "b"], "sched": ["rest", "a", "b", "rest", "a", "b", "rest"]},
                "presets": [{"g": "Meals", "n": "Chipotle bowl", "c": 650, "p": 45}], "cal": 2300}
        await page.fill("#reqplan", "Here it is:\n```json\n" + json.dumps(plan) + "\n```")
        await page.click("button[data-act=reqsend]"); await page.wait_for_timeout(300)
        reqs = await page.evaluate("window.__reqs")
        check(reqs[0]["status"] == "sent" and reqs[0]["plan"]["program"]["order"] == ["a", "b"] and "Sent ✓" in await page.inner_text("#app"),
              "Admin sends a program back (pasted with extra text around it)")

        await page.reload(); await page.wait_for_timeout(800)
        check(not await page.evaluate("document.body.classList.contains('signedout')"), "Stays signed in after reload")
        check("set up your plan" not in (await page.inner_text("#app")).lower(), "No intake again after reload")
        await page.click("nav button[data-tab=today]"); await page.wait_for_timeout(300)
        check("new program is ready" in (await page.inner_text("#app")).lower(), "The person sees their new program waiting")
        await page.click("button[data-act=planuse]"); await page.wait_for_timeout(400)
        s = await settings(page)
        check(s["program"]["order"] == ["a", "b"] and s["cal"] == 2300 and any(x["n"] == "Chipotle bowl" for x in s["presets"])
              and (await page.evaluate("window.__reqs"))[0]["status"] == "applied"
              and "new program is ready" not in (await page.inner_text("#app")).lower(),
              "Use it switches the program, targets and foods, and marks it applied")

        await page.click("#me"); await page.wait_for_timeout(150)
        await page.click("#me"); await page.wait_for_timeout(150)
        check("Account" not in await page.inner_text("#app"), "Tapping the header button again goes back")
        for tab in ["today", "workout", "progress", "plan"]:
            await page.click(f"nav button[data-tab={tab}]"); await page.wait_for_timeout(150)
        check(True, "All four tabs open")
        await page.context.close()

        # ---- Pablo, from before per-person programs ----
        seed = {"settings/main": {"cal": 2600, "pro": 160, "swaps": {"push:4": "Cable lateral raise"},
                                  "presets": [{"g": "Work orders", "n": "Jersey Mike's #43", "c": 1010, "p": 45}]},
                "days/2026-11-08": {"date": "2026-11-08", "food": [], "steps": 6539}}
        page = await new_page(browser, errors, seed)
        await page.goto(URL); await page.wait_for_timeout(300); await sign_in(page)
        s = await settings(page)
        prog = s.get("program", {})
        check("set up your plan" not in (await page.inner_text("#app")).lower() and s.get("legacy")
              and prog.get("sched", [None])[0] == "push" and s.get("cal") == 2600,
              "Existing data moves into a saved program, with no intake")
        check(prog["days"]["push"]["ex"][4]["n"] == "Cable lateral raise" and "swaps" not in s,
              "Saved 'Always' swaps carry over into the program")
        await page.click("nav button[data-tab=plan]"); await page.wait_for_timeout(200)
        check("pozole" in (await page.inner_text("#app")).lower(), "Pablo keeps his own food cheat sheet")
        await page.evaluate("window.__failInsert = true")
        await page.click("button[data-act=redo]"); await page.wait_for_timeout(200)
        await page.select_option("#in_sex", "m"); await page.fill("#in_age", "23"); await page.fill("#in_ft", "5")
        await page.fill("#in_inch", "8"); await page.fill("#in_wt", "165"); await page.select_option("#in_goal", "bulk")
        await page.fill("#in_focus", "Upper chest and side delts")
        await page.click("button[data-act=intake]"); await page.wait_for_timeout(300)
        check("intakePending" in await settings(page), "If sending fails, the answers are kept to send later")
        await page.evaluate("window.__failInsert = false")
        await page.click("#me"); await page.wait_for_timeout(300)
        await page.click("button[data-act=reqresend]"); await page.wait_for_timeout(300)
        reqs = await page.evaluate("window.__reqs")
        check(len(reqs) == 1 and reqs[0]["answers"]["focus"] == "Upper chest and side delts" and "intakePending" not in await settings(page),
              "Send now delivers them from the account page")
        await page.context.close()

        # ---- someone with a few weeks of history ----
        today = datetime.date.today()
        ago = lambda n: (today - datetime.timedelta(days=n)).isoformat()
        sunday = ago((today.weekday() + 1) % 7)
        lift = lambda w, r: {"n": "Lat pulldown", "s": 3, "r": "8-12", "rest": 90, "ti": 0, "sets": [{"w": w, "r": r, "d": True}] * 3}
        seed = {"settings/main": {"cal": 2400, "pro": 150, "goal": 170, "program": {
                    "days": {"a": {"t": "Back day", "ex": [{"n": "Lat pulldown", "s": 3, "r": "8-12", "rest": 90},
                                                           {"n": "Cable curl", "s": 3, "r": "10-12", "rest": 60}]}},
                    "order": ["a"], "sched": ["a"] * 7}},
                f"days/{ago(1)}": {"date": ago(1), "food": [{"n": "Burrito", "c": 700, "p": 40, "q": 1}], "steps": 9000}}
        for n, reps in ((35, 10), (28, 8), (21, 8), (7, 8)):  # best 5 weeks ago, then three sessions without beating it
            seed[f"workouts/{ago(n)}_a"] = {"date": ago(n), "prog": "a", "title": "Back day", "done": True, "ex": [lift(120, reps)]}
        seed[f"workouts/{ago(7)}_a"]["ex"].append({"n": "Cable curl", "s": 3, "r": "10-12", "rest": 60, "ti": 1,
                                                   "sets": [{"w": 40, "r": r, "d": True} for r in (10, 10, 9)]})
        for n in (2, 3, 4):
            seed[f"days/{ago(n)}"] = {"date": ago(n), "food": [], "weight": 171}
        buddy = [{"user_id": "u2", "week": sunday, "name": "sam", "workouts": 3, "protein_days": 2, "steps": 7000, "strength": 4.2,
                  "planned": 3, "last_workout": ago(0), "last_title": "Push"}]
        page = await new_page(browser, errors, seed, buddy)
        await page.goto(URL); await page.wait_for_timeout(300); await sign_in(page)
        app = (await page.inner_text("#app")).lower()
        check(await page.locator("#hero .ring").count() == 3 and await page.locator(".wkstrip .wd").count() == 7
              and "workouts this week" in app, "Today shows the three rings and the week strip")
        check("week check-in" in app and "1 of 7 workouts" in app and "stalled: lat pulldown" in app,
              "Today opens with last week's check-in")
        await page.click("button[data-act=checkok]"); await page.wait_for_timeout(300)
        check("week check-in" not in (await page.inner_text("#app")).lower() and (await settings(page)).get("checkin") == sunday,
              "Got it puts the check-in away until next week")
        check("recent" in app and "same as yesterday" in app and "idea:" in app,
              "Today offers recent foods, yesterday's log and a protein idea")
        await page.click("button[data-act=recent]"); await page.wait_for_timeout(300)
        food = await page.evaluate(f"(window.__docs['days/{ago(0)}']||{{}}).food||[]")
        check(len(food) == 1 and food[0]["n"] == "Burrito" and "700" in await page.inner_text("#hero"),
              "Tapping a recent food logs it and updates the rings")
        check("sam finished push today" in (await page.inner_text("#app")).lower(), "Today shows that your friend trained")

        await page.click("button[data-act=startw]"); await page.wait_for_timeout(300)
        app = await page.inner_text("#app")
        check("no new best in 3 sessions" in app.lower() and "110 × 12, 12, 12" in app, "A stalled lift gets a back-off suggestion and a lighter target")
        check("40 × 11, 10, 9" in app, "Each exercise shows today's target: last time plus one rep")
        await page.click("button[data-act=setdone][data-i='1'][data-j='0']"); await page.wait_for_timeout(300)
        done = (await page.evaluate(f"window.__docs['workouts/{ago(0)}_a']"))["ex"][1]["sets"][0]
        check(done["w"] == 40 and done["r"] == 11 and done["d"], "Tapping Done on an empty set logs the target")
        await page.fill("input[data-w='0'][data-s='0'][data-f=w]", "125"); await page.fill("input[data-w='0'][data-s='0'][data-f=r]", "10")
        await page.click("button[data-act=setdone]"); await page.wait_for_timeout(300)
        check("New best: Lat pulldown 125×10" in await page.inner_text("#toast"), "Beating your best shows a toast")
        await page.click("button[data-act=finish]"); await page.wait_for_timeout(300)
        check("new bests: lat pulldown 125×10" in (await page.inner_text("#app")).lower(), "The finish summary lists the new best")

        await page.click("nav button[data-tab=progress]"); await page.wait_for_timeout(3800)
        app = (await page.inner_text("#app")).lower()
        check("records" in app and "lifts this week" in app and "125×10" in app, "Progress shows records and this week's lifts")
        mine = [r for r in await page.evaluate("window.__board") if r["user_id"] == "u1" and r["week"] == sunday]
        check("sam" in app and "pablo" in app and len(mine) == 1 and mine[0]["workouts"] == 1 and mine[0]["protein_days"] == 0,
              "The board shows you next to your friend, with only weekly totals shared")
        check(set(mine[0]) <= {"user_id", "week", "name", "workouts", "protein_days", "steps", "strength", "updated_at",
                               "planned", "last_workout", "last_title"}
              and mine[0]["planned"] == 7 and mine[0]["last_title"] == "Back day" and mine[0]["last_workout"] == ago(0),
              "Nothing else is sent to the board")
        check("team goal" in app and "sam 3/3 ✓" in app and "pablo 1/7" in app and "6 workouts to go" in app,
              "The board shows the shared weekly goal")

        check("sets per muscle" in app and "lats" in app, "Progress shows weekly sets per muscle")
        await page.click("button[data-act=focus][data-k=lats]"); await page.wait_for_timeout(300)
        check((await settings(page)).get("focus") == ["lats"] and "lats is a focus but under 10 sets" in (await page.inner_text("#app")).lower(),
              "Marking a focus muscle saves it and flags it when it's under 10 sets")
        check("you reached 170 lbs" in app and "start a mini-cut" in app, "Reaching the goal weight offers the next phase")
        await page.click("button[data-act=phase][data-i='0']"); await page.wait_for_timeout(300)
        s = await settings(page)
        check(s["profile"]["goal"] == "cut" and s["cal"] == 1750 and s["pro"] == 170 and s["goal"] == 162 and s["phaseStart"] == ago(0),
              "Choosing a mini-cut sets the new calorie, protein and goal-weight targets")
        await page.click("button[data-act=checkshow]"); await page.wait_for_timeout(200)
        check("week check-in" in (await page.inner_text("#app")).lower(), "The check-in can be reopened from Progress")

        await page.click("#me"); await page.wait_for_timeout(300)
        await page.click("#acboard"); await page.wait_for_timeout(300)
        check(not [r for r in await page.evaluate("window.__board") if r["user_id"] == "u1"] and (await settings(page)).get("board") is False,
              "Turning sharing off removes you from the board")
        await page.click("button[data-act=stepnew]"); await page.wait_for_timeout(300)
        app = await page.inner_text("#app")
        check("Get Contents of URL" in app and "/rest/v1/rpc/log_steps" in await page.content() and "tok_" in await page.content(),
              "Automatic steps shows the Shortcut steps, URL and token")
        await page.click("button[data-act=stepdone]"); await page.wait_for_timeout(200)
        check("Automatic steps are on" in await page.inner_text("#app"), "Automatic steps shows as on afterwards")
        await page.click("button[data-act=stepoff]"); await page.wait_for_timeout(300)
        check("set up automatic steps" in (await page.inner_text("#app")).lower(), "Automatic steps can be turned off")

        # ---- no signal ----
        await page.click("nav button[data-tab=today]"); await page.wait_for_timeout(200)
        await page.evaluate("sessionStorage.setItem('mockoffline','1')")
        await page.fill("input[data-day=weight]", "172.4"); await page.wait_for_timeout(1800)
        today_doc = f"window.__docs['days/{ago(0)}']||{{}}"
        check("Offline" in await page.inner_text("#status") and (await page.evaluate(today_doc)).get("weight") != 172.4
              and "couldn’t save" not in (await page.inner_text("#app")).lower(), "With no signal, a change is kept on the phone without an error")
        await page.reload(); await page.wait_for_timeout(900)
        check(not await page.evaluate("document.body.classList.contains('signedout')")
              and await page.input_value("input[data-day=weight]") == "172.4" and await page.locator("#hero .ring").count() == 3,
              "The app reopens with no signal, showing your data and the unsent change")
        await page.evaluate("sessionStorage.removeItem('mockoffline'); window.dispatchEvent(new Event('online'))")
        await page.wait_for_timeout(5500)
        doc = await page.evaluate(today_doc)
        check(doc.get("weight") == 172.4 and doc.get("food") and "Saved" in await page.inner_text("#status"),
              "Back online, the change is sent and nothing else in that day is lost")
        await browser.close()
    write_summary(errors)
    if errors:
        print("Page errors:", *errors, sep="\n  "); sys.exit(1)
    print("Smoke test passed")

try:
    asyncio.run(main())
except AssertionError:
    write_summary([])
    sys.exit(1)
