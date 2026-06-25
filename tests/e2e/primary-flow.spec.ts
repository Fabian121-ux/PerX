import { expect, test } from "@playwright/test";

test("primary public journey loads core routes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "One ecosystem. More opportunities." })).toBeVisible();

  await expect(page.getByRole("link", { name: "Find opportunities" }).first()).toHaveAttribute("href", "/discover");
  await page.goto("/discover");
  await expect(page.getByRole("heading", { name: "Find opportunities, people and startup collaborators." })).toBeVisible();

  await page.getByRole("link", { name: /Build a secure marketplace dashboard/ }).click();
  await expect(page.getByRole("heading", { name: "Build a secure marketplace dashboard" })).toBeVisible();

  await page.goto("/sign-up");
  await expect(page.getByRole("heading", { name: "Create one account for your roles" })).toBeVisible();
});
