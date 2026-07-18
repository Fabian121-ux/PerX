import { expect, test } from "@playwright/test";

test("primary public journey loads core routes", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Discover trusted people, businesses and opportunities.",
    }),
  ).toBeVisible();

  await expect(
    page.getByRole("link", { name: "Explore discovery" }).first(),
  ).toHaveAttribute("href", "/discover");
  await page.goto("/discover");
  await expect(
    page.getByRole("heading", {
      name: "Find trusted people, work and business opportunities.",
    }),
  ).toBeVisible();

  await page
    .getByRole("link", { name: /Trust-led onboarding redesign/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Trust-led onboarding redesign" }),
  ).toBeVisible();

  await page.goto("/sign-up");
  await expect(
    page.getByRole("heading", { name: "Create your PerX account" }),
  ).toBeVisible();
});
