# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> Mock Mode Smoke Tests >> can authenticate as test user and view dashboard
- Location: tests/e2e/smoke.spec.ts:28:7

# Error details

```
Test timeout of 90000ms exceeded.
```

```
Error: page.goto: Test timeout of 90000ms exceeded.
Call log:
  - navigating to "http://127.0.0.1:3000/sign-in", waiting until "load"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - link "perX home" [ref=e5] [cursor=pointer]:
          - /url: /
          - img "perX" [ref=e6]
        - navigation [ref=e7]:
          - link "Discover" [ref=e8] [cursor=pointer]:
            - /url: /discover
          - link "How it works" [ref=e9] [cursor=pointer]:
            - /url: /how-it-works
          - link "Trust" [ref=e10] [cursor=pointer]:
            - /url: /trust-safety
          - link "Help" [ref=e11] [cursor=pointer]:
            - /url: /help
        - generic [ref=e12]:
          - link "Sign in" [ref=e13] [cursor=pointer]:
            - /url: /sign-in
          - link "Sign up" [ref=e14] [cursor=pointer]:
            - /url: /sign-up
    - main [ref=e15]:
      - generic [ref=e16]:
        - generic [ref=e17]:
          - img "perX" [ref=e18]
          - generic [ref=e19]:
            - paragraph [ref=e20]: Secure preview
            - heading "Deals start with verified access." [level=2] [ref=e21]
            - paragraph [ref=e22]: Sign in to manage opportunities, proposals, messages, milestones, simulated escrow and reputation from one connected workspace.
        - generic [ref=e23]:
          - generic [ref=e24]:
            - generic [ref=e25]: Discovery
            - generic [ref=e26]: Ready
          - generic [ref=e27]:
            - generic [ref=e28]: Proposal
            - generic [ref=e29]: Ready
          - generic [ref=e30]:
            - generic [ref=e31]: Deal
            - generic [ref=e32]: Ready
          - generic [ref=e33]:
            - generic [ref=e34]: Trust
            - generic [ref=e35]: Ready
      - generic [ref=e37]:
        - paragraph [ref=e38]: Sign in
        - heading "Welcome back to perX" [level=1] [ref=e39]
        - generic [ref=e40]:
          - generic [ref=e41]:
            - generic [ref=e42]: Email
            - textbox "Email" [ref=e43]
          - generic [ref=e44]:
            - generic [ref=e45]: Password
            - textbox "Password" [ref=e46]
          - button "Sign in" [ref=e47]
        - generic [ref=e50]: or explore perX
        - generic [ref=e52]:
          - generic [ref=e53]:
            - link "Enter Demo Preview" [ref=e54] [cursor=pointer]:
              - /url: /preview
            - paragraph [ref=e55]: Quick local UI preview. No database or configuration required.
          - paragraph [ref=e56]: "Demo Preview: explore static sample screens"
        - generic [ref=e57]:
          - button "Enter Test Account" [ref=e59]
          - paragraph [ref=e60]: "Test Account: test the real local application interface"
        - generic [ref=e61]:
          - link "Recover password" [ref=e62] [cursor=pointer]:
            - /url: /password-recovery
          - link "Create account" [ref=e63] [cursor=pointer]:
            - /url: /sign-up
  - generic [ref=e69]: Local Mock Data
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | test.describe("Mock Mode Smoke Tests", () => {
  4  |   test("application renders landing page without errors", async ({ page }) => {
  5  |     const response = await page.goto("/");
  6  |     expect(response?.status()).toBe(200);
  7  |     
  8  |     // Check that there is no 500 or Prisma error text
  9  |     const bodyText = await page.innerText("body");
  10 |     expect(bodyText).not.toContain("PrismaClientInitializationError");
  11 |     expect(bodyText).not.toContain("DATABASE_URL");
  12 |     
  13 |     // Check for the Local Mock Data indicator
  14 |     await expect(page.locator("text=Local Mock Data")).toBeVisible();
  15 |   });
  16 | 
  17 |   test("can navigate to Discover and see mock opportunities", async ({ page }) => {
  18 |     await page.goto("/discover");
  19 |     
  20 |     const bodyText = await page.innerText("body");
  21 |     expect(bodyText).not.toContain("PrismaClientInitializationError");
  22 |     expect(bodyText).not.toContain("DATABASE_URL");
  23 |     
  24 |     // Verify some mock content renders (e.g. "Trust-led onboarding redesign")
  25 |     await expect(page.getByText("Trust-led onboarding redesign")).toBeVisible();
  26 |   });
  27 | 
  28 |   test("can authenticate as test user and view dashboard", async ({ page }) => {
> 29 |     await page.goto("/sign-in");
     |                ^ Error: page.goto: Test timeout of 90000ms exceeded.
  30 |     await page.getByRole("button", { name: /Enter Test Account/i }).click();
  31 |     
  32 |     // Check that we arrive at the dashboard
  33 |     await expect(page).toHaveURL(/\/dashboard/);
  34 |     
  35 |     // Check dashboard renders without 500
  36 |     const bodyText = await page.innerText("body");
  37 |     expect(bodyText).not.toContain("PrismaClientInitializationError");
  38 |   });
  39 | 
  40 |   test("can navigate to Messages and see mock data", async ({ page }) => {
  41 |     await page.goto("/sign-in");
  42 |     await page.getByRole("button", { name: /Enter Test Account/i }).click();
  43 |     await page.goto("/dashboard/messages");
  44 |     
  45 |     // Verify messages renders without 500 error
  46 |     const bodyText = await page.innerText("body");
  47 |     expect(bodyText).not.toContain("PrismaClientInitializationError");
  48 |   });
  49 | 
  50 |   test("Test Account cannot access admin", async ({ page }) => {
  51 |     await page.goto("/sign-in");
  52 |     await page.getByRole("button", { name: /Enter Test Account/i }).click();
  53 |     
  54 |     // Attempt to access admin
  55 |     await page.goto("/admin");
  56 |     
  57 |     // Should be redirected or shown 404/not authorized (since Test Account is not admin)
  58 |     // We'll check if the URL redirected to dashboard, or if a "Not authorized" text appears
  59 |     const url = page.url();
  60 |     expect(url.includes("/admin")).toBeFalsy();
  61 |   });
  62 | });
  63 | 
```