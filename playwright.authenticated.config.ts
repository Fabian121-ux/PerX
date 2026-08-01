import { defineConfig, devices } from "@playwright/test";

const defaultBaseURL = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  retries: 0,
  use: {
    baseURL: defaultBaseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command:
      "npx cross-env PERX_DATA_MODE=database PERX_SIGNUP_MODE=open_beta PERX_BETA_MAX_USERS=100 npm run dev -- -p 3100 -H 127.0.0.1",
    reuseExistingServer: true,
    url: defaultBaseURL,
    timeout: 120 * 1000,
  },
});