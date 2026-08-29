import { defineConfig, devices } from "@playwright/test";

import { enforceTestDatabaseIsolation } from "./tests/e2e/utils/db-guard";
import { loadTestEnv } from "./tests/utils/load-test-env";

/**
 * Runs the EXISTING committed e2e specs against an already-running production
 * server, so the previously observed dev-mode durations can be compared
 * like-for-like without editing the committed authenticated config.
 *
 * The specs default `BASE` to port 3100, so `PLAYWRIGHT_BASE_URL` is what
 * actually redirects them at the production server on 3200.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3200";

loadTestEnv();
enforceTestDatabaseIsolation();

const { hostname } = new URL(baseURL);
if (!["127.0.0.1", "localhost", "[::1]"].includes(hostname)) {
  throw new Error("Safety Guard: performance runs require a loopback host.");
}

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 300_000,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL, trace: "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
