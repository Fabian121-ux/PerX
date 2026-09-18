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

/**
 * P0-7 C: a non-self-assignable role must not produce a misleading error.
 *
 * Ticking only "Client" filtered to an empty set and redirected to
 * `?error=choose-role` - an error telling the user to choose a role when they
 * had chosen one. The UI no longer offers those options, so this path is now
 * only reachable by a hand-crafted POST; it must still not lie about the cause.
 */
describe("non-self-assignable submissions", () => {
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

  it("does not claim the user failed to choose a role when they chose one", async () => {
    const formData = new FormData();
    formData.append("roles", "CLIENT");

    await updateRolesAction(formData).catch(() => {});

    const target = String(mocks.redirect.mock.calls[0]?.[0] ?? "");
    expect(target).not.toContain("error=choose-role");
    // The submission granted nothing, so nothing may be written either.
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("still reports a genuinely empty submission as choose-role", async () => {
    await updateRolesAction(new FormData()).catch(() => {});

    expect(String(mocks.redirect.mock.calls[0]?.[0] ?? "")).toContain(
      "error=choose-role",
    );
  });
});
