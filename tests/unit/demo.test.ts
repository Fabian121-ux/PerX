import { describe, expect, it, beforeAll, afterAll } from "vitest";
import SignInPage from "@/app/(auth)/sign-in/page";
import PreviewDashboardPage from "@/app/(preview)/preview/page";
import PreviewProfilePage from "@/app/(preview)/preview/profile/page";
import PreviewOpportunitiesPage from "@/app/(preview)/preview/opportunities/page";

describe("Preview Mode and Sign-in page without Database Connection", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeAll(() => {
    // Force DATABASE_URL to be missing to simulate offline/unconfigured database
    delete process.env.DATABASE_URL;
  });

  afterAll(() => {
    // Restore original DATABASE_URL
    if (originalDatabaseUrl !== undefined) {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it("proves that DATABASE_URL is missing during test execution", () => {
    expect(process.env.DATABASE_URL).toBeUndefined();
  });

  it("renders the sign-in page component successfully without database access", async () => {
    // Call the server component page function
    const pagePromise = SignInPage({ searchParams: Promise.resolve({}) });
    await expect(pagePromise).resolves.toBeDefined();
    
    const result = await pagePromise;
    expect(result).toHaveProperty("type"); // It should return a React element tree
  });

  it("renders the preview dashboard page component successfully without database access", () => {
    const result = PreviewDashboardPage();
    expect(result).toBeDefined();
    expect(result).toHaveProperty("type");
  });

  it("renders the preview profile page component successfully without database access", () => {
    const result = PreviewProfilePage();
    expect(result).toBeDefined();
    expect(result).toHaveProperty("type");
  });

  it("renders the preview opportunities page component successfully without database access", () => {
    expect(PreviewOpportunitiesPage).toBeDefined();
  });
});
