/**
 * Measures the database cost of one SSE tick in /api/messages/events.
 *
 * Loopback-guarded: refuses to run against anything but 127.0.0.1/localhost.
 * Read-only - issues SELECTs only.
 */
import { createRequire } from "node:module";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");
const require = createRequire(path.join(rootDir, "package.json"));
const pg = require("pg");

const url = process.env.DATABASE_URL ?? "";
let parsed;
try {
  parsed = new URL(url);
} catch {
  console.error("DATABASE_URL is not set or not a URL.");
  process.exit(1);
}
if (!["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)) {
  console.error(`REFUSED: host ${parsed.hostname} is not loopback.`);
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, statement_timeout: 30_000 });
await client.connect();

const STREAM_INTERVAL_MS = 2000;
const LIST_REFRESH_MS = 10000;

// Queries Prisma emits for one getMessageSnapshot() call with a conversationId.
// Derived from conversationSnapshotInclude(): the parent findMany plus one
// query per relation loaded (Prisma issues separate queries per include).
const RELATIONS_PER_SNAPSHOT = [
  "conversation (parent findMany)",
  "messages",
  "messages.sender",
  "messages.replyTo",
  "messages.readReceipts",
  "participants",
  "participants.user",
  "participants.user.profile",
  "events",
  "opportunity",
  "_count.proposals",
];

console.log("=== SSE tick cost: /api/messages/events ===\n");
console.log(`stream interval          : ${STREAM_INTERVAL_MS} ms`);
console.log(`conversation list refresh: ${LIST_REFRESH_MS} ms\n`);

console.log("Relation loads per getMessageSnapshot() call:");
for (const relation of RELATIONS_PER_SNAPSHOT) console.log(`  - ${relation}`);
const perSnapshot = RELATIONS_PER_SNAPSHOT.length;
console.log(`  => ~${perSnapshot} queries per snapshot\n`);

// A tick with the conversation list due runs loadConversations TWICE
// (exact + list, via Promise.all), so the relation set is paid twice.
const tickWithoutList = perSnapshot;
const tickWithList = perSnapshot * 2;
const ticksPerMin = 60_000 / STREAM_INTERVAL_MS;
const listTicksPerMin = 60_000 / LIST_REFRESH_MS;
const plainTicksPerMin = ticksPerMin - listTicksPerMin;

// getMessageMutationsAfter adds one query on every tick with a cursor.
const mutationQueryPerTick = 1;

const perMin =
  plainTicksPerMin * (tickWithoutList + mutationQueryPerTick) +
  listTicksPerMin * (tickWithList + mutationQueryPerTick);

console.log("Per connected client, per minute:");
console.log(`  ticks                    : ${ticksPerMin}`);
console.log(`  of which refresh the list: ${listTicksPerMin}`);
console.log(`  estimated queries/minute : ~${perMin}`);
console.log(`  estimated queries/hour   : ~${perMin * 60}\n`);

console.log("Scaled (one open tab each):");
for (const users of [1, 10, 100, 1000]) {
  const qps = (perMin * users) / 60;
  console.log(
    `  ${String(users).padStart(4)} concurrent -> ~${Math.round(perMin * users).toLocaleString()} q/min  (~${Math.round(qps).toLocaleString()} q/s)`,
  );
}

// Measure the real latency of the heaviest component: the message page read.
const { rows: convRows } = await client.query(
  `SELECT id FROM "Conversation" ORDER BY "updatedAt" DESC LIMIT 1`,
);

if (convRows.length) {
  const conversationId = convRows[0].id;
  const sample = async (label, text, values) => {
    const timings = [];
    for (let i = 0; i < 30; i += 1) {
      const started = process.hrtime.bigint();
      await client.query(text, values);
      timings.push(Number(process.hrtime.bigint() - started) / 1e6);
    }
    timings.sort((a, b) => a - b);
    console.log(
      `  ${label.padEnd(34)} median ${timings[15].toFixed(2)} ms   p95 ${timings[28].toFixed(2)} ms`,
    );
  };

  console.log("\nMeasured latency (local, near-empty dataset):");
  await sample(
    "messages page (take 51 desc)",
    `SELECT id, body, "createdAt" FROM "Message"
      WHERE "conversationId" = $1 ORDER BY "createdAt" DESC, id DESC LIMIT 51`,
    [conversationId],
  );
  await sample(
    "conversation list (take 51 desc)",
    `SELECT id FROM "Conversation" ORDER BY "updatedAt" DESC, id DESC LIMIT 51`,
    [],
  );

  const plan = await client.query(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      SELECT id, body, "createdAt" FROM "Message"
       WHERE "conversationId" = $1 ORDER BY "createdAt" DESC, id DESC LIMIT 51`,
    [conversationId],
  );
  console.log("\nPlan for the messages page read:");
  for (const row of plan.rows) console.log(`  ${row["QUERY PLAN"]}`);
} else {
  console.log("\n(no conversations in the local fixture; latency sampling skipped)");
}

const { rows: counts } = await client.query(
  `SELECT
     (SELECT count(*) FROM "Conversation") AS conversations,
     (SELECT count(*) FROM "Message")      AS messages,
     (SELECT count(*) FROM "User")         AS users`,
);
console.log(
  `\nLocal fixture: ${counts[0].users} users, ${counts[0].conversations} conversations, ${counts[0].messages} messages`,
);
console.log("(Latency numbers are indicative only at this size.)");

await client.end();
