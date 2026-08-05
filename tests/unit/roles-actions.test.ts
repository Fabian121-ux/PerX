import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  deleteMany: vi.fn(),
  redirect: vi.fn(),
  roleUpsert: vi.fn(),
  transaction: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect.mockImplementation((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("@/lib/auth/session", () => ({
  requireUser: vi.fn().mockResolvedValue({ id: "user-1", roles: ["MEMBER"] }),
}));
vi.mock("@/lib/env", () => ({
  getResolvedDataMode: vi.fn().mockReturnValue("database"),
  hasDatabaseUrl: vi.fn().mockReturnValue(true),
}));
vi.mock("@/lib/logging/audit", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: vi.fn(() => ({
    $transaction: mocks.transaction,
    role: { upsert: mocks.roleUpsert },
    userRole: { create: mocks.create, deleteMany: mocks.deleteMany },
  })),
}));

import { updateRolesAction } from "@/features/roles/actions";

describe("public role self-assignment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.roleUpsert.mockResolvedValue({ id: "role-freelancer" });
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        role: { upsert: mocks.roleUpsert },
        userRole: { create: mocks.create, deleteMany: mocks.deleteMany },
      }),
    );
  });

  it("rejects MASTER_ADMIN from a user-controlled role form", async () => {
    const formData = new FormData();
    formData.append("roles", "FREELANCER");
    formData.append("roles", "MASTER_ADMIN");

    await expect(updateRolesAction(formData)).rejects.toThrow(
      "REDIRECT:/app?success=roles-updated",
    );
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledWith({
      data: { roleId: "role-freelancer", userId: "user-1" },
    });
  });
});
