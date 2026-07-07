import { describe, expect, it } from "vitest";
import { getPerXDataProvider } from "../../src/lib/data/provider";
import { mockProvider } from "../../src/lib/data/providers/mock-provider";

describe("Data Provider Resolution", () => {
  it("resolves to mock provider when mode is mock", async () => {
    process.env.PERX_DATA_MODE = "mock";
    const provider = await getPerXDataProvider();
    // Since mock provider methods resolve statically, we can just test if the app provider returns mock data
    const metrics = await provider.app.getDashboardMetrics("test-user");
    expect(metrics).toBeDefined();
    expect(metrics.deals).toBeDefined();
  });
});
