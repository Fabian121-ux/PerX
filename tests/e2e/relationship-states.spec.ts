import { test, expect, type Page } from "@playwright/test";
import crypto from "node:crypto";

import { hasIsolatedTestDatabase } from "./utils/db-guard";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
const TEST_DB = process.env.TEST_DATABASE_URL ?? "";
const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? "perx_session";

const describeOrSkip = hasIsolatedTestDatabase()
  ? test.describe
  : test.describe.skip;

const CAROL = "carol-test@perx.test";
const BOB = "bob-test@perx.test";
const ALICE = "alice-test@perx.test";

describeOrSkip("Profile relationship states (isolated test DB)", () => {
  const createdSessionIds = new Set<string>();

  type PgPool = Awaited<ReturnType<typeof createPool>>;

  async function createPool() {
    const { Pool } = await import("pg");
    return new Pool({ connectionString: TEST_DB, ssl: false });
  }

  async function withPool<T>(fn: (pool: PgPool) => Promise<T>): Promise<T> {
    const pool = await createPool();
    try {
      return await fn(pool);
    } finally {
      await pool.end();
    }
  }

  async function userId(email: string) {
    return withPool(async (pool) => {
      const r = await pool.query(`SELECT id FROM "User" WHERE email = $1`, [
        email,
      ]);
      if (!r.rows[0]) throw new Error(`User ${email} not found`);
      return r.rows[0].id as string;
    });
  }

  async function usernameOf(email: string) {
    return withPool(async (pool) => {
      const r = await pool.query(
        `SELECT username FROM "User" WHERE email = $1`,
        [email],
      );
      return r.rows[0].username as string;
    });
  }

  async function createSession(page: Page, email: string) {
    return withPool(async (pool) => {
      const user = await pool.query(`SELECT id FROM "User" WHERE email = $1`, [
        email,
      ]);
      if (!user.rows[0]) throw new Error(`User ${email} not found`);

      const token = crypto.randomBytes(32).toString("base64url");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const sessionId = `sess_${crypto.randomUUID()}`;

      await pool.query(
        `INSERT INTO "Session" (id, "tokenHash", "userId", "expiresAt", "createdAt", "lastSeenAt")
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [
          sessionId,
          tokenHash,
          user.rows[0].id,
          new Date(Date.now() + 3600_000),
        ],
      );
      createdSessionIds.add(sessionId);

      await page.context().addCookies([
        {
          name: SESSION_COOKIE,
          value: token,
          domain: new URL(BASE).hostname,
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      return user.rows[0].id as string;
    });
  }

  /** Removes any connection/block between the two users. */
  async function resetPair(aEmail: string, bEmail: string) {
    const [a, b] = [await userId(aEmail), await userId(bEmail)];
    await withPool(async (pool) => {
      await pool.query(
        `DELETE FROM "Connection"
          WHERE ("requesterId" = $1 AND "receiverId" = $2)
             OR ("requesterId" = $2 AND "receiverId" = $1)`,
        [a, b],
      );
      await pool.query(
        `DELETE FROM "BlockedUser"
          WHERE ("blockerUserId" = $1 AND "blockedUserId" = $2)
             OR ("blockerUserId" = $2 AND "blockedUserId" = $1)`,
        [a, b],
      );
    });
    return { a, b };
  }

  async function createConnection(
    requesterEmail: string,
    receiverEmail: string,
    status: "PENDING" | "ACCEPTED",
  ) {
    const { a, b } = await resetPair(requesterEmail, receiverEmail);
    const id = `c${crypto.randomBytes(12).toString("hex")}`;
    await withPool((pool) =>
      pool.query(
        `INSERT INTO "Connection" (id, "requesterId", "receiverId", status, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [id, a, b, status],
      ),
    );
    return id;
  }

  async function createBlock(blockerEmail: string, blockedEmail: string) {
    const { a, b } = await resetPair(blockerEmail, blockedEmail);
    const id = `c${crypto.randomBytes(12).toString("hex")}`;
    await withPool((pool) =>
      pool.query(
        `INSERT INTO "BlockedUser" (id, "blockerUserId", "blockedUserId", "createdAt")
         VALUES ($1, $2, $3, NOW())`,
        [id, a, b],
      ),
    );
    return id;
  }

  async function connectionStatus(aEmail: string, bEmail: string) {
    const [a, b] = [await userId(aEmail), await userId(bEmail)];
    return withPool(async (pool) => {
      const r = await pool.query(
        `SELECT status FROM "Connection"
          WHERE ("requesterId" = $1 AND "receiverId" = $2)
             OR ("requesterId" = $2 AND "receiverId" = $1)`,
        [a, b],
      );
      return r.rows[0]?.status ?? "NONE";
    });
  }

  const actions = (page: Page) =>
    page.locator("[data-relationship-state]").first();

  /**
   * Optimistic UI flips before the server responds, so DB assertions must wait
   * for the server action POST to settle. This is a synchronisation barrier,
   * not a retry: the response is awaited exactly once.
   */
  function serverActionSettled(page: Page) {
    return page.waitForResponse((response) => {
      const request = response.request();
      return (
        request.method() === "POST" &&
        new URL(response.url()).pathname.startsWith("/u/") &&
        response.status() < 400
      );
    });
  }

  test.afterEach(async () => {
    const ids = [...createdSessionIds];
    createdSessionIds.clear();
    if (ids.length) {
      await withPool((pool) =>
        pool.query(`DELETE FROM "Session" WHERE id = ANY($1::text[])`, [ids]),
      );
    }
  });

  test.afterAll(async () => {
    // Restore the canonical alice<->bob ACCEPTED fixture.
    await createConnection(ALICE, BOB, "ACCEPTED");
    await resetPair(CAROL, BOB);
    await resetPair(CAROL, ALICE);
  });

  test("UNKNOWN exposes Connect, Block and Report only", async ({ page }) => {
    await resetPair(CAROL, BOB);
    await createSession(page, CAROL);
    await page.goto(`${BASE}/u/${await usernameOf(BOB)}`);

    const root = actions(page);
    await expect(root).toHaveAttribute("data-relationship-state", "UNKNOWN");
    await expect(root.getByRole("button", { name: "Connect" })).toBeVisible();
    await expect(root.getByRole("button", { name: "Block" })).toBeVisible();
    await expect(root.getByRole("link", { name: "Report" })).toBeVisible();
    await expect(root.getByRole("button", { name: "Message" })).toHaveCount(0);
  });

  test("Connect gives immediate Pending feedback before the server responds", async ({
    page,
  }) => {
    await resetPair(CAROL, BOB);
    await createSession(page, CAROL);
    await page.goto(`${BASE}/u/${await usernameOf(BOB)}`);

    // Hold the server action in flight so the assertion can only pass if the
    // UI updated optimistically rather than after the round-trip.
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/u/**", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      await held;
      return route.fallback();
    });

    const root = actions(page);
    await root.getByRole("button", { name: "Connect" }).click();

    // Immediate feedback: OUTGOING while the mutation is still in flight.
    await expect(root).toHaveAttribute("data-relationship-state", "OUTGOING", {
      timeout: 3000,
    });
    await expect(root.getByRole("button", { name: "Pending" })).toBeVisible();

    const settled = serverActionSettled(page);
    release();
    await settled;
    await expect(root).toHaveAttribute("data-relationship-state", "OUTGOING");
    await expect
      .poll(() => connectionStatus(CAROL, BOB), { timeout: 10_000 })
      .toBe("PENDING");
  });

  test("OUTGOING exposes Pending and Cancel Request, and cancelling returns to Connect", async ({
    page,
  }) => {
    await createConnection(CAROL, BOB, "PENDING");
    await createSession(page, CAROL);
    await page.goto(`${BASE}/u/${await usernameOf(BOB)}`);

    const root = actions(page);
    await expect(root).toHaveAttribute("data-relationship-state", "OUTGOING");
    await expect(root.getByRole("button", { name: "Pending" })).toBeVisible();
    await expect(root.getByRole("button", { name: "Message" })).toHaveCount(0);

    const settled = serverActionSettled(page);
    await root.getByRole("button", { name: "Cancel Request" }).click();
    await expect(root).toHaveAttribute("data-relationship-state", "UNKNOWN");
    await expect(root.getByRole("button", { name: "Connect" })).toBeVisible();
    await settled;
    await expect
      .poll(() => connectionStatus(CAROL, BOB), { timeout: 10_000 })
      .not.toBe("PENDING");
  });

  test("INCOMING exposes Accept and Decline, and accepting reaches CONNECTED", async ({
    page,
  }) => {
    await createConnection(BOB, CAROL, "PENDING");
    await createSession(page, CAROL);
    await page.goto(`${BASE}/u/${await usernameOf(BOB)}`);

    const root = actions(page);
    await expect(root).toHaveAttribute("data-relationship-state", "INCOMING");
    await expect(
      root.getByRole("button", { name: "Accept Connection" }),
    ).toBeVisible();
    await expect(root.getByRole("button", { name: "Decline" })).toBeVisible();

    const settled = serverActionSettled(page);
    await root.getByRole("button", { name: "Accept Connection" }).click();
    await expect(root).toHaveAttribute("data-relationship-state", "CONNECTED");
    await settled;
    await expect
      .poll(() => connectionStatus(CAROL, BOB), { timeout: 10_000 })
      .toBe("ACCEPTED");
  });

  test("Decline removes the incoming request", async ({ page }) => {
    await createConnection(BOB, CAROL, "PENDING");
    await createSession(page, CAROL);
    await page.goto(`${BASE}/u/${await usernameOf(BOB)}`);

    const root = actions(page);
    await expect(root).toHaveAttribute("data-relationship-state", "INCOMING");
    const settled = serverActionSettled(page);
    await root.getByRole("button", { name: "Decline" }).click();
    await expect(root).toHaveAttribute("data-relationship-state", "UNKNOWN");
    await settled;
    await expect
      .poll(() => connectionStatus(CAROL, BOB), { timeout: 10_000 })
      .not.toBe("PENDING");
  });

  test("CONNECTED exposes Message and Remove Connection", async ({ page }) => {
    await createConnection(CAROL, BOB, "ACCEPTED");
    await createSession(page, CAROL);
    await page.goto(`${BASE}/u/${await usernameOf(BOB)}`);

    const root = actions(page);
    await expect(root).toHaveAttribute("data-relationship-state", "CONNECTED");
    await expect(
      root.getByRole("button", { name: "Remove Connection" }),
    ).toBeVisible();
    await expect(root.getByRole("button", { name: "Block" })).toBeVisible();
    await expect(root.getByRole("link", { name: "Report" })).toBeVisible();

    const settled = serverActionSettled(page);
    await root.getByRole("button", { name: "Remove Connection" }).click();
    await expect(root).toHaveAttribute("data-relationship-state", "UNKNOWN");
    await settled;
    await expect
      .poll(() => connectionStatus(CAROL, BOB), { timeout: 10_000 })
      .not.toBe("ACCEPTED");
  });

  test("Block immediately suppresses incompatible actions and reaches BLOCKED", async ({
    page,
  }) => {
    await resetPair(CAROL, BOB);
    await createSession(page, CAROL);
    await page.goto(`${BASE}/u/${await usernameOf(BOB)}`);

    const root = actions(page);
    await expect(root).toHaveAttribute("data-relationship-state", "UNKNOWN");
    await root.getByRole("button", { name: "Block" }).click();

    await expect(root).toHaveAttribute("data-relationship-state", "BLOCKED");
    // BLOCKED must never expose Connect, Send Request or Message.
    await expect(root.getByRole("button", { name: "Connect" })).toHaveCount(0);
    await expect(
      root.getByRole("button", { name: "Send Request" }),
    ).toHaveCount(0);
    await expect(root.getByRole("button", { name: "Message" })).toHaveCount(0);
    await expect(root.getByRole("button", { name: "Unblock" })).toBeVisible();
    await expect(root.getByRole("link", { name: "Report" })).toBeVisible();
  });

  test("BLOCKED exposes Unblock and Report only, and unblocking does not restore a connection", async ({
    page,
  }) => {
    await createBlock(CAROL, BOB);
    await createSession(page, CAROL);
    await page.goto(`${BASE}/u/${await usernameOf(BOB)}`);

    const root = actions(page);
    await expect(root).toHaveAttribute("data-relationship-state", "BLOCKED");
    await expect(root.getByRole("button", { name: "Connect" })).toHaveCount(0);
    await expect(root.getByRole("button", { name: "Message" })).toHaveCount(0);

    const settled = serverActionSettled(page);
    await root.getByRole("button", { name: "Unblock" }).click();
    await expect(root).toHaveAttribute("data-relationship-state", "UNKNOWN");
    await settled;
    // Unblocking must not automatically restore a previous connection.
    await expect
      .poll(() => connectionStatus(CAROL, BOB), { timeout: 10_000 })
      .not.toBe("ACCEPTED");
  });

  test("duplicate submissions are prevented while a mutation is pending", async ({
    page,
  }) => {
    await resetPair(CAROL, BOB);
    await createSession(page, CAROL);
    await page.goto(`${BASE}/u/${await usernameOf(BOB)}`);

    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let posts = 0;
    await page.route("**/u/**", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      posts += 1;
      await held;
      return route.fallback();
    });

    const root = actions(page);
    const connect = root.getByRole("button", { name: "Connect" });
    await connect.click();
    // Every control is disabled while the mutation is in flight.
    await expect(root.getByRole("button", { name: "Block" })).toBeDisabled();

    release();
    await expect(root).toHaveAttribute("data-relationship-state", "OUTGOING");
    expect(posts).toBe(1);
  });
});
