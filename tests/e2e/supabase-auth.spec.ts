import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes, randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";
import { enforceTestDatabaseIsolation } from "./utils/db-guard";
function localProvider() {
  enforceTestDatabaseIsolation();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!,
    mailbox = process.env.TEST_MAILBOX_URL!,
    key = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !mailbox || !key)
    throw new Error(
      "Explicit local Supabase and mailbox test configuration required.",
    );
  for (const value of [url, mailbox])
    if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(value).hostname))
      throw new Error("Auth acceptance requires exact loopback services.");
  return { url, mailbox, key };
}
async function emailLink(
  config: ReturnType<typeof localProvider>,
  email: string,
  type: string,
) {
  let link = "";
  await expect
    .poll(
      async () => {
        const list = await (
          await fetch(`${config.mailbox}/api/v1/messages`)
        ).json();
        const message = list.messages?.find(
          (m: { To: { Address: string }[]; Subject: string }) =>
            m.To.some((t) => t.Address === email) &&
            m.Subject.toLowerCase().includes(
              type === "signup" ? "confirm" : "reset",
            ),
        );
        if (!message) return false;
        const detail = await (
          await fetch(`${config.mailbox}/api/v1/message/${message.ID}`)
        ).json();
        const match = String(detail.HTML).match(/href="([^"]+)"/);
        if (!match) return false;
        link = match[1].replaceAll("&amp;", "&");
        return true;
      },
      { timeout: 30000 },
    )
    .toBe(true);
  const parsed = new URL(link);
  expect(parsed.origin).toBe("http://127.0.0.1:3100");
  expect(parsed.pathname).toBe("/auth/confirm");
  expect(parsed.searchParams.get("type")).toBe(type);
  return link;
}

