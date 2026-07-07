import { describe, expect, it } from "vitest";
import { getResolvedDataMode, hasDatabaseUrl } from "../../src/lib/env";
import { getPrisma } from "../../src/lib/db/prisma";

describe("Data Mode Resolution", () => {
  it("resolves to mock when PERX_DATA_MODE is mock", () => {
    process.env.PERX_DATA_MODE = "mock";
    expect(getResolvedDataMode()).toBe("mock");
  });

  it("throws error when getPrisma is called in mock mode", () => {
    process.env.PERX_DATA_MODE = "mock";
    expect(() => getPrisma()).toThrow("Prisma cannot be initialized or used when PERX_DATA_MODE is 'mock'.");
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
