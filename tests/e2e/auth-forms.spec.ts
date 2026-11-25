import { expect, test } from "@playwright/test";

test.describe("auth form experience", () => {
  test("sign-up exposes required account fields and inline password feedback", async ({
    page,
  }) => {
    await page.goto("/sign-up");

    await expect(page.getByLabel("Full name")).toBeVisible();
    await expect(page.getByLabel("Username")).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await page.getByLabel("Username").fill("Urama Chigozie");
    await page.getByLabel("Email address").click();
    await expect(page.getByLabel("Username")).toHaveValue("urama-chigozie");
    await expect(page.getByLabel("Username")).not.toHaveAttribute("pattern");
    await expect(
      page.getByText("PtahX is currently open to a limited number of beta users."),
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

  test("email verification presents one primary code action and a collapsed resend", async ({ page }) => {
    await page.goto("/verify-email?status=sent&email=member%40example.com");
    await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
    await expect(page.getByText(/valid for 5 minutes/i)).toBeVisible();
    await expect(page.getByLabel("Email address").first()).toHaveValue("member@example.com");
    await expect(page.getByLabel("Verification code")).toHaveAttribute("maxlength", "6");
    await expect(page.getByRole("button", { name: "Verify and continue" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send a new code" })).not.toBeVisible();
    await page.getByText("Didn't receive a code?").click();
    await expect(page.getByRole("button", { name: "Send a new code" })).toBeVisible();
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


});
