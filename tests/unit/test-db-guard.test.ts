import { afterEach, describe, expect, it } from "vitest";

import {
  enforceTestDatabaseIsolation,
  hasIsolatedTestDatabase,
} from "../e2e/utils/db-guard";

const originalTestDatabaseUrl = process.env.TEST_DATABASE_URL;
const originalTestDirectUrl = process.env.TEST_DIRECT_URL;

describe("test database isolation guard", () => {
  afterEach(() => {
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
    expect(() => enforceTestDatabaseIsolation()).toThrow(/TEST_DIRECT_URL.*loopback/i);
  });
});
