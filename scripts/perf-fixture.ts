/**
 * Disposable performance fixture generator.
 *
 * The acceptance fixture (5 users / ~236 messages) is far too small to expose
 * pagination, N+1 or projection problems. This script generates a larger,
 * deterministic, namespaced dataset so scale can be measured without touching
 * the fixtures the acceptance suite depends on.
 *
 * Safety model:
 *   - refuses any non-loopback host
 *   - refuses Production fingerprints
 *   - refuses databases not named perx_test / perx_e2e
 *   - every row it creates is namespaced `perfscale-<size>-`
 *   - `--cleanup` removes exactly that namespace and nothing else
 *
 * Generated accounts are marked INTERNAL_TEST_USER so they cannot be mistaken
 * for beta capacity, and are never referenced by acceptance tests.
 *
 * Usage:
 *   npx tsx scripts/perf-fixture.ts --size=small
 *   npx tsx scripts/perf-fixture.ts --size=medium
 *   npx tsx scripts/perf-fixture.ts --cleanup
 */
import crypto from "node:crypto";

import { Pool } from "pg";

const PRODUCTION_FINGERPRINTS = [
  "aws-0-eu-north-1.pooler.supabase.com",
  "qtmvausduxiqcguckfql",
  "13.60.109.208",
  "supabase.co",
  "supabase.com",
];

const SIZES = {
  medium: { conversations: 120, messagesPerConversation: 40, users: 500 },
  small: { conversations: 30, messagesPerConversation: 20, users: 50 },
} as const;

type SizeName = keyof typeof SIZES;

const NAMESPACE_PREFIX = "perfscale";

function assertSafeTarget(rawUrl: string | undefined) {
  if (!rawUrl) {
    throw new Error(
      "Safety Guard: TEST_DATABASE_URL is required for the performance fixture.",
    );
  }
  for (const fingerprint of PRODUCTION_FINGERPRINTS) {
    if (rawUrl.includes(fingerprint)) {
      throw new Error(
        `Safety Guard: refusing to generate fixtures against a Production fingerprint (${fingerprint}).`,
      );
    }
  }
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Safety Guard: TEST_DATABASE_URL is not a valid URL.");
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("Safety Guard: performance fixture requires PostgreSQL.");
  }
  if (!["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)) {
    throw new Error(
      `Safety Guard: performance fixture refuses remote host "${parsed.hostname}".`,
    );
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!/^perx_(?:test|e2e)(?:_|$)/.test(database)) {
    throw new Error(
      `Safety Guard: performance fixture requires a perx_test/perx_e2e database, got "${database}".`,
    );
  }
  return { database, host: parsed.hostname };
}

/** Deterministic ids so repeated runs are idempotent. */
function stableId(namespace: string, kind: string, index: number) {
  const hash = crypto
    .createHash("sha256")
    .update(`${namespace}:${kind}:${index}`)
    .digest("hex");
  return `c${hash.slice(0, 24)}`;
}

async function cleanup(pool: Pool) {
  const like = `${NAMESPACE_PREFIX}-%`;
  // Ordered by dependency; every predicate is namespace-scoped.
  await pool.query(
    `DELETE FROM "Message" WHERE "conversationId" IN (
       SELECT id FROM "Conversation" WHERE id LIKE $1)`,
    [like],
  );
  await pool.query(
    `DELETE FROM "ConversationParticipant" WHERE "conversationId" IN (
       SELECT id FROM "Conversation" WHERE id LIKE $1)`,
    [like],
  );
  await pool.query(`DELETE FROM "Conversation" WHERE id LIKE $1`, [like]);
  await pool.query(
    `DELETE FROM "Notification" WHERE "userId" IN (
     SELECT id FROM "User" WHERE email LIKE $1)`,
    [like],
  );
  await pool.query(
    `DELETE FROM "Session" WHERE "userId" IN (
     SELECT id FROM "User" WHERE email LIKE $1)`,
    [like],
  );
  await pool.query(
    `DELETE FROM "UserRole" WHERE "userId" IN (
     SELECT id FROM "User" WHERE email LIKE $1)`,
    [like],
  );
  await pool.query(
    `DELETE FROM "Profile" WHERE "userId" IN (
     SELECT id FROM "User" WHERE email LIKE $1)`,
    [like],
  );
  await pool.query(`DELETE FROM "User" WHERE email LIKE $1`, [like]);
}

