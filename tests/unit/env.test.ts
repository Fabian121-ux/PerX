import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  assertDatabaseConfiguration,
  getResolvedDataMode,
  getServerEnv,
  hasDatabaseUrl,
  setCachedDataModeForTest,
} from "../../src/lib/env";
import { getPrisma } from "../../src/lib/db/prisma";

const originalEnv = { ...process.env };

function resetEnv() {
  process.env = { ...originalEnv };
  delete process.env.DATABASE_URL;
  delete process.env.DIRECT_URL;
  delete process.env.ERROR_MONITORING_DSN;
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.PERX_DATA_MODE;
  delete process.env.PERX_DEPLOY_ENV;
  delete process.env.PERX_ENABLE_PREVIEW;
  delete process.env.VERCEL_ENV;
  setNodeEnv("test");
}

function setNodeEnv(value: "development" | "production" | "test") {
  Reflect.set(process.env, "NODE_ENV", value);
}

function setDatabaseEnvironment() {
  process.env.PERX_DATA_MODE = "database";
  process.env.DATABASE_URL =
    "postgresql://runtime:pass@pooler.example.com:5432/postgres";
  process.env.DIRECT_URL =
    "postgresql://direct:pass@db.example.supabase.co:5432/postgres";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";
}

function setStrictEnvironment() {
  setDatabaseEnvironment();
  process.env.NEXT_PUBLIC_APP_URL = "https://staging.perx.example";
  process.env.SESSION_COOKIE_NAME = "perx_session";
  process.env.AUTH_SESSION_DAYS = "30";
  process.env.UPLOAD_MAX_BYTES = "5242880";
  process.env.LOG_LEVEL = "info";
  process.env.ERROR_MONITORING_DSN = "https://key@example.ingest.example/1";
  process.env.PERX_ENABLE_PREVIEW = "false";
}

describe("Data Mode Resolution", () => {
  beforeEach(() => {
    resetEnv();
    setCachedDataModeForTest(undefined);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    setCachedDataModeForTest(undefined);
  });

  it("resolves to mock when PERX_DATA_MODE is mock in local development", () => {
    setNodeEnv("development");
    process.env.PERX_DATA_MODE = "mock";
    expect(getResolvedDataMode()).toBe("mock");
  });

  it("rejects mock mode in production for the intended reason", () => {
    setNodeEnv("production");
    process.env.PERX_DATA_MODE = "mock";

    expect(() => getResolvedDataMode()).toThrow(
      "PERX_DATA_MODE=mock is strictly prohibited in production.",
    );
  });

  it("requires complete database configuration in database mode", () => {
    setNodeEnv("development");
    process.env.PERX_DATA_MODE = "database";
    process.env.DATABASE_URL =
      "postgresql://runtime:pass@pooler.example.com:5432/postgres";

    expect(() => assertDatabaseConfiguration()).toThrow(
      "Missing required environment variable(s): DIRECT_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  });

  it("accepts complete local database configuration", () => {
    setNodeEnv("development");
    setDatabaseEnvironment();

    expect(() => assertDatabaseConfiguration()).not.toThrow();
    expect(getResolvedDataMode()).toBe("database");
  });

  it("rejects localhost app URL in Vercel preview or staging", () => {
    setStrictEnvironment();
    process.env.VERCEL_ENV = "preview";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

    expect(() => getServerEnv()).toThrow(
      "NEXT_PUBLIC_APP_URL must not point to localhost in staging or production.",
    );
  });

  it("allows production without an error monitoring DSN", () => {
    setDatabaseEnvironment();
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_APP_URL = "https://perx.example";

    expect(getServerEnv().ERROR_MONITORING_DSN).toBeUndefined();
  });

  it("validates a configured error monitoring DSN", () => {
    setDatabaseEnvironment();
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_APP_URL = "https://perx.example";
    process.env.ERROR_MONITORING_DSN = "not-a-url";

    expect(() => getServerEnv()).toThrow();
  });

  it("still requires PERX_DATA_MODE for strict deployments", () => {
    setDatabaseEnvironment();
    process.env.VERCEL_ENV = "production";
    process.env.NEXT_PUBLIC_APP_URL = "https://perx.example";
    delete process.env.PERX_DATA_MODE;

    expect(() => getServerEnv()).toThrow(
      "Missing required environment variable(s): PERX_DATA_MODE.",
    );
  });

  it("defaults preview routes to disabled", () => {
    setNodeEnv("development");
    const env = getServerEnv();
    expect(env.PERX_ENABLE_PREVIEW).toBe(false);
  });

  it("throws error when getPrisma is called in mock mode", () => {
    setNodeEnv("development");
    process.env.PERX_DATA_MODE = "mock";
    expect(() => getPrisma()).toThrow(
      "Prisma cannot be initialized or used when PERX_DATA_MODE is 'mock'.",
    );
  });

  it("hasDatabaseUrl returns boolean correctly", () => {
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/db";
    expect(hasDatabaseUrl()).toBe(true);
    delete process.env.DATABASE_URL;
    expect(hasDatabaseUrl()).toBe(false);
  });
});
