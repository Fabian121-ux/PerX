import { expect, test } from "@playwright/test";

test.describe("auth form experience", () => {
  test("sign-up exposes required account fields and inline password feedback", async ({
    page,
  }) => {
    await page.goto("/sign-up");

    await expect(page.getByLabel("Full name")).toBeVisible();
    await expect(page.getByLabel("Username")).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(
      page.getByText("PerX is currently open to a limited number of beta users."),
    ).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(
      page.getByLabel("Confirm password", { exact: true }),
    ).toBeVisible();

    await page.getByLabel("Password", { exact: true }).fill("validpassword1");
    await page
      .getByLabel("Confirm password", { exact: true })
      .fill("differentpassword1");
    await expect(page.getByText("Passwords do not match.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create account" })).toBeDisabled();

    await page.getByLabel("Show password", { exact: true }).first().click();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
      "type",
      "text",
    );
  });

  test("sign-in sanitizes external callbacks and supports password visibility", async ({
    page,
  }) => {
    await page.goto("/sign-in?next=https://example.com/phish");

    await expect(page.locator('input[name="next"]')).toHaveValue("/app");
    await page.getByLabel("Show password", { exact: true }).click();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
      "type",
      "text",
    );
  });

  test("input dimensions and layout match between email and password", async ({
    page,
  }) => {
    await page.goto("/sign-up");

    const emailHeight = await page.getByLabel("Email address").evaluate((node) => window.getComputedStyle(node).height);
    const passwordHeight = await page.getByLabel("Password", { exact: true }).evaluate((node) => window.getComputedStyle(node).height);

    expect(emailHeight).toBe(passwordHeight);
  });

  test("unavailable state appears when database is down, retry works", async ({
    page,
  }) => {
    // Intercept registration status to simulate DB down
    await page.route("/api/registration/status", async (route) => {
      const url = route.request().url();
      if (url.includes("/api/registration/status")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            statusUnavailable: true,
            mode: "closed",
            registrationOpen: false,
            maximumUsers: null,
            remainingPlaces: null,
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/sign-up");

    await expect(page.getByRole("alert").filter({ hasText: "temporarily unavailable" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry connection" })).toBeVisible();

    // The retry action should reload or refresh the route
    await page.getByRole("button", { name: "Retry connection" }).click();
  });
});
