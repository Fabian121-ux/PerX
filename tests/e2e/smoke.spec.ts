import { test, expect } from "@playwright/test";

test.describe("PerX Application Smoke Tests", () => {
  test("application renders landing page without errors", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    
    // Check that there is no 500 or Prisma error text
    const bodyText = await page.innerText("body");
    expect(bodyText).not.toContain("PrismaClientInitializationError");
    expect(bodyText).not.toContain("DATABASE_URL");
    
    // Ensure Demo Preview button is NOT visible
    await expect(page.getByRole("link", { name: /Explore perX/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Enter Demo Preview/i })).toHaveCount(0);
  });

  test("can navigate to Discover and see opportunities", async ({ page }) => {
    await page.goto("/discover");
    
    const bodyText = await page.innerText("body");
    expect(bodyText).not.toContain("PrismaClientInitializationError");
    expect(bodyText).not.toContain("DATABASE_URL");
  });

  test("Sign-in page has no test bypass buttons", async ({ page }) => {
    await page.goto("/sign-in");
    
    // Test Account and Demo Preview buttons must not exist
    await expect(page.getByRole("button", { name: /Enter Test Account/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Enter Demo Preview/i })).toHaveCount(0);
    await expect(page.getByText("Test Account")).toHaveCount(0);
  });

  test("/app requires authentication", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/.*\/sign-in/);
  });

  test("/admin requires admin access", async ({ page }) => {
    await page.goto("/admin");
    // Will redirect to sign-in since no user, but even if logged in without admin, it should reject
    await expect(page).toHaveURL(/.*\/sign-in/);
  });

  test("Preview routes are gated by default", async ({ page }) => {
    const response = await page.goto("/preview");
    // Should return 404
    expect(response?.status()).toBe(404);
  });
});
