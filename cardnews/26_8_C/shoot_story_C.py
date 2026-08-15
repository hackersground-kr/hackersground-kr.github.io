from playwright.sync_api import sync_playwright
import glob, os

files = sorted(glob.glob("/tmp/cardnews/storyC_*.html"))

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/opt/pw-browsers/chromium")
    page = browser.new_page(viewport={"width":1080, "height":1350}, device_scale_factor=2)
    for path in files:
        name = os.path.splitext(os.path.basename(path))[0]
        page.goto(f"file://{path}")
        page.wait_for_timeout(250)
        page.screenshot(path=f"/tmp/cardnews/{name}.png")
        print("shot", name)
    browser.close()
