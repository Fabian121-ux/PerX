import { describe, it, expect, vi } from "vitest";
import { getRegistrationStatus } from "../../src/lib/registration/status";

const mockPrismaClient = {
  user: {
    count: vi.fn(),
  },
  $executeRawUnsafe: vi.fn(),
};

vi.mock("../../src/lib/db/prisma", () => ({
  getPrisma: () => mockPrismaClient,
}));

vi.mock("../../src/lib/env", () => ({
  getSignupConfig: () => ({ mode: "open", maximumUsers: 100 }),
  getServerEnv: () => ({}),
}));

describe("Admin Access & Registration Logic", () => {
  it("INTERNAL_ADMIN accounts are excluded from PERX_BETA_MAX_USERS", async () => {
    // The query in getRegistrationStatus specifically targets PUBLIC_BETA_USER
    // We can verify this by checking the args passed to count
    mockPrismaClient.user.count.mockResolvedValue(50);
    
    await getRegistrationStatus();

    expect(mockPrismaClient.user.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          accountClassification: "PUBLIC_BETA_USER",
          roles: expect.objectContaining({
            none: expect.objectContaining({
              role: { name: "ADMIN" }
            })
          })
        })
      })
    );
  });
});
