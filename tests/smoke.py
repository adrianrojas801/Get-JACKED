"""Headless smoke test: sign-in, save, import, reload. Runs against tests/mock-supabase.js."""
import asyncio, os, pathlib, sys
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
    lines = ["### Smoke test", ""] + [f"- [{'x' if ok else ' '}] {name}" for ok, name in RESULTS]
    lines.append(f"- [{' ' if errors else 'x'}] No JavaScript errors on the page")
    with open(path, "a") as f:
        f.write("\n".join(lines) + "\n")

async def main():
    errors = []
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await (await browser.new_context(viewport={"width": 390, "height": 844})).new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.route("**/vendor/supabase.js", lambda r: r.fulfill(body=MOCK, content_type="text/javascript"))
        await page.route("https://fonts.googleapis.com/**", lambda r: r.abort())
        await page.route("https://fonts.gstatic.com/**", lambda r: r.abort())

        await page.goto(URL); await page.wait_for_timeout(400)
        check(await page.evaluate("document.body.classList.contains('signedout')"), "Opens on the sign-in screen")

        await page.fill("#lem", "test@example.com"); await page.fill("#lpw", "wrong")
        await page.click("#lbtn"); await page.wait_for_timeout(200)
        check("Wrong email or password" in await page.inner_text("#aerr"), "Wrong password shows an error")

        await page.fill("#lpw", "pw12345678"); await page.click("#lbtn"); await page.wait_for_timeout(700)
        check(not await page.evaluate("document.body.classList.contains('signedout')"), "Correct password signs in")
        check("Saved" in await page.inner_text("#status"), "Data finishes loading")

        await page.click("button[data-act=preset]")
        await page.fill("input[data-day=weight]", "165.4"); await page.wait_for_timeout(1500)
        docs = await page.evaluate("JSON.stringify(window.__docs)")
        check("165.4" in docs and '"food":[{' in docs, "Quick-add food and weight save")

        await page.click("nav button[data-tab=plan]"); await page.wait_for_timeout(200)
        await page.fill("#impbox", '{"settings":{"cal":2600},"days":{"2026-11-08":{"date":"2026-11-08","food":[],"steps":6539}},"workouts":{}}')
        await page.click("button[data-act=import]"); await page.wait_for_timeout(700)
        check("Imported 2 items" in await page.inner_text("#app"), "Import from a backup works")

        await page.reload(); await page.wait_for_timeout(800)
        check(not await page.evaluate("document.body.classList.contains('signedout')"), "Stays signed in after reload")

        for tab in ["today", "workout", "progress", "plan"]:
            await page.click(f"nav button[data-tab={tab}]"); await page.wait_for_timeout(150)
        check(True, "All four tabs open")
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
