import sys
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        print("Launching browser for local build verification...")
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 390, 'height': 844})
        page = context.new_page()
        
        errors = []
        page.on("pageerror", lambda err: errors.append(f"PageError: {err}"))
        page.on("console", lambda msg: errors.append(f"Console {msg.type}: {msg.text}") if msg.type == "error" else None)
        
        print("Navigating to http://localhost:8081 ...")
        response = page.goto('http://localhost:8081/')
        page.wait_for_timeout(3000)
        
        status = response.status if response else "Unknown"
        title = page.title()
        url = page.url
        print(f"Status: {status}")
        print(f"Title: {title}")
        print(f"URL: {url}")
        
        page.screenshot(path='docs/images/local_web_verified.png')
        print("Screenshot saved to docs/images/local_web_verified.png")
        
        if errors:
            print("Errors encountered:")
            for e in errors:
                print("  ", e)
        else:
            print("No errors encountered!")
            
        browser.close()

if __name__ == "__main__":
    run()
