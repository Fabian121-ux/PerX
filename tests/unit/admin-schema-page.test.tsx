import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The admin surface is the only place migration names are allowed to appear.
 *
 * `/api/health` says drift exists; this page says which migrations, so an
 * operator can act without needing production database access. It is therefore
 * gated, and the gate must run before anything is rendered.
 */

const mocks = vi.hoisted(() => ({
  getMigrationDrift: vi.fn(),
  requireCapabilityOrNotFound: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireCapabilityOrNotFound: mocks.requireCapabilityOrNotFound,
}));

vi.mock("@/lib/db/migration-drift", () => ({
  getMigrationDrift: mocks.getMigrationDrift,
}));

import AdminSchemaPage from "@/app/admin/schema/page";

const PENDING_NAME = "20260827150000_trader_applications";

describe("admin schema drift page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCapabilityOrNotFound.mockResolvedValue(undefined);
    mocks.getMigrationDrift.mockResolvedValue({
      pending: [],
      state: "current",
      unknownApplied: [],
    });
  });

  it("names each pending migration so an operator can act", async () => {
    mocks.getMigrationDrift.mockResolvedValue({
      pending: [PENDING_NAME, "20260901120000_another"],
      state: "pending",
      unknownApplied: [],
    });

    const markup = renderToStaticMarkup(await AdminSchemaPage());

    expect(markup).toContain(PENDING_NAME);
    expect(markup).toContain("20260901120000_another");
  });

  it("names migrations the database applied that this build does not know", async () => {
    mocks.getMigrationDrift.mockResolvedValue({
      pending: [],
      state: "unknown-applied",
      unknownApplied: ["20260901120000_foreign"],
    });

    const markup = renderToStaticMarkup(await AdminSchemaPage());

    expect(markup).toContain("20260901120000_foreign");
  });

  it("states plainly when the schema is in sync", async () => {
    const markup = renderToStaticMarkup(await AdminSchemaPage());

    expect(markup).toMatch(/up to date|in sync/i);
    expect(markup).not.toContain(PENDING_NAME);
  });

  it("does not assert drift when the probe could not run", async () => {
    mocks.getMigrationDrift.mockResolvedValue({
      pending: [],
      state: "indeterminate",
      unknownApplied: [],
    });

    const markup = renderToStaticMarkup(await AdminSchemaPage());

    expect(markup).toMatch(/could not|unavailable|unknown/i);
    // Must not claim the schema is fine when it simply does not know.
    expect(markup).not.toMatch(/up to date/i);
  });

  it("is unreachable without the capability", async () => {
    const { notFound } = await import("next/navigation");
    mocks.requireCapabilityOrNotFound.mockImplementation(async () => {
      notFound();
    });

    await expect(AdminSchemaPage()).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
    // The gate must short-circuit before any drift detail is computed.
    expect(mocks.getMigrationDrift).not.toHaveBeenCalled();
  });

  it("checks the capability before reading drift state", async () => {
    await AdminSchemaPage();

    expect(mocks.requireCapabilityOrNotFound).toHaveBeenCalledWith(
      "settings:manage",
    );
    expect(
      mocks.requireCapabilityOrNotFound.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.getMigrationDrift.mock.invocationCallOrder[0]);
  });
});
