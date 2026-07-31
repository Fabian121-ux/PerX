import "dotenv/config";

import crypto from "node:crypto";
import { Client } from "pg";

const baseUrl = process.env.PERX_LIVE_BASE_URL ?? "https://per-x-ashen.vercel.app";
const adminId = process.env.PERX_LIVE_ADMIN_USER_ID ?? "cmrw0tjql000004lb02rg24d0";
const cookieName = process.env.SESSION_COOKIE_NAME ?? "perx_session";
const confirmation = process.env.PERX_LIVE_ADMIN_SMOKE_CONFIRM;

if (confirmation !== "CREATE_SHORT_LIVED_ADMIN_SMOKE_SESSION") {
  throw new Error(
    "Set PERX_LIVE_ADMIN_SMOKE_CONFIRM=CREATE_SHORT_LIVED_ADMIN_SMOKE_SESSION to run.",
  );
}

function extractDigest(html) {
  return (
    html.match(/digest["']?\s*[:=]\s*["']?([0-9a-fA-F]+)/)?.[1] ??
    html.match(/Application error:\s*([^<]+)/)?.[1]?.trim() ??
    ""
  );
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const sessionId = `smoke_${crypto.randomUUID()}`;

  await client.connect();
  try {
    const role = await client.query(
      `SELECT 1
       FROM "User" u
       JOIN "UserRole" ur ON ur."userId" = u.id
       JOIN "Role" r ON r.id = ur."roleId"
       WHERE u.id = $1 AND r.name = $2 AND u."isActive" = true
       LIMIT 1`,
      [adminId, "MASTER_ADMIN"],
    );
    if (!role.rowCount) {
      throw new Error("Master Admin role is not present for the requested smoke user.");
    }

    await client.query(
      `INSERT INTO "Session" (
        id,
        "tokenHash",
        "userId",
        "expiresAt",
        "createdAt",
        "lastSeenAt"
      )
      VALUES ($1, $2, $3, NOW() + interval '20 minutes', NOW(), NOW())`,
      [sessionId, tokenHash, adminId],
    );

    const cases = await client.query(
      `SELECT id FROM "ModerationCase" ORDER BY "createdAt" DESC LIMIT 5`,
    );
    const routes = [
      "/admin/messages",
      "/admin/reports",
      "/admin/moderation",
      "/admin/deals",
      `/admin/users/${adminId}`,
      `/admin/users/${adminId}/enforcement`,
      ...cases.rows.map((row) => `/admin/moderation/cases/${row.id}`),
    ];

    for (const route of routes) {
      const response = await fetch(`${baseUrl}${route}`, {
        headers: { cookie: `${cookieName}=${token}` },
        redirect: "manual",
      });
      const html = await response.text();
      console.log(
        JSON.stringify({
          digest: response.status >= 500 ? extractDigest(html) : "",
          route,
          status: response.status,
        }),
      );
    }
  } finally {
    await client
      .query(`DELETE FROM "Session" WHERE id = $1`, [sessionId])
      .catch(() => {});
    await client.end();
  }
}

main().catch((error) => {
  console.error(`admin smoke failed: ${error.message}`);
  process.exit(1);
});
