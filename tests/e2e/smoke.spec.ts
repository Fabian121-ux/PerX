import { test, expect } from "@playwright/test";

test.describe("Mock Mode Smoke Tests", () => {
  test("application renders landing page without errors", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    
    // Check that there is no 500 or Prisma error text
    const bodyText = await page.innerText("body");
    expect(bodyText).not.toContain("PrismaClientInitializationError");
    expect(bodyText).not.toContain("DATABASE_URL");
    
    // Check for the Local Mock Data indicator
    await expect(page.locator("text=Local Mock Data")).toBeVisible();
  });

  test("can navigate to Discover and see mock opportunities", async ({ page }) => {
    await page.goto("/discover");
    
    const bodyText = await page.innerText("body");
    expect(bodyText).not.toContain("PrismaClientInitializationError");
    expect(bodyText).not.toContain("DATABASE_URL");
    
    // Verify some mock content renders (e.g. "Trust-led onboarding redesign")
    await expect(page.getByText("Trust-led onboarding redesign")).toBeVisible();
  });

  test("can authenticate as test user and view dashboard", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("button", { name: /Enter Test Account/i }).click();
    
    // Check that we arrive at the dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Check dashboard renders without 500
    const bodyText = await page.innerText("body");
    expect(bodyText).not.toContain("PrismaClientInitializationError");
  });

  test("can navigate to Messages and see mock data", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("button", { name: /Enter Test Account/i }).click();
    await page.goto("/dashboard/messages");
    
    // Verify messages renders without 500 error
    const bodyText = await page.innerText("body");
    expect(bodyText).not.toContain("PrismaClientInitializationError");
  });

  test("Test Account cannot access admin", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("button", { name: /Enter Test Account/i }).click();
    
    // Attempt to access admin
    await page.goto("/admin");
    
    // Should be redirected or shown 404/not authorized (since Test Account is not admin)
    // We'll check if the URL redirected to dashboard, or if a "Not authorized" text appears
    const url = page.url();
    expect(url.includes("/admin")).toBeFalsy();
  });
});
