import "dotenv/config";

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

function splitSql(sql) {
  const statements = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let dollarTag = null;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];

    if (dollarTag !== null) {
      current += char;
      if (char === "$" && current.endsWith(`$${dollarTag}$`)) {
        dollarTag = null;
      }
      continue;
    }

    if (inSingleQuote) {
      current += char;
      if (char === "'" && next === "'") {
        current += next;
        index += 1;
        continue;
      }
      if (char === "'") inSingleQuote = false;
      continue;
    }

    if (inDoubleQuote) {
      current += char;
      if (char === '"') inDoubleQuote = false;
      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
      current += char;
      continue;
    }

    if (char === '"') {
      inDoubleQuote = true;
      current += char;
      continue;
    }

    if (char === "$") {
      const match = sql.slice(index).match(/^\$([A-Za-z_][A-Za-z0-9_]*)?\$/);
      if (match) {
        dollarTag = match[1] ?? "";
        current += match[0];
        index += match[0].length - 1;
        continue;
      }
    }

    if (char === ";") {
      if (current.trim()) statements.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
}

async function main() {
  const migrationName = process.argv[2];
  if (!migrationName) {
    throw new Error("Usage: node scripts/apply-migration-once.mjs <migration-name>");
  }

  const migrationPath = path.join(
    "prisma",
    "migrations",
    migrationName,
    "migration.sql",
  );
  const sql = fs.readFileSync(migrationPath, "utf8");
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("No database URL configured.");

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    const existing = await client.query(
      "SELECT 1 FROM _prisma_migrations WHERE migration_name = $1 LIMIT 1",
      [migrationName],
    );
    if (existing.rowCount) {
      console.log(`Migration already recorded: ${migrationName}`);
      return;
    }

    const statements = splitSql(sql);
    for (const statement of statements) {
      await client.query(statement);
    }

    await client.query(
      `INSERT INTO _prisma_migrations (
        id,
        checksum,
        finished_at,
        migration_name,
        logs,
        rolled_back_at,
        started_at,
        applied_steps_count
      )
      VALUES ($1, $2, NOW(), $3, NULL, NULL, NOW(), $4)`,
      [
        crypto.randomUUID(),
        crypto.createHash("sha256").update(sql).digest("hex"),
        migrationName,
        statements.length,
      ],
    );

    console.log(`Migration applied and recorded: ${migrationName}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Migration failed: ${error.message}`);
  process.exit(1);
});
