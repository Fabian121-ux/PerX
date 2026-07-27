import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getPerXDataProvider } from "../../src/lib/data/provider";
import { setCachedDataModeForTest } from "../../src/lib/env";

const originalEnv = { ...process.env };

function resetEnv() {
  process.env = { ...originalEnv };
  delete process.env.PERX_DATA_MODE;
  delete process.env.VERCEL_ENV;
  delete process.env.PERX_DEPLOY_ENV;
  setCachedDataModeForTest(undefined);
  Reflect.set(process.env, "NODE_ENV", "test");
}

describe("Data Provider Resolution", () => {
  beforeEach(resetEnv);
  afterEach(resetEnv);

  it("resolves to mock provider when mode is mock", async () => {
    process.env.PERX_DATA_MODE = "mock";
    const provider = await getPerXDataProvider();
    // Since mock provider methods resolve statically, we can just test if the app provider returns mock data
    const metrics = await provider.app.getDashboardMetrics("test-user");
    expect(metrics).toBeDefined();
    expect(metrics.deals).toBeDefined();
  });

  it("rejects mock provider resolution in production", async () => {
    Reflect.set(process.env, "NODE_ENV", "production");
    process.env.PERX_DATA_MODE = "mock";

    await expect(getPerXDataProvider({ mode: "mock" })).rejects.toThrow(
      "Mock data providers are prohibited in production.",
    );
  });
});
