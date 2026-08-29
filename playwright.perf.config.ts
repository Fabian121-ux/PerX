import { defineConfig, devices } from "@playwright/test";

import { enforceTestDatabaseIsolation } from "./tests/e2e/utils/db-guard";
import { loadTestEnv } from "./tests/utils/load-test-env";

/**
 * Measurement-only config for the production-mode performance pass.
 *
 * Unlike `playwright.authenticated.config.ts`, this attaches to an ALREADY
 * RUNNING production server (`next start`) rather than booting `next dev`.
 * That is the whole point: the numbers under investigation were suspected to
 * be dev-compilation artifacts, so the harness must not reintroduce dev mode.
 *
 * The database guard still runs and still fails closed on any non-loopback or
 * Production-fingerprinted URL. This config never starts a server, so it
 * cannot point the app at Production by accident.
 */
const baseURL = process.env.PERF_BASE_URL ?? "http://127.0.0.1:3200";

loadTestEnv();
enforceTestDatabaseIsolation();

const { hostname } = new URL(baseURL);
if (!["127.0.0.1", "localhost", "[::1]"].includes(hostname)) {
  throw new Error(`Safety Guard: performance runs require a loopback host.`);
}

export default defineConfig({
  testDir: "./tests/perf",
  // Measurement runs are strictly serial: a second worker would reintroduce
  // exactly the contention this pass exists to rule out.
  workers: 1,
  fullyParallel: false,
  timeout: 180_000,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL, trace: "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
