import { describe, expect, it, beforeEach } from "vitest";
import { getResolvedDataMode, hasDatabaseUrl, setCachedDataModeForTest } from "../../src/lib/env";
import { getPrisma } from "../../src/lib/db/prisma";

describe("Data Mode Resolution", () => {
  beforeEach(() => {
    setCachedDataModeForTest(undefined);
  });

  it("resolves to mock when PERX_DATA_MODE is mock in development", () => {
    // @ts-expect-error - overriding NODE_ENV for test
    process.env.NODE_ENV = "development";
    process.env.PERX_DATA_MODE = "mock";
    expect(getResolvedDataMode()).toBe("mock");
  });

  it("rejects mock mode in production", () => {
    // @ts-expect-error - overriding NODE_ENV for test
    process.env.NODE_ENV = "production";
    process.env.PERX_DATA_MODE = "mock";
    expect(() => getResolvedDataMode()).toThrow("PERX_DATA_MODE=mock is strictly prohibited in production.");
    // @ts-expect-error - overriding NODE_ENV for test
    process.env.NODE_ENV = "test"; // Restore
  });

  it("throws error when DATABASE_URL is missing in database mode", () => {
    // @ts-expect-error - overriding NODE_ENV for test
    process.env.NODE_ENV = "development";
    process.env.PERX_DATA_MODE = "database";
    const oldUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    expect(() => getResolvedDataMode()).toThrow("DATABASE_URL is required in database mode.");
    process.env.DATABASE_URL = oldUrl;
  });

  it("throws error when getPrisma is called in mock mode", () => {
    // @ts-expect-error - overriding NODE_ENV for test
    process.env.NODE_ENV = "development";
    process.env.PERX_DATA_MODE = "mock";
    const oldUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    expect(() => getPrisma()).toThrow("Prisma cannot be initialized or used when PERX_DATA_MODE is 'mock'.");
    process.env.DATABASE_URL = oldUrl;
  });

  it("hasDatabaseUrl returns boolean correctly", () => {
    const oldUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/db";
    expect(hasDatabaseUrl()).toBe(true);
    delete process.env.DATABASE_URL;
    expect(hasDatabaseUrl()).toBe(false);
    process.env.DATABASE_URL = oldUrl;
  });
});
