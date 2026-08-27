import { beforeEach, describe, expect, it, vi } from "vitest";

const requireCapabilityOrNotFound = vi.fn();
const findUnique = vi.fn();
const deleteMany = vi.fn();
const auditCreate = vi.fn();
const transaction = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  requireCapabilityOrNotFound: (capability: string) =>
    requireCapabilityOrNotFound(capability),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    $transaction: transaction,
    user: { findUnique },
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("admin session revocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCapabilityOrNotFound.mockResolvedValue({
      id: "admin-1",
      roles: ["MASTER_ADMIN"],
    });
    findUnique.mockResolvedValue({ id: "user-1" });
    deleteMany.mockResolvedValue({ count: 3 });
    auditCreate.mockResolvedValue({});
    transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({ auditLog: { create: auditCreate }, session: { deleteMany } }),
    );
  });

  async function run(userId = "user-1") {
    const { revokeUserSessionsAction } =
      await import("@/features/admin/actions");
    const formData = new FormData();
    if (userId) formData.set("userId", userId);
    return revokeUserSessionsAction(formData);
  }

  it("is gated on the dedicated session-revocation capability", async () => {
    await run();

    // Not users:manage - that issues a link the user chooses to act on, while
    // this ejects them from every device without consent.
    expect(requireCapabilityOrNotFound).toHaveBeenCalledWith(
      "users:sessions:revoke",
    );
  });

  it("checks authorization before reading the target account", async () => {
    requireCapabilityOrNotFound.mockRejectedValueOnce(new Error("not found"));

    await expect(run()).rejects.toThrow("not found");
    expect(findUnique).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("deletes only the target user's sessions", async () => {
    await run();

    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });

  it("writes the audit entry inside the same transaction as the deletion", async () => {
    await run();

    // writeAuditLog swallows its own failures, which is unacceptable for an
    // action that silently signs someone out everywhere.
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "admin.user_sessions_revoked",
        actorId: "admin-1",
        entityId: "user-1",
        entityType: "user",
        metadata: { revokedSessions: 3 },
      }),
    });
  });

  it("reports how many sessions were revoked", async () => {
    await expect(run()).resolves.toEqual({ revoked: 3 });
  });

  it("does not change any account status field", async () => {
    await run();

    // Revocation is not enforcement: the account stays active and the user may
    // sign straight back in.
    const updated = JSON.stringify(auditCreate.mock.calls);
    expect(updated).not.toContain("suspendedAt");
    expect(updated).not.toContain("isActive");
  });

  it("refuses an unknown account without deleting anything", async () => {
    findUnique.mockResolvedValueOnce(null);

    await expect(run("ghost")).rejects.toThrow("unavailable");
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("requires a target user", async () => {
    await expect(run("")).rejects.toThrow("Select a user.");
    expect(deleteMany).not.toHaveBeenCalled();
  });
});
