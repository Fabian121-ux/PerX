import { describe, expect, it, vi, beforeEach } from "vitest";

import { getPerXDataProvider } from "@/lib/data/provider";
import { assertDatabaseConfiguration } from "@/lib/env";
import { mockProvider } from "@/lib/data/providers/mock-provider";
import { setCachedDataModeForTest } from "@/lib/env";

vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return {
    ...actual,
    assertDatabaseConfiguration: vi.fn(),
  };
});

describe("Preview Isolation & Provider Context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCachedDataModeForTest(undefined);
  });

  it("should return the static mockProvider when context mode is 'preview'", async () => {
    const provider = await getPerXDataProvider({ mode: "preview" });
    expect(provider).toBe(mockProvider);
  });

  it("should not invoke assertDatabaseConfiguration when in preview mode", async () => {
    await getPerXDataProvider({ mode: "preview" });
    expect(assertDatabaseConfiguration).not.toHaveBeenCalled();
  });

  it("should return mockProvider when environment is mock", async () => {
    setCachedDataModeForTest("mock");
    const provider = await getPerXDataProvider();
    expect(provider).toBe(mockProvider);
  });

  it("database mode still rejects missing database configuration when a database operation is requested", () => {
    vi.mocked(assertDatabaseConfiguration).mockImplementation(() => {
      throw new Error("DATABASE_URL is required in database mode.");
    });
    
    expect(() => assertDatabaseConfiguration()).toThrowError("DATABASE_URL is required in database mode.");
  });
});
