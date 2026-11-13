"""Headless smoke test: sign-in, save, import, reload. Runs against tests/mock-supabase.js."""
import asyncio, pathlib, sys
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
MOCK = (ROOT / "tests" / "mock-supabase.js").read_text()
URL = (ROOT / "index.html").as_uri()

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
        assert await page.evaluate("document.body.classList.contains('signedout')"), "should start signed out"

        await page.fill("#lem", "test@example.com"); await page.fill("#lpw", "wrong")
        await page.click("#lbtn"); await page.wait_for_timeout(200)
        assert "Wrong email or password" in await page.inner_text("#aerr"), "bad password message"

        await page.fill("#lpw", "pw12345678"); await page.click("#lbtn"); await page.wait_for_timeout(700)
        assert not await page.evaluate("document.body.classList.contains('signedout')"), "sign-in failed"
        assert "Saved" in await page.inner_text("#status"), "data never finished loading"

        await page.click("button[data-act=preset]")
        await page.fill("input[data-day=weight]", "165.4"); await page.wait_for_timeout(1500)
        docs = await page.evaluate("JSON.stringify(window.__docs)")
        assert "165.4" in docs and '"food":[{' in docs, f"save failed: {docs[:200]}"

        await page.click("nav button[data-tab=plan]"); await page.wait_for_timeout(200)
        await page.fill("#impbox", '{"settings":{"cal":2600},"days":{"2026-11-08":{"date":"2026-11-08","food":[],"steps":6539}},"workouts":{}}')
        await page.click("button[data-act=import]"); await page.wait_for_timeout(700)
        assert "Imported 2 items" in await page.inner_text("#app"), "import failed"

        await page.reload(); await page.wait_for_timeout(800)
        assert not await page.evaluate("document.body.classList.contains('signedout')"), "session lost on reload"

        for tab in ["today", "workout", "progress", "plan"]:
            await page.click(f"nav button[data-tab={tab}]"); await page.wait_for_timeout(150)
        await browser.close()
    if errors:
        print("Page errors:", *errors, sep="\n  "); sys.exit(1)
    print("Smoke test passed")

asyncio.run(main())
