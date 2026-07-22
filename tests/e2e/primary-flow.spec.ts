import { expect, test } from "@playwright/test";

test("primary public journey loads homepage and discover", async ({ page }) => {
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
});

test("primary public journey can view onboarding redesign article", async ({ page }) => {
  await page.goto("/discover");
  await page
    .getByRole("link", { name: /Trust-led onboarding redesign/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Trust-led onboarding redesign" }),
  ).toBeVisible();
});

test("primary public journey can load sign up", async ({ page }) => {
  await page.goto("/sign-up");
  await expect(
    page.getByRole("heading", { name: "Create your PerX account" }),
  ).toBeVisible();
});

test("not-found page gives users safe recovery links", async ({ page }) => {
  await page.goto("/definitely-not-a-perx-route");

  await expect(
    page.getByRole("heading", { name: "This PerX page is not available" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Go home" })).toHaveAttribute(
    "href",
    "/",
  );
  await expect(
    page.getByRole("link", { name: "Explore discover" }),
  ).toHaveAttribute("href", "/discover");
});
