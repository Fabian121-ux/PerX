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
    
    // Verify some mock content renders (e.g. "Build a secure marketplace dashboard")
    await expect(page.getByText("Build a secure marketplace dashboard")).toBeVisible();
  });

  test("can authenticate as test user and view dashboard", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("button", { name: /Test Account/i }).click();
    
    // Check that we arrive at the dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Check dashboard renders without 500
    const bodyText = await page.innerText("body");
    expect(bodyText).not.toContain("PrismaClientInitializationError");
  });
});