test("real signup, email verification, sign-in, logout and recovery", async ({
  page,
  context,
}, info) => {
  test.setTimeout(300_000);
  const config = localProvider();
  const admin = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const db = new Pool({ connectionString: process.env.TEST_DATABASE_URL! });
  const email = `auth-${randomUUID()}@ptahx.test`,
    username = `auth_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
  const password = `Test1${randomBytes(18).toString("hex")}`,
    replacement = `Reset2${randomBytes(18).toString("hex")}`;
  let authId: string | undefined, appId: string | undefined;
  async function overflow() {
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  async function signIn(value: string) {
    await page.goto("/sign-in?next=%2Fapp");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(value);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
  }
  async function signOut() {
    if (info.project.name === "mobile-chrome") {
      await page.goto("/app/profile/setup");
      await page.getByRole("button", { name: "Open secondary menu" }).click();
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
    } else {
      await page.goto("/discover");
      await page
        .getByRole("button", { name: "Open account menu" })
        .filter({ visible: true })
        .click();
      await page
        .getByRole("menuitem", { name: "Sign out", exact: true })
        .click();
    }
    await expect(page).toHaveURL(/\/sign-in\?signedOut=1$/, { timeout: 30000 });
    expect(
      (
        await db.query(
          `SELECT count(*)::int AS count FROM "Session" WHERE "userId"=$1`,
          [appId],
        )
      ).rows[0].count,
    ).toBe(0);
  }
  try {
    if (info.project.name === "mobile-chrome")
      await page.setViewportSize({ width: 320, height: 740 });
    console.info("[auth-acceptance] signup form");
    await page.goto("/sign-up");
    await overflow();
    await page.getByLabel("Full name").fill("Supabase acceptance");
    await page.locator('input[name="username"]').fill(username);
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password", { exact: true }).fill(password);
    await page.locator('input[name="terms"]').check();
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(page).toHaveURL(/confirmation=required/, { timeout: 60000 });
    const row = (
      await db.query(
        `SELECT id,"authUserId","emailVerifiedAt" FROM "User" WHERE email=$1`,
        [email],
      )
    ).rows[0];
    appId = row.id;
    authId = row.authUserId;
    expect(authId).toMatch(/^[0-9a-f-]{36}$/);
    expect(appId).not.toBe(authId);
    expect(row.emailVerifiedAt).toBeNull();
    await expect
      .poll(
        async () => {
          const { data, error } = await admin.auth.admin.getUserById(authId!);
          return (
            !error && data.user?.id === authId && !data.user.email_confirmed_at
          );
        },
        { timeout: 30000 },
      )
      .toBe(true);
    await signIn(password);
    await expect(
      page.locator('[role="alert"]:not(#__next-route-announcer__)'),
    ).toContainText("confirm your email");
    expect(new URL(page.url()).pathname).toBe("/sign-in");
    console.info("[auth-acceptance] email confirmation");
    await page.goto(await emailLink(config, email, "signup"));
    await expect(page).toHaveURL(/\/app\/profile\/setup$/, { timeout: 60000 });
    await expect
      .poll(
        async () => {
          const { data, error } = await admin.auth.admin.getUserById(authId!);
          return (
            !error &&
            data.user?.id === authId &&
            Boolean(data.user.email_confirmed_at)
          );
        },
        { timeout: 30000 },
      )
      .toBe(true);
    await signOut();
    await signIn(password);
    await expect(page).toHaveURL(/\/app$/, { timeout: 60000 });
    const signedCookies = await context.cookies();
    await signOut();
    await context.addCookies(signedCookies);
    await page.goto("/app");
    await expect(page).toHaveURL(/\/sign-in/);
    await context.clearCookies();
    console.info("[auth-acceptance] recovery request");
    await page.goto("/password-recovery");
    await overflow();
    await page.locator('input[name="email"]').fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page).toHaveURL(/status=requested/, { timeout: 30000 });
    await expect(page.getByText(/If this account is eligible/)).toBeVisible();
    await page.goto(await emailLink(config, email, "recovery"));
    await expect(page).toHaveURL(/\/reset-password$/);
    await overflow();
    await page.screenshot({ path: info.outputPath("reset-password.png") });
    await page.getByLabel("New password", { exact: true }).fill(replacement);
    await page.getByLabel("Confirm new password").fill(replacement);
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page).toHaveURL(/passwordReset=1/, { timeout: 30000 });
    await signIn(password);
    await expect(
      page.locator('[role="alert"]:not(#__next-route-announcer__)'),
    ).toBeVisible();
    await signIn(replacement);
    await expect(page).toHaveURL(/\/app$/, { timeout: 60000 });
    await signOut();
    await page.goto(
      "/auth/confirm?token_hash=invalid&type=signup&next=https%3A%2F%2Fevil.example",
    );
    await expect(page).toHaveURL(/\/sign-in\?confirmation=invalid$/);
    await overflow();
  } finally {
    localProvider();
    try {
      if (authId) await admin.auth.admin.deleteUser(authId);
      await db.query(`DELETE FROM "User" WHERE email=$1`, [email]);
    } finally {
      await db.end();
    }
  }
});

test("operator setup preserves an existing admin record and establishes a new provider password", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const config = localProvider();
  const db = new Pool({ connectionString: process.env.TEST_DATABASE_URL! });
  const admin = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const appId = `existing-${randomUUID()}`,
    profileId = randomUUID(),
    roleId = randomUUID();
  const email = `auth-${randomUUID()}@ptahx.test`;
  let authId: string | undefined;
  try {
    await db.query(
      `INSERT INTO "User" (id,email,username,name,"passwordHash","accountClassification","updatedAt") VALUES ($1,$2,$1,$3,$4,'INTERNAL_ADMIN',now())`,
      [appId, email, "Existing administrator", "!legacy-test-sentinel"],
    );
    await db.query(
      `INSERT INTO "Profile" (id,"userId",headline,biography,location,"trustScore","updatedAt") VALUES ($1,$2,$3,$3,$3,71,now())`,
      [profileId, appId, "Preserve this profile"],
    );
    await db.query(
      `INSERT INTO "Role" (id,name,label,description) VALUES ($1,'ADMIN','Admin','Admin') ON CONFLICT (name) DO NOTHING`,
      [roleId],
    );
    await db.query(
      `INSERT INTO "UserRole" (id,"userId","roleId") SELECT $2,$1,id FROM "Role" WHERE name='ADMIN'`,
      [appId, randomUUID()],
    );
    const command = (apply: boolean) =>
      promisify(execFile)(
        process.execPath,
        [
          "--import",
          "tsx",
          "scripts/link-supabase-user.ts",
          `--app-user-id=${appId}`,
          "--create-identity",
          ...(apply ? ["--apply"] : []),
        ],
        {
          env: {
            ...process.env,
            DATABASE_URL: process.env.TEST_DATABASE_URL!,
            DIRECT_URL:
              process.env.TEST_DIRECT_URL ?? process.env.TEST_DATABASE_URL!,
            SUPABASE_SERVICE_ROLE_KEY: config.key,
            PERX_DATA_MODE: "database",
          },
          timeout: 60000,
        },
      );
    await command(false);
    expect(
      (await db.query(`SELECT "authUserId" FROM "User" WHERE id=$1`, [appId]))
        .rows[0].authUserId,
    ).toBeNull();
    await command(true);
    const row = (
      await db.query(
        `SELECT u.id,u."authUserId",u."passwordHash",u."accountClassification",p.id AS "profileId",p."trustScore",r.name AS role FROM "User" u JOIN "Profile" p ON p."userId"=u.id JOIN "UserRole" ur ON ur."userId"=u.id JOIN "Role" r ON r.id=ur."roleId" WHERE u.id=$1`,
        [appId],
      )
    ).rows[0];
    authId = row.authUserId;
    expect(row).toMatchObject({
      id: appId,
      passwordHash: "!legacy-test-sentinel",
      accountClassification: "INTERNAL_ADMIN",
      profileId,
      trustScore: 71,
      role: "ADMIN",
    });
    expect(authId).toMatch(/^[0-9a-f-]{36}$/);
    await page.goto(await emailLink(config, email, "recovery"));
    await expect(page).toHaveURL(/\/reset-password$/);
    const password = `Setup3${randomBytes(18).toString("hex")}`;
    await page.getByLabel("New password", { exact: true }).fill(password);
    await page.getByLabel("Confirm new password").fill(password);
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page).toHaveURL(/passwordReset=1/, { timeout: 30000 });
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/app$/, { timeout: 60000 });
    await expect
      .poll(
        async () => {
          const { data, error } = await admin.auth.admin.getUserById(authId!);
          return (
            !error &&
            data.user?.id === authId &&
            Boolean(data.user.email_confirmed_at)
          );
        },
        { timeout: 30000 },
      )
      .toBe(true);
  } finally {
    localProvider();
    try {
      authId ??= (
        await db.query(`SELECT "authUserId" FROM "User" WHERE id=$1`, [appId])
      ).rows[0]?.authUserId;
      if (authId) await admin.auth.admin.deleteUser(authId);
      await db.query(`DELETE FROM "User" WHERE id=$1`, [appId]);
      await db.query(`DELETE FROM "Role" WHERE id=$1`, [roleId]);
    } finally {
      await db.end();
    }
  }
});
