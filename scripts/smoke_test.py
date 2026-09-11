from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        print("Launching browser...")
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        errors = []
        page.on("pageerror", lambda err: errors.append(f"PageError: {err}"))
        page.on("console", lambda msg: errors.append(f"Console {msg.type}: {msg.text}") if msg.type == "error" else None)
        
        print("Navigating to https://jetfarm.pages.dev/ ...")
        response = page.goto('https://jetfarm.pages.dev/')
        page.wait_for_url('**/login*', timeout=15000)
        page.wait_for_load_state('networkidle')
        
        status = response.status if response else "Unknown"
        title = page.title()
        url = page.url
        content_length = len(page.content())
        
        print(f"Status: {status}")
        print(f"Final URL: {url}")
        print(f"Title: {title}")
        print(f"Content length: {content_length} characters")
        
        # Check for common login elements
        has_email = page.locator('input[type="email"]').count() > 0
        has_password = page.locator('input[type="password"]').count() > 0
        
        print(f"Found email input: {has_email}")
        print(f"Found password input: {has_password}")
        
        if errors:
            print("\nErrors encountered:")
            for e in errors:
                print(e)
        else:
            print("\nNo console or page errors detected.")
            
        # Take a screenshot for proof
        page.screenshot(path='docs/images/smoke_test_result.png')
        print("Screenshot saved to docs/images/smoke_test_result.png")
        
        browser.close()

if __name__ == "__main__":
    run()
