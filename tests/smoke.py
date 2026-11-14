"""Headless smoke test: sign-in, intake, program editor, account page, save, migration, reload.
Runs against tests/mock-supabase.js."""
import asyncio, json, os, pathlib, sys
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


async def new_page(browser, errors, seed=None):
    ctx = await browser.new_context(viewport={"width": 390, "height": 844})
    if seed is not None:
        await ctx.add_init_script(f"if(!sessionStorage.getItem('mockdocs'))sessionStorage.setItem('mockdocs',{json.dumps(json.dumps(seed))})")
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
        await page.click("button[data-act=intake]"); await page.wait_for_timeout(300)
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

        await page.reload(); await page.wait_for_timeout(800)
        check(not await page.evaluate("document.body.classList.contains('signedout')"), "Stays signed in after reload")
        check("set up your plan" not in (await page.inner_text("#app")).lower(), "No intake again after reload")

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
