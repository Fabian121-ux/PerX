import { test, expect, type Page } from "@playwright/test";
import crypto from "node:crypto";

/**
 * Isolates click-acknowledgement latency when switching conversations.
 *
 * Distinguishes:
 *   first-open  - conversation whose full history is not yet cached
 *   re-open     - conversation already in the client history cache
 *
 * The gap between the two is exactly the cost of awaiting the network before
 * showing any selection feedback.
 */

const BASE = process.env.PERF_BASE_URL ?? "http://127.0.0.1:3200";
const TEST_DB = process.env.TEST_DATABASE_URL!;
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? "perx_session";

async function signIn(page: Page, email: string) {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: TEST_DB, ssl: false });
  try {
    const user = await pool.query<{ id: string }>(
      `SELECT id FROM "User" WHERE email = $1`,
      [email],
    );
    const token = crypto.randomBytes(32).toString("base64url");
    await pool.query(
      `INSERT INTO "Session" (id,"tokenHash","userId","expiresAt","createdAt","lastSeenAt")
       VALUES ($1,$2,$3,$4,NOW(),NOW())`,
      [
        `sess_${crypto.randomUUID()}`,
        crypto.createHash("sha256").update(token).digest("hex"),
        user.rows[0].id,
        new Date(Date.now() + 3600e3),
      ],
    );
    await page.context().addCookies([
      {
        domain: new URL(BASE).hostname,
        httpOnly: true,
        name: SESSION_COOKIE,
        path: "/",
        sameSite: "Lax",
        value: token,
      },
    ]);
  } finally {
    await pool.end();
  }
}

test("click acknowledgement: first-open vs re-open", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { height: 800, width: 390 } });
  const out: Record<string, number> = {};
  try {
    await signIn(page, "alice-test@perx.test");
    await page.goto(`${BASE}/app/messages`);
    const items = page.locator("button[data-conversation-id]");
    await expect(items.first()).toBeVisible({ timeout: 30_000 });

    const back = page.getByRole("button", { name: "Back to conversations" });
    const ackOf = async (index: number, key: string) => {
      const t = performance.now();
      await items.nth(index).click();
      await expect(items.nth(index)).toHaveAttribute("aria-current", "true", {
        timeout: 20_000,
      });
      out[key] = Math.round(performance.now() - t);
      await expect(page.getByLabel("Message history")).toBeVisible({
        timeout: 20_000,
      });
      if (await back.isVisible().catch(() => false)) {
        await back.click();
        await expect(items.nth(index)).toBeVisible({ timeout: 20_000 });
      }
    };

    await ackOf(0, "first_open_A");
    await ackOf(1, "first_open_B");
    await ackOf(0, "reopen_A");
    await ackOf(1, "reopen_B");

    console.log("\n=== SWITCH ACK ===");
    console.log(JSON.stringify(out, null, 2));
    console.log("=== END SWITCH ACK ===\n");
  } finally {
    await page.close();
  }
});
