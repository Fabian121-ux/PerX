import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `/api/health` is PUBLIC - there is no middleware or auth gate on it.
 *
 * It must therefore report that drift exists without disclosing anything about
 * the schema: no migration names, no counts, nothing an unauthenticated caller
 * could use to fingerprint the deployment. The leak assertions below are the
 * security requirement of this change, not a nicety.
 */

const mocks = vi.hoisted(() => ({
  getMigrationDrift: vi.fn(),
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

vi.mock("@/lib/db/migration-drift", () => ({
  getMigrationDrift: mocks.getMigrationDrift,
}));

import { GET } from "@/app/api/health/route";

const PENDING_NAME = "20260827150000_trader_applications";

describe("public health route schema drift reporting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.getResolvedDataMode.mockReturnValue("database");
    mocks.hasDatabaseUrl.mockReturnValue(true);
    mocks.queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    mocks.getMigrationDrift.mockResolvedValue({
      pending: [],
      state: "current",
      unknownApplied: [],
    });
  });

  it("stays ok with schema current when everything is applied", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      database: "connected",
      schema: "current",
      status: "ok",
    });
  });

  it("reports degraded 503 when the repo is ahead of the database", async () => {
    mocks.getMigrationDrift.mockResolvedValue({
      pending: [PENDING_NAME],
      state: "pending",
      unknownApplied: [],
    });

    const response = await GET();

    // 503 is what an uptime monitor actually alerts on. A deployment whose
    // schema is behind its code genuinely is degraded.
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.status).toBe("degraded");
    expect(body.schema).toBe("drifted");
  });

  it("reports drifted when the database is ahead of the build", async () => {
    mocks.getMigrationDrift.mockResolvedValue({
      pending: [],
      state: "unknown-applied",
      unknownApplied: ["20260901120000_foreign"],
    });

    const response = await GET();

    expect(response.status).toBe(503);
    expect((await response.json()).schema).toBe("drifted");
  });

  it("reports unknown rather than drifted when the probe is indeterminate", async () => {
    mocks.getMigrationDrift.mockResolvedValue({
      pending: [],
      state: "indeterminate",
      unknownApplied: [],
    });

    const response = await GET();

    // An indeterminate probe is not evidence of drift. Claiming drift here
    // would page an operator for a check that simply could not run.
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.schema).toBe("unknown");
  });

  it("NEVER discloses migration names or counts in any state", async () => {
    const states = [
      { pending: [PENDING_NAME], state: "pending", unknownApplied: [] },
      {
        pending: [],
        state: "unknown-applied",
        unknownApplied: ["20260901120000_foreign"],
      },
      { pending: [], state: "indeterminate", unknownApplied: [] },
      { pending: [], state: "current", unknownApplied: [] },
    ];

    for (const drift of states) {
      mocks.getMigrationDrift.mockResolvedValue(drift);
      const response = await GET();
      const raw = JSON.stringify(await response.json());

      expect(raw).not.toContain(PENDING_NAME);
      expect(raw).not.toContain("20260901120000_foreign");
      expect(raw).not.toContain("trader_applications");
      expect(raw).not.toMatch(/_prisma_migrations/);
      // No counts either: a count is still a fingerprint.
      expect(raw).not.toMatch(/\d/);
    }
  });

  it("keeps the mock-mode response shape unchanged from today", async () => {
    mocks.getResolvedDataMode.mockReturnValue("mock");

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      database: "connected",
      status: "ok",
    });
  });

  it("keeps the unavailable-database response unchanged from today", async () => {
    mocks.hasDatabaseUrl.mockReturnValue(false);

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      database: "unavailable",
      status: "degraded",
    });
  });

  it("does not let a drift probe failure take the health route down", async () => {
    mocks.getMigrationDrift.mockRejectedValue(new Error("probe exploded"));

    const response = await GET();

    expect(response.status).toBe(200);
    expect((await response.json()).schema).toBe("unknown");
  });
});
