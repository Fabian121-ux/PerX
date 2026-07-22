import { defineConfig, devices } from "@playwright/test";

const defaultBaseURL = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  retries: process.env.CI ? 2 : 1,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? defaultBaseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command:
          "npx cross-env PERX_DATA_MODE=database PERX_SIGNUP_MODE=open_beta PERX_BETA_MAX_USERS=10 npm run dev -- -p 3100 -H 127.0.0.1",
        reuseExistingServer: false,
        url: defaultBaseURL,
        timeout: 120 * 1000,
      },
});
