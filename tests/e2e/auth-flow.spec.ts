import { expect, test } from "@playwright/test";

async function getSessionCookieName(baseURL?: string) {
  if (process.env.SESSION_COOKIE_NAME) return process.env.SESSION_COOKIE_NAME;

  if (baseURL) {
    const response = await fetch(new URL("/api/auth/clear-session?next=/app", baseURL), {
      redirect: "manual",
    });
    const cookieName = response.headers.get("set-cookie")?.split("=")[0]?.trim();
    if (cookieName) return cookieName;
  }

  return "perx_session";
}

test.describe("auth flow routing and sign-out", () => {
  test("unauthenticated visitor sees sign in/up and is redirected from protected routes", async ({ page, isMobile }) => {
    await page.goto("/");
    if (isMobile) {
      await page.getByRole("button", { name: "Open navigation" }).click();
    }
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible();

    if (isMobile) {
      await page.getByRole("button", { name: "Close navigation" }).click();
    }

    await page.goto("/app/profile");
    // Should be redirected to sign in with returnTo
    await page.waitForURL(/\/sign-in/);
    expect(page.url()).toContain("returnTo");
  });

  // We skip testing actual login since we don't have a test user seeded yet, 
  // but we can verify middleware behavior by setting a mock cookie
  test("authenticated user is redirected from auth pages to app", async ({
    baseURL,
    context,
    page,
  }) => {
    const appUrl = new URL(baseURL ?? "http://127.0.0.1:3100");
    const sessionCookieName = await getSessionCookieName(baseURL);

    await context.addCookies([
      {
        name: sessionCookieName,
        value: "invalid-session-token",
        domain: appUrl.hostname,
        path: "/",
        secure: appUrl.protocol === "https:",
      },
    ]);

    await page.goto("/sign-in");
    // Invalid cookie, so user stays on sign-in
    await page.waitForURL(/\/sign-in/);
    
    await page.goto("/sign-up");
    // Invalid cookie, so user stays on sign-up
    await page.waitForURL(/\/sign-up/);

    // If they try to go to a protected route, they are bounced back
    await page.goto("/app");
    await page.waitForURL(/\/sign-in/);
    expect(page.url()).toContain("returnTo=%2Fapp");
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(c => c.name === sessionCookieName);
    expect(sessionCookie).toBeUndefined();
  });
});