async function generate(pool: Pool, size: SizeName) {
  const spec = SIZES[size];
  const namespace = `${NAMESPACE_PREFIX}-${size}`;

  const memberRole = await pool.query<{ id: string }>(
    `SELECT id FROM "Role" WHERE name = 'MEMBER' LIMIT 1`,
  );
  if (!memberRole.rows[0]) {
    throw new Error("Baseline roles missing: run the normal seed first.");
  }
  const roleId = memberRole.rows[0].id;

  const userIds: string[] = [];
  for (let i = 0; i < spec.users; i += 1) {
    const id = stableId(namespace, "user", i);
    userIds.push(id);
    await pool.query(
      `INSERT INTO "User" (id, email, username, name, "passwordHash",
                           "accountClassification", "isActive", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,'INTERNAL_TEST_USER',true,NOW(),NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        id,
        `${namespace}-user-${i}@perf.invalid`,
        `${namespace.replace(/-/g, "_")}_u${i}`,
        `Perf User ${i}`,
        `perf-fixture-no-login-${i}`,
      ],
    );
    await pool.query(
      `INSERT INTO "UserRole" (id, "userId", "roleId")
       VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [stableId(namespace, "userrole", i), id, roleId],
    );
    await pool.query(
      `INSERT INTO "Profile" (id, "userId", headline, biography, location, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,'Lagos',NOW(),NOW()) ON CONFLICT DO NOTHING`,
      [
        stableId(namespace, "profile", i),
        id,
        `Perf headline ${i}`,
        `Generated biography for performance fixture user ${i}.`,
      ],
    );
  }

  // Conversations always include user 0 so one account has a large inbox,
  // which is what actually exercises list pagination.
  for (let c = 0; c < spec.conversations; c += 1) {
    const conversationId = stableId(namespace, "conversation", c);
    const other = userIds[(c % (spec.users - 1)) + 1]!;
    await pool.query(
      `INSERT INTO "Conversation" (id, status, "createdAt", "updatedAt")
       VALUES ($1, 'ACTIVE', NOW(), NOW()) ON CONFLICT (id) DO NOTHING`,
      [conversationId],
    );
    for (const [index, participant] of [userIds[0]!, other].entries()) {
      await pool.query(
        `INSERT INTO "ConversationParticipant" (id, "conversationId", "userId", "createdAt")
         VALUES ($1,$2,$3,NOW()) ON CONFLICT DO NOTHING`,
        [
          stableId(namespace, `participant-${c}`, index),
          conversationId,
          participant,
        ],
      );
    }
    for (let m = 0; m < spec.messagesPerConversation; m += 1) {
      await pool.query(
        `INSERT INTO "Message" (id, "conversationId", "senderId", body, "createdAt")
         VALUES ($1,$2,$3,$4, NOW() - ($5 || ' minutes')::interval)
         ON CONFLICT (id) DO NOTHING`,
        [
          stableId(namespace, `message-${c}`, m),
          conversationId,
          m % 2 === 0 ? userIds[0]! : other,
          `Perf message ${m} in conversation ${c}. Representative body length for payload measurement.`,
          String(spec.messagesPerConversation - m),
        ],
      );
    }
  }

  // Notifications for the primary account: exercises the notification page.
  for (let n = 0; n < 120; n += 1) {
    await pool.query(
      `INSERT INTO "Notification" (id, "userId", type, title, body, "actionUrl", metadata, "createdAt")
       VALUES ($1,$2,'BROADCAST',$3,$4,'/app', '{}'::jsonb, NOW() - ($5 || ' minutes')::interval)
       ON CONFLICT (id) DO NOTHING`,
      [
        stableId(namespace, "notification", n),
        userIds[0]!,
        `Perf notification ${n}`,
        `Generated notification body ${n} for performance measurement.`,
        String(120 - n),
      ],
    );
  }

  return { namespace, primaryUserId: userIds[0]!, spec };
}

async function main() {
  const args = process.argv.slice(2);
  const wantsCleanup = args.includes("--cleanup");
  const sizeArg = args.find((a) => a.startsWith("--size="))?.split("=")[1];
  const size = (sizeArg ?? "small") as SizeName;

  if (!wantsCleanup && !SIZES[size]) {
    throw new Error(`Unknown size "${size}". Use small or medium.`);
  }

  const url = process.env.TEST_DATABASE_URL;
  const target = assertSafeTarget(url);
  console.log(
    `perf fixture target: ${target.host}/${target.database} (loopback verified)`,
  );

  const pool = new Pool({ connectionString: url, ssl: false });
  try {
    if (wantsCleanup) {
      await cleanup(pool);
      console.log("perf fixture removed.");
      return;
    }
    await cleanup(pool);
    const result = await generate(pool, size);
    // Ids are hashed, so counts are scoped through the namespaced accounts
    // rather than an id prefix.
    const counts = await pool.query<{
      conversations: string;
      messages: string;
      notifications: string;
      users: string;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM "User" WHERE email LIKE $1) AS users,
         (SELECT COUNT(*) FROM "ConversationParticipant" WHERE "userId" = $2) AS conversations,
         (SELECT COUNT(*) FROM "Message" WHERE "senderId" IN (
            SELECT id FROM "User" WHERE email LIKE $1)) AS messages,
         (SELECT COUNT(*) FROM "Notification" WHERE "userId" = $2) AS notifications`,
      [`${result.namespace}-%`, result.primaryUserId],
    );
    console.log(
      JSON.stringify(
        {
          namespace: result.namespace,
          primaryUserId: result.primaryUserId,
          size,
          totals: counts.rows[0],
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
