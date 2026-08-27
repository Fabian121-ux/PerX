import { getIsolatedTestDatabaseUrl } from "./db-guard";

/**
 * Fixture user identifiers owned by the E2E suite.
 *
 * Anchored with `^` so a real account can never be matched by coincidence.
 * `_` and `%` are LIKE wildcards, so every literal underscore is escaped.
 */
const FIXTURE_EMAIL_PATTERNS = [
  "profile\\_%@perx.test",
  "reset\\_%@perx.test",
  "audit-%@example.com",
  "audit\\_norm\\_%@example.com",
  "msgfixture\\_%@perx.test",
] as const;

/**
 * Remove fixture accounts left behind by earlier runs.
 *
 * Specs create these inside `try` and clean them up in `finally`, which is
 * correct until Playwright times a test out - the runner abandons the pending
 * `finally`, so the row survives. Those survivors are indistinguishable from
 * real signups to the beta capacity check
 * (`accountClassification = PUBLIC_BETA_USER`, `isActive`), so after a few
 * timeouts the cap is full and every later registration test fails for a reason
 * unrelated to what it asserts.
 *
 * Running before the suite - rather than raising the cap, which would delete
 * the very limit the capacity test exists to prove - keeps each invocation
 * starting from the seeded baseline.
 *
 * Deletion relies on the `onDelete: Cascade` declared on every `User` relation,
 * so dependent fixture rows go with the account.
 */
export async function purgeFixtureUsers(): Promise<number> {
  const databaseUrl = getIsolatedTestDatabaseUrl();
  if (!databaseUrl) return 0;

  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: databaseUrl, ssl: false });

  try {
    let removed = 0;
    for (const pattern of FIXTURE_EMAIL_PATTERNS) {
      const result = await pool.query(
        `DELETE FROM "User" WHERE email LIKE $1 ESCAPE '\\'`,
        [pattern],
      );
      removed += result.rowCount ?? 0;
    }
    return removed;
  } finally {
    await pool.end();
  }
}
