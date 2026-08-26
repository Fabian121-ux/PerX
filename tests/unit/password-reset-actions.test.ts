import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consumePasswordResetToken: vi.fn(),
  deliver: vi.fn(),
  hasExceededResetRequestLimit: vi.fn(),
  hashPassword: vi.fn(),
  issuePasswordResetToken: vi.fn(),
  redirect: vi.fn((path: string) => {
    const error = new Error(`NEXT_REDIRECT:${path}`);
    (error as { digest?: string }).digest = `NEXT_REDIRECT;replace;${path}`;
    throw error;
  }),
  sessionDeleteMany: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/logging/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/logging/runtime", () => ({
  logServerDataError: vi.fn(),
  getRequestCorrelationId: () => "test",
}));
vi.mock("@/lib/auth/password", () => ({
  hashPassword: mocks.hashPassword,
  verifyPassword: vi.fn(),
}));
vi.mock("@/lib/auth/password-reset", () => ({
  consumePasswordResetToken: mocks.consumePasswordResetToken,
  hasExceededResetRequestLimit: mocks.hasExceededResetRequestLimit,
  issuePasswordResetToken: mocks.issuePasswordResetToken,
}));
vi.mock("@/lib/auth/password-reset-delivery", () => ({
  buildPasswordResetUrl: (token: string) => `https://app.test/r?token=${token}`,
  passwordResetDelivery: { deliverPasswordResetLink: mocks.deliver },
}));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({
        session: { deleteMany: mocks.sessionDeleteMany },
        user: { update: mocks.userUpdate },
      }),
    user: { findUnique: mocks.userFindUnique },
  }),
}));
vi.mock("@/lib/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/env")>()),
  hasDatabaseUrl: () => true,
  getResolvedDataMode: () => "database",
}));

import {
  passwordRecoveryAction,
  resetPasswordAction,
} from "@/features/auth/actions";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.append(key, value);
  return data;
}

async function captureRedirect(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    return String((error as Error).message);
  }
  return null;
}

describe("password recovery request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasExceededResetRequestLimit.mockResolvedValue(false);
    mocks.issuePasswordResetToken.mockResolvedValue({
      expiresAt: new Date("2026-01-01T00:30:00.000Z"),
      token: "raw-token",
    });
  });

  it("issues a reset link for an existing active account", async () => {
    mocks.userFindUnique.mockResolvedValue({
      email: "user@perx.test",
      id: "user-1",
      isActive: true,
    });

    const redirected = await captureRedirect(() =>
      passwordRecoveryAction(form({ email: "user@perx.test" })),
    );

    expect(mocks.issuePasswordResetToken).toHaveBeenCalledWith({
      userId: "user-1",
    });
    expect(mocks.deliver).toHaveBeenCalledTimes(1);
    expect(redirected).toContain("/password-recovery?status=requested");
  });

  it("returns the identical neutral response for an unknown email", async () => {
    mocks.userFindUnique.mockResolvedValue(null);

    const redirected = await captureRedirect(() =>
      passwordRecoveryAction(form({ email: "nobody@perx.test" })),
    );

    // Same destination as the existing-account case: no enumeration signal.
    expect(redirected).toContain("/password-recovery?status=requested");
    expect(mocks.issuePasswordResetToken).not.toHaveBeenCalled();
    expect(mocks.deliver).not.toHaveBeenCalled();
  });

  it("does not issue a link for a deactivated account", async () => {
    mocks.userFindUnique.mockResolvedValue({
      email: "user@perx.test",
      id: "user-1",
      isActive: false,
    });

    const redirected = await captureRedirect(() =>
      passwordRecoveryAction(form({ email: "user@perx.test" })),
    );

    expect(redirected).toContain("/password-recovery?status=requested");
    expect(mocks.issuePasswordResetToken).not.toHaveBeenCalled();
  });

  it("stays neutral for a malformed email", async () => {
    const redirected = await captureRedirect(() =>
      passwordRecoveryAction(form({ email: "not-an-email" })),
    );

    expect(redirected).toContain("/password-recovery?status=requested");
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("suppresses issuing when the request limit is exceeded", async () => {
    mocks.userFindUnique.mockResolvedValue({
      email: "user@perx.test",
      id: "user-1",
      isActive: true,
    });
    mocks.hasExceededResetRequestLimit.mockResolvedValue(true);

    const redirected = await captureRedirect(() =>
      passwordRecoveryAction(form({ email: "user@perx.test" })),
    );

    expect(redirected).toContain("/password-recovery?status=requested");
    expect(mocks.issuePasswordResetToken).not.toHaveBeenCalled();
  });
});

describe("reset password submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hashPassword.mockResolvedValue("new-bcrypt-hash");
    mocks.consumePasswordResetToken.mockResolvedValue({
      ok: true,
      userId: "user-1",
    });
  });

  it("rejects a token that is invalid, expired, or already used", async () => {
    mocks.consumePasswordResetToken.mockResolvedValue({
      ok: false,
      reason: "invalid",
    });

    const state = await resetPasswordAction(
      { status: "idle" },
      form({
        confirmPassword: "CorrectHorse9",
        password: "CorrectHorse9",
        token: "stale",
      }),
    );

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/invalid or has expired/i);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("rejects mismatched confirmation before consuming the token", async () => {
    const state = await resetPasswordAction(
      { status: "idle" },
      form({
        confirmPassword: "Different9999",
        password: "CorrectHorse9",
        token: "raw",
      }),
    );

    expect(state.status).toBe("error");
    expect(mocks.consumePasswordResetToken).not.toHaveBeenCalled();
  });

  it("enforces the shared password policy", async () => {
    const state = await resetPasswordAction(
      { status: "idle" },
      form({ confirmPassword: "short", password: "short", token: "raw" }),
    );

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/at least 10 characters/i);
    expect(mocks.consumePasswordResetToken).not.toHaveBeenCalled();
  });

  it("writes a new hash and destroys every existing session", async () => {
    const redirected = await captureRedirect(() =>
      resetPasswordAction(
        { status: "idle" },
        form({
          confirmPassword: "CorrectHorse9",
          password: "CorrectHorse9",
          token: "raw",
        }),
      ),
    );

    expect(mocks.userUpdate).toHaveBeenCalledWith({
      data: { passwordHash: "new-bcrypt-hash" },
      where: { id: "user-1" },
    });
    // Recovery must evict a stolen session cookie.
    expect(mocks.sessionDeleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
    expect(redirected).toContain("/sign-in?passwordReset=1");
  });

  it("never records the raw password or token in the audit trail", async () => {
    await captureRedirect(() =>
      resetPasswordAction(
        { status: "idle" },
        form({
          confirmPassword: "CorrectHorse9",
          password: "CorrectHorse9",
          token: "raw",
        }),
      ),
    );

    const logged = JSON.stringify(mocks.writeAuditLog.mock.calls);
    expect(logged).not.toContain("CorrectHorse9");
    expect(logged).not.toContain("new-bcrypt-hash");
    expect(logged).not.toContain("raw");
  });
});
