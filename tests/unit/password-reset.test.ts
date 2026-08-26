import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  count: vi.fn(),
  create: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    passwordResetToken: {
      count: prismaMocks.count,
      create: prismaMocks.create,
      findFirst: prismaMocks.findFirst,
      findUnique: prismaMocks.findUnique,
      updateMany: prismaMocks.updateMany,
    },
  }),
}));

import {
  consumePasswordResetToken,
  hashResetToken,
  hasExceededResetRequestLimit,
  isPasswordResetTokenRedeemable,
  issuePasswordResetToken,
  MAX_ACTIVE_RESET_TOKENS_PER_USER,
} from "@/lib/auth/password-reset";

describe("password reset tokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.updateMany.mockResolvedValue({ count: 1 });
    prismaMocks.create.mockResolvedValue({});
  });

  it("stores only a hash of the emitted token", async () => {
    const grant = await issuePasswordResetToken({ userId: "user-1" });

    const created = prismaMocks.create.mock.calls[0]![0].data;
    expect(created.tokenHash).toBe(hashResetToken(grant.token));
    // The raw token must never be persisted in any field.
    expect(JSON.stringify(created)).not.toContain(grant.token);
    expect(grant.token.length).toBeGreaterThanOrEqual(32);
  });

  it("invalidates prior outstanding grants when a new one is issued", async () => {
    await issuePasswordResetToken({ userId: "user-1" });

    expect(prismaMocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { consumedAt: null, userId: "user-1" },
      }),
    );
  });

  it("expires grants within the configured window", async () => {
    const before = Date.now();
    const grant = await issuePasswordResetToken({ userId: "user-1" });

    expect(grant.expiresAt.getTime()).toBeGreaterThan(before);
    expect(grant.expiresAt.getTime()).toBeLessThanOrEqual(
      before + 31 * 60_000,
    );
  });

  it("consumes a valid token exactly once", async () => {
    prismaMocks.findUnique.mockResolvedValue({ id: "t1", userId: "user-1" });
    prismaMocks.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await consumePasswordResetToken("raw-token");

    expect(result).toEqual({ ok: true, userId: "user-1" });
    // The claim is conditional, so a concurrent redemption cannot also win.
    expect(prismaMocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          consumedAt: null,
          id: "t1",
        }),
      }),
    );
  });

  it("rejects an already-consumed or expired token", async () => {
    prismaMocks.findUnique.mockResolvedValue({ id: "t1", userId: "user-1" });
    prismaMocks.updateMany.mockResolvedValueOnce({ count: 0 });

    expect(await consumePasswordResetToken("raw-token")).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("rejects an unknown token", async () => {
    prismaMocks.findUnique.mockResolvedValue(null);

    expect(await consumePasswordResetToken("wrong-token")).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(prismaMocks.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an empty token without querying", async () => {
    expect(await consumePasswordResetToken("")).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(prismaMocks.findUnique).not.toHaveBeenCalled();
  });

  it("looks tokens up by hash, never by raw value", async () => {
    prismaMocks.findUnique.mockResolvedValue(null);
    await consumePasswordResetToken("raw-token");

    expect(prismaMocks.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tokenHash: hashResetToken("raw-token") },
      }),
    );
  });

  it("reports redeemability without consuming the grant", async () => {
    prismaMocks.findFirst.mockResolvedValue({ id: "t1" });

    expect(await isPasswordResetTokenRedeemable("raw-token")).toBe(true);
    expect(prismaMocks.updateMany).not.toHaveBeenCalled();
  });

  it("caps repeated reset requests for one account", async () => {
    prismaMocks.count.mockResolvedValue(MAX_ACTIVE_RESET_TOKENS_PER_USER);
    expect(await hasExceededResetRequestLimit("user-1")).toBe(true);

    prismaMocks.count.mockResolvedValue(0);
    expect(await hasExceededResetRequestLimit("user-1")).toBe(false);
  });
});
