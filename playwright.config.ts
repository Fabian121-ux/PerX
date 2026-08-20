import { defineConfig, devices } from "@playwright/test";

import { enforceTestDatabaseIsolation } from "./tests/e2e/utils/db-guard";
import { loadTestEnv } from "./tests/utils/load-test-env";

const defaultBaseURL = "http://127.0.0.1:3100";

loadTestEnv();
enforceTestDatabaseIsolation();
if (
  process.env.PLAYWRIGHT_BASE_URL &&
  process.env.PLAYWRIGHT_BASE_URL !== defaultBaseURL
) {
  throw new Error(`Safety Guard: Playwright requires ${defaultBaseURL}.`);
}

const testDatabaseUrl = process.env.TEST_DATABASE_URL!;
process.env.DATABASE_URL = testDatabaseUrl;
process.env.DIRECT_URL = process.env.TEST_DIRECT_URL ?? testDatabaseUrl;
const inheritedEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  ),
);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  retries: process.env.CI ? 2 : 1,
  use: {
    baseURL: defaultBaseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command:
      "npx cross-env PERX_DATA_MODE=database PERX_SIGNUP_MODE=open_beta PERX_BETA_MAX_USERS=10 npm run dev -- -p 3100 -H 127.0.0.1",
    env: {
      ...inheritedEnvironment,
      DATABASE_URL: testDatabaseUrl,
      DIRECT_URL: process.env.TEST_DIRECT_URL ?? testDatabaseUrl,
      PERX_DATA_MODE: "database",
    },
    reuseExistingServer: false,
    stderr: "pipe",
    stdout: "pipe",
    url: defaultBaseURL,
    timeout: 120 * 1000,
  },
});
