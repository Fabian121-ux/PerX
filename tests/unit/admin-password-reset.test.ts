import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deliver: vi.fn(),
  issuePasswordResetToken: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  requireCapabilityOrNotFound: vi.fn(),
  userFindUnique: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  requireCapabilityOrNotFound: mocks.requireCapabilityOrNotFound,
}));
vi.mock("@/lib/logging/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/auth/password-reset", () => ({
  issuePasswordResetToken: mocks.issuePasswordResetToken,
}));
vi.mock("@/lib/auth/password-reset-delivery", () => ({
  buildPasswordResetUrl: (token: string) => `https://app.test/r?token=${token}`,
  passwordResetDelivery: { deliverPasswordResetLink: mocks.deliver },
}));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({ user: { findUnique: mocks.userFindUnique } }),
}));

import { initiateUserPasswordResetAction } from "@/features/admin/actions";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.append(key, value);
  return data;
}

describe("admin-initiated password reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCapabilityOrNotFound.mockResolvedValue({ id: "admin-1" });
    mocks.userFindUnique.mockResolvedValue({
      email: "target@perx.test",
      id: "user-9",
      isActive: true,
    });
    mocks.issuePasswordResetToken.mockResolvedValue({
      expiresAt: new Date("2026-01-01T00:30:00.000Z"),
      token: "raw-token",
    });
  });

  it("is gated on the users:manage capability", async () => {
    await initiateUserPasswordResetAction(form({ userId: "user-9" }));

    expect(mocks.requireCapabilityOrNotFound).toHaveBeenCalledWith(
      "users:manage",
    );
  });

  it("issues a reset link attributed to the acting admin", async () => {
    await initiateUserPasswordResetAction(form({ userId: "user-9" }));

    expect(mocks.issuePasswordResetToken).toHaveBeenCalledWith({
      requestedByAdminId: "admin-1",
      userId: "user-9",
    });
    expect(mocks.deliver).toHaveBeenCalledTimes(1);
  });

  it("denies a caller without the capability", async () => {
    mocks.requireCapabilityOrNotFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });

    await expect(
      initiateUserPasswordResetAction(form({ userId: "user-9" })),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    // Authorization runs before any account lookup or token issuance.
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.issuePasswordResetToken).not.toHaveBeenCalled();
  });

  it("refuses a missing account without revealing which condition failed", async () => {
    mocks.userFindUnique.mockResolvedValue(null);

    await expect(
      initiateUserPasswordResetAction(form({ userId: "ghost" })),
    ).rejects.toThrow(/cannot be reset/i);
    expect(mocks.issuePasswordResetToken).not.toHaveBeenCalled();
  });

  it("refuses an inactive account with the same message", async () => {
    mocks.userFindUnique.mockResolvedValue({
      email: "target@perx.test",
      id: "user-9",
      isActive: false,
    });

    await expect(
      initiateUserPasswordResetAction(form({ userId: "user-9" })),
    ).rejects.toThrow(/cannot be reset/i);
  });

  it("never selects or exposes the password hash", async () => {
    await initiateUserPasswordResetAction(form({ userId: "user-9" }));

    const selection = mocks.userFindUnique.mock.calls[0]![0].select;
    expect(selection).not.toHaveProperty("passwordHash");
    expect(JSON.stringify(mocks.writeAuditLog.mock.calls)).not.toContain(
      "passwordHash",
    );
  });

  it("audits the actor and target without recording the token", async () => {
    await initiateUserPasswordResetAction(form({ userId: "user-9" }));

    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin.user_password_reset_initiated",
        actorId: "admin-1",
        entityId: "user-9",
        entityType: "user",
      }),
    );
    expect(JSON.stringify(mocks.writeAuditLog.mock.calls)).not.toContain(
      "raw-token",
    );
  });
});
