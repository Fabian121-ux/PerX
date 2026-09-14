import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Drift detection for the September outage.
 *
 * A merged-but-unapplied migration left production running code its database
 * had never seen, for 15 days. Prisma printed `relation does not exist` on
 * every request and nothing was watching, so this is an alerting problem: the
 * running application is the only place that holds both numbers (what the repo
 * expects, what the database applied) and must report its own drift.
 *
 * The load-bearing property is that this check can never itself cause an
 * outage. Every failure path must resolve to `indeterminate`, never a throw.
 */

const mocks = vi.hoisted(() => ({
  getResolvedDataMode: vi.fn(),
  hasDatabaseUrl: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({ $queryRaw: mocks.queryRaw }),
}));

vi.mock("@/lib/env", () => ({
  getResolvedDataMode: mocks.getResolvedDataMode,
  hasDatabaseUrl: mocks.hasDatabaseUrl,
}));

vi.mock("@/generated/migration-manifest", () => ({
  MIGRATION_MANIFEST: [
    "0001_init",
    "0002_open_beta_registration",
    "20260827150000_trader_applications",
  ] as readonly string[],
}));

import {
  __resetMigrationDriftCacheForTest,
  getMigrationDrift,
} from "@/lib/db/migration-drift";

function appliedRows(names: string[]) {
  return names.map((migration_name) => ({ migration_name }));
}

describe("migration drift detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetMigrationDriftCacheForTest();
    mocks.getResolvedDataMode.mockReturnValue("database");
    mocks.hasDatabaseUrl.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports current when every expected migration is applied", async () => {
    mocks.queryRaw.mockResolvedValue(
      appliedRows([
        "0001_init",
        "0002_open_beta_registration",
        "20260827150000_trader_applications",
      ]),
    );

    const result = await getMigrationDrift();

    expect(result.state).toBe("current");
    expect(result.pending).toEqual([]);
    expect(result.unknownApplied).toEqual([]);
  });

  it("reports pending and names the missing migration (the September scenario)", async () => {
    // Exactly the outage: the repo carries a migration the database never ran.
    mocks.queryRaw.mockResolvedValue(
      appliedRows(["0001_init", "0002_open_beta_registration"]),
    );

    const result = await getMigrationDrift();

    expect(result.state).toBe("pending");
    expect(result.pending).toEqual(["20260827150000_trader_applications"]);
    expect(result.unknownApplied).toEqual([]);
  });

  it("keeps a database-ahead rollback distinct from in sync", async () => {
    mocks.queryRaw.mockResolvedValue(
      appliedRows([
        "0001_init",
        "0002_open_beta_registration",
        "20260827150000_trader_applications",
        "20260901120000_applied_by_another_deployment",
      ]),
    );

    const result = await getMigrationDrift();

    // Must not be silently "current": the database has something this build
    // does not know about, which is a rollback or a foreign deployment.
    expect(result.state).toBe("unknown-applied");
    expect(result.unknownApplied).toEqual([
      "20260901120000_applied_by_another_deployment",
    ]);
    expect(result.pending).toEqual([]);
  });

  it("reports pending when the repo is ahead and the database is also ahead", async () => {
    // Both directions at once. Pending is the more urgent fact: code is running
    // against a schema that lacks something it expects.
    mocks.queryRaw.mockResolvedValue(
      appliedRows(["0001_init", "20260901120000_foreign"]),
    );

    const result = await getMigrationDrift();

    expect(result.state).toBe("pending");
    expect(result.pending).toEqual([
      "0002_open_beta_registration",
      "20260827150000_trader_applications",
    ]);
    expect(result.unknownApplied).toEqual(["20260901120000_foreign"]);
  });

  it("returns indeterminate instead of throwing when the query fails", async () => {
    mocks.queryRaw.mockRejectedValue(
      new Error('relation "_prisma_migrations" does not exist'),
    );

    const result = await getMigrationDrift();

    expect(result.state).toBe("indeterminate");
    expect(result.pending).toEqual([]);
  });

  it("never throws even if the Prisma client itself blows up", async () => {
    mocks.queryRaw.mockImplementation(() => {
      throw new Error("connection pool exhausted");
    });

    await expect(getMigrationDrift()).resolves.toMatchObject({
      state: "indeterminate",
    });
  });

  it("returns indeterminate in mock mode without querying", async () => {
    mocks.getResolvedDataMode.mockReturnValue("mock");

    const result = await getMigrationDrift();

    expect(result.state).toBe("indeterminate");
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });

  it("returns indeterminate when DATABASE_URL is absent without querying", async () => {
    mocks.hasDatabaseUrl.mockReturnValue(false);

    const result = await getMigrationDrift();

    expect(result.state).toBe("indeterminate");
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });

  it("returns indeterminate when resolving the data mode itself throws", async () => {
    mocks.getResolvedDataMode.mockImplementation(() => {
      throw new Error("Missing required environment variable(s).");
    });

    await expect(getMigrationDrift()).resolves.toMatchObject({
      state: "indeterminate",
    });
  });

  it("caches within the TTL so health checks do not add a query per request", async () => {
    mocks.queryRaw.mockResolvedValue(
      appliedRows([
        "0001_init",
        "0002_open_beta_registration",
        "20260827150000_trader_applications",
      ]),
    );

    await getMigrationDrift();
    await getMigrationDrift();
    await getMigrationDrift();

    expect(mocks.queryRaw).toHaveBeenCalledTimes(1);
  });

  it("re-queries once the TTL has elapsed", async () => {
    vi.useFakeTimers();
    mocks.queryRaw.mockResolvedValue(appliedRows(["0001_init"]));

    await getMigrationDrift();
    vi.advanceTimersByTime(61_000);
    await getMigrationDrift();

    expect(mocks.queryRaw).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("does not cache an indeterminate result as if it were a real answer", async () => {
    mocks.queryRaw.mockRejectedValueOnce(new Error("transient"));
    const first = await getMigrationDrift();
    expect(first.state).toBe("indeterminate");

    mocks.queryRaw.mockResolvedValue(
      appliedRows([
        "0001_init",
        "0002_open_beta_registration",
        "20260827150000_trader_applications",
      ]),
    );
    const second = await getMigrationDrift();

    // A failed probe must not pin the app to "indeterminate" for the whole TTL.
    expect(second.state).toBe("current");
  });

  it("ignores rows that never finished or were rolled back", async () => {
    // The SQL filters these, but the contract is asserted here so a future
    // edit to the WHERE clause cannot silently start counting them.
    await getMigrationDrift();

    const [query] = mocks.queryRaw.mock.calls[0] as [{ strings?: string[] }];
    const sql = Array.isArray(query) ? query.join("") : String(query);
    expect(sql).toMatch(/finished_at\s+IS\s+NOT\s+NULL/i);
    expect(sql).toMatch(/rolled_back_at\s+IS\s+NULL/i);
  });
});
