import { afterAll, beforeAll, expect, it } from "vitest";
import { createAuthorizationDatabase } from "../utils/authorization-fixtures";
import { getIsolatedTestDatabaseUrl } from "../e2e/utils/db-guard";
const dbTest = getIsolatedTestDatabaseUrl() ? it : it.skip;
let db: ReturnType<typeof createAuthorizationDatabase>;
beforeAll(() => {
  if (getIsolatedTestDatabaseUrl()) db = createAuthorizationDatabase();
});
afterAll(async () => {
  await db?.$disconnect();
});
dbTest("social persistence exists as separate PostgreSQL tables", async () => {
  const rows = await db.$queryRaw<
    { post: string | null; reaction: string | null; comment: string | null }[]
  >`
    SELECT to_regclass('"Post"')::text AS post, to_regclass('"PostReaction"')::text AS reaction, to_regclass('"PostComment"')::text AS comment`;
  expect(rows[0]).toEqual({
    post: '"Post"',
    reaction: '"PostReaction"',
    comment: '"PostComment"',
  });
});
