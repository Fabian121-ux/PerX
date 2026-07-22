import { test, expect } from "@playwright/test";

test("Normal user cannot access /admin", async ({ page }) => {
  const timestamp = Date.now();
  const email = `public_user_${timestamp}@example.com`;
  const username = `pub_${timestamp}`;
  const password = "Password123!";

  // 1. Sign up on live site
  await page.goto("/sign-up");
  await page.fill('input[name="name"]', "Public User");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="confirmPassword"]', password);
  await page.fill('input[name="username"]', username);
  await page.check('input[name="terms"]');
  await page.click('button[type="submit"]');

  // Should redirect to setup
  await page.waitForURL("**/app/profile/setup");
  
  await page.fill('input[name="title"]', "Software Engineer");
  await page.fill('textarea[name="bio"]', "A public user for security testing.");
  await page.click('button[type="submit"]');

  // Should reach discover
  await page.waitForURL("**/app/discover");

  // Try to access /admin
  const response = await page.goto("/admin");
  
  // It should redirect or show forbidden
  const url = page.url();
  expect(url).not.toContain("/admin");
  expect(url).toContain("/app");
});
