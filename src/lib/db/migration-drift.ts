import { MIGRATION_MANIFEST } from "@/generated/migration-manifest";
import { getPrisma } from "@/lib/db/prisma";
import { getResolvedDataMode, hasDatabaseUrl } from "@/lib/env";

/**
 * Runtime schema-drift detection.
 *
 * Why this lives in the application and not in CI: CI has no Production
 * credentials and must never be given any, so it cannot know what Production
 * has actually applied. The running application is the only place that holds
 * both numbers - the manifest it was built with, and the rows in
 * `_prisma_migrations` it can see right now.
 *
 * The September outage was not a missing signal. `src/lib/db/prisma.ts` sets
 * `log: ["error"]`, so Prisma printed `relation does not exist` on every single
 * request for 15 days. Nobody was reading the server console. So this module
 * exists to turn that latent information into something a health monitor polls
 * and an operator is paged by.
 *
 * HARD CONSTRAINT: this must never throw. A drift check that can fail closed
 * would become an outage of its own - exactly the class of problem it is meant
 * to catch. Every failure path resolves to `indeterminate`.
 */

export type MigrationDriftState =
  /** Manifest and database agree. */
  | "current"
  /** Repo is ahead: migrations exist that the database has not applied. */
  | "pending"
  /** Database is ahead: applied rows this build does not know about. */
  | "unknown-applied"
  /** The check could not run. NOT evidence of drift. */
  | "indeterminate";

export type MigrationDrift = {
  /** Expected by this build, not applied to the database. Empty unless `pending`. */
  pending: readonly string[];
  state: MigrationDriftState;
  /** Applied to the database, absent from this build's manifest. */
  unknownApplied: readonly string[];
};

type MigrationRow = { migration_name: string };

/**
 * Cache TTL.
 *
 * 60s: long enough that a health monitor polling every few seconds and an
 * admin page load cost at most one query per minute, short enough that an
 * operator who has just run `migrate deploy` sees the result without
 * redeploying or waiting meaningfully.
 */
const CACHE_TTL_MS = 60_000;

const INDETERMINATE: MigrationDrift = {
  pending: [],
  state: "indeterminate",
  unknownApplied: [],
};

let cached: { expiresAt: number; value: MigrationDrift } | null = null;

/**
 * Compare the build's manifest against what the database reports as applied.
 *
 * `pending` takes precedence over `unknown-applied` when both are non-empty:
 * code running against a schema that lacks something it expects is the more
 * urgent fact, and it is the failure mode that caused the outage.
 */
function compare(applied: readonly string[]): MigrationDrift {
  const appliedSet = new Set(applied);
  const expectedSet = new Set(MIGRATION_MANIFEST);

  const pending = MIGRATION_MANIFEST.filter((name) => !appliedSet.has(name));
  const unknownApplied = applied
    .filter((name) => !expectedSet.has(name))
    .sort();

  if (pending.length > 0) return { pending, state: "pending", unknownApplied };
  if (unknownApplied.length > 0) {
    return { pending: [], state: "unknown-applied", unknownApplied };
  }
  return { pending: [], state: "current", unknownApplied: [] };
}

/**
 * Current drift state, cached for {@link CACHE_TTL_MS}.
 *
 * Resolves to `indeterminate` rather than throwing under every failure:
 * mock mode, absent DATABASE_URL, unreadable environment, a missing
 * `_prisma_migrations` table, or a connection failure.
 */
export async function getMigrationDrift(): Promise<MigrationDrift> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;

  try {
    // A database is not always configured: mock mode is legitimate in local
    // development, and the check has nothing to compare against there.
    if (getResolvedDataMode() === "mock" || !hasDatabaseUrl()) {
      return INDETERMINATE;
    }

    /*
     * `_prisma_migrations` is Prisma's own bookkeeping table and is not part of
     * `schema.prisma`, so there is no typed model for it and this must be raw.
     * The query takes no input of any kind - nothing here is interpolated, so
     * there is no injection surface to parameterise.
     *
     * The filters matter: a row exists from the moment a migration STARTS, so
     * counting unfinished rows would report a half-applied migration as done,
     * and counting rolled-back rows would hide a deliberate revert.
     */
    const rows = await getPrisma().$queryRaw<MigrationRow[]>`
      SELECT migration_name
      FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    `;

    const applied = rows
      .map((row) => row.migration_name)
      .filter((name): name is string => typeof name === "string");

    const value = compare(applied);
    cached = { expiresAt: now + CACHE_TTL_MS, value };
    return value;
  } catch {
    /*
     * Deliberately not cached, and deliberately silent.
     *
     * Not cached: a transient failure must not pin the deployment to
     * `indeterminate` for a whole TTL, which would mask real drift appearing
     * moments later.
     *
     * Silent: Prisma already logs the underlying error via `log: ["error"]`.
     * Logging it again here would double the noise on the exact path that was
     * already too noisy to read in September.
     */
    return INDETERMINATE;
  }
}

/** Test seam: the module-level cache would otherwise leak across test cases. */
export function __resetMigrationDriftCacheForTest() {
  cached = null;
}
