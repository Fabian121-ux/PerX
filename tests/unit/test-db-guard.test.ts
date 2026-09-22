import { afterEach, describe, expect, it, vi } from "vitest";

import {
  enforceTestDatabaseIsolation,
  getIsolatedTestDatabaseUrl,
  hasIsolatedTestDatabase,
} from "../e2e/utils/db-guard";

const originalTestDatabaseUrl = process.env.TEST_DATABASE_URL;
const originalTestDirectUrl = process.env.TEST_DIRECT_URL;

describe("test database isolation guard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    if (originalTestDatabaseUrl === undefined) {
      delete process.env.TEST_DATABASE_URL;
    } else {
      process.env.TEST_DATABASE_URL = originalTestDatabaseUrl;
    }
    if (originalTestDirectUrl === undefined) {
      delete process.env.TEST_DIRECT_URL;
    } else {
      process.env.TEST_DIRECT_URL = originalTestDirectUrl;
    }
  });

  it("never falls back to the application DATABASE_URL when test configuration is absent", () => {
    vi.stubEnv("TEST_DATABASE_URL", undefined);
    vi.stubEnv("DATABASE_URL", "postgresql://127.0.0.1/perx_test");
    expect(hasIsolatedTestDatabase()).toBe(false);
    expect(getIsolatedTestDatabaseUrl()).toBeNull();
    expect(() => enforceTestDatabaseIsolation()).toThrow(/not provided/i);
  });

  it.each([
    "perx",
    "perx_dev",
    "postgres",
    "perx_testing",
    "perx_testproduction",
  ])("rejects development or ambiguous database %s", (name) => {
    process.env.TEST_DATABASE_URL = `postgresql://127.0.0.1/${name}`;
    expect(() => hasIsolatedTestDatabase()).toThrow(/perx_test/i);
  });

  it("rejects production fingerprints even on an otherwise valid loopback target", () => {
    process.env.TEST_DATABASE_URL =
      "postgresql://127.0.0.1/perx_test_qtmvausduxiqcguckfql";
    expect(() => enforceTestDatabaseIsolation()).toThrow(
      /Production fingerprint/i,
    );
  });

  it("accepts an explicitly named loopback test database", () => {
    process.env.TEST_DATABASE_URL =
      "postgresql://postgres:password@127.0.0.1:55434/perx_test?schema=public";
    expect(hasIsolatedTestDatabase()).toBe(true);
  });

  it("rejects non-loopback hosts and non-test database names", () => {
    process.env.TEST_DATABASE_URL =
      "postgresql://postgres:password@db.example.test:5432/perx_test";
    expect(() => hasIsolatedTestDatabase()).toThrow(/loopback/i);

    process.env.TEST_DATABASE_URL =
      "postgresql://postgres:password@127.0.0.1:5432/postgres";
    expect(() => hasIsolatedTestDatabase()).toThrow(/perx_test/i);
  });

  it("rejects connection parameters that can override the parsed target", () => {
    process.env.TEST_DATABASE_URL =
      "postgresql://postgres:password@127.0.0.1:5432/perx_test?host=db.example.test";
    expect(() => hasIsolatedTestDatabase()).toThrow(/parameter host/i);
  });

  it("also validates the direct migration connection", () => {
    process.env.TEST_DATABASE_URL =
      "postgresql://postgres:password@127.0.0.1:5432/perx_test";
    process.env.TEST_DIRECT_URL =
      "postgresql://postgres:password@db.example.test:5432/perx_test";
    expect(() => enforceTestDatabaseIsolation()).toThrow(
      /TEST_DIRECT_URL.*loopback/i,
    );
  });
});
