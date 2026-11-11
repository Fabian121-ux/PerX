import "../utils/legacy-auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * EMAIL-1: enumeration safety of `passwordRecoveryAction`.
 *
 * The action's whole value is that a requester cannot tell these apart:
 * known-active, unknown, deactivated, rate-limited, provider-failed, and
 * delivery-unconfigured. Adding a real email provider is exactly the change
 * that could break it, in two ways:
 *
 *   CONTENT - a different redirect or status for one branch;
 *   TIMING  - only the known-account branch paying provider network latency.
 *
 * The timing half is structural rather than statistical: the provider call is
 * required to happen inside the `after()` callback, so it cannot sit in the
 * request path at all. These tests assert that structure directly.
 */

const NEUTRAL_REDIRECT = "/password-recovery?status=requested";
const SENTINEL_TOKEN = "SENTINEL_TOKEN_VALUE";
const KNOWN_EMAIL = "known-active@example.invalid";
const UNKNOWN_EMAIL = "nobody-here@example.invalid";
const DEACTIVATED_EMAIL = "deactivated@example.invalid";

const mocks = vi.hoisted(() => ({
  afterTasks: [] as Array<() => unknown>,
  deliver: vi.fn(),
  findUnique: vi.fn(),
  hasExceededResetRequestLimit: vi.fn(),
  issuePasswordResetToken: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  writeAuditLog: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/server", () => ({
  // Capture rather than run, so a test can prove the action returned before
  // any deferred work executed.
  after: (task: () => unknown) => {
    mocks.afterTasks.push(task);
  },
}));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({ user: { findUnique: mocks.findUnique } }),
}));
vi.mock("@/lib/env", () => ({
  getResolvedDataMode: () => "database",
  hasDatabaseUrl: () => true,
}));
vi.mock("@/lib/logging/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/auth/password-reset", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  hasExceededResetRequestLimit: mocks.hasExceededResetRequestLimit,
  issuePasswordResetToken: mocks.issuePasswordResetToken,
}));
vi.mock("@/lib/auth/password-reset-delivery", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  buildPasswordResetUrl: (token: string) =>
    `https://www.example.invalid/reset-password?token=${token}`,
  passwordResetDelivery: { deliverPasswordResetLink: mocks.deliver },
}));

import { passwordRecoveryAction } from "@/features/auth/actions";

function form(email: string) {
  const formData = new FormData();
  formData.set("email", email);
  return formData;
}

/** The action's entire observable surface: what it threw, and where it sent you. */
async function observe(email: string) {
  try {
    await passwordRecoveryAction(form(email));
    return { redirect: null as string | null, threw: false };
  } catch (error) {
    const message = String((error as Error).message);
    return {
      redirect: message.startsWith("REDIRECT:")
        ? message.slice("REDIRECT:".length)
        : null,
      threw: !message.startsWith("REDIRECT:"),
    };
  }
}

async function runAfterTasks() {
  const tasks = [...mocks.afterTasks];
  mocks.afterTasks.length = 0;
  for (const task of tasks) await task();
}

function captureLogs() {
  const logs: string[] = [];
  for (const level of ["debug", "error", "info", "log", "warn"] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logs.push(args.map((a) => JSON.stringify(a)).join(" "));
    });
  }
  return logs;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.afterTasks.length = 0;
  mocks.findUnique.mockImplementation(async ({ where }) => {
    if (where.email === KNOWN_EMAIL) {
      return { email: KNOWN_EMAIL, id: "user-known", isActive: true };
    }
    if (where.email === DEACTIVATED_EMAIL) {
      return { email: DEACTIVATED_EMAIL, id: "user-off", isActive: false };
    }
    return null;
  });
  mocks.hasExceededResetRequestLimit.mockResolvedValue(false);
  mocks.issuePasswordResetToken.mockResolvedValue({
    expiresAt: new Date("2026-01-01T00:30:00.000Z"),
    token: SENTINEL_TOKEN,
  });
  mocks.deliver.mockResolvedValue({ provider: "disabled", status: "unconfigured" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("observable response is identical across every branch", () => {
  it("known-active, unknown and deactivated are indistinguishable", async () => {
    const known = await observe(KNOWN_EMAIL);
    const unknown = await observe(UNKNOWN_EMAIL);
    const deactivated = await observe(DEACTIVATED_EMAIL);

    expect(known).toEqual({ redirect: NEUTRAL_REDIRECT, threw: false });
    expect(unknown).toEqual(known);
    expect(deactivated).toEqual(known);
  });

  it("a rate-limited request is indistinguishable and sends nothing", async () => {
    mocks.hasExceededResetRequestLimit.mockResolvedValue(true);

    const limited = await observe(KNOWN_EMAIL);
    await runAfterTasks();

    expect(limited).toEqual({ redirect: NEUTRAL_REDIRECT, threw: false });
    expect(mocks.deliver).not.toHaveBeenCalled();
    expect(mocks.issuePasswordResetToken).not.toHaveBeenCalled();
  });

  it("an invalid email address is indistinguishable", async () => {
    expect(await observe("not-an-email")).toEqual({
      redirect: NEUTRAL_REDIRECT,
      threw: false,
    });
  });

  it("provider success and provider failure produce the same response", async () => {
    mocks.deliver.mockResolvedValue({ provider: "resend", status: "delivered" });
    const delivered = await observe(KNOWN_EMAIL);
    await runAfterTasks();

    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue({
      email: KNOWN_EMAIL,
      id: "user-known",
      isActive: true,
    });
    mocks.hasExceededResetRequestLimit.mockResolvedValue(false);
    mocks.issuePasswordResetToken.mockResolvedValue({
      expiresAt: new Date("2026-01-01T00:30:00.000Z"),
      token: SENTINEL_TOKEN,
    });
    mocks.deliver.mockResolvedValue({
      provider: "resend",
      reason: "network",
      status: "failed",
    });
    const failed = await observe(KNOWN_EMAIL);
    await runAfterTasks();

    expect(failed).toEqual(delivered);
  });

  it("a provider that throws still cannot change the response", async () => {
    mocks.deliver.mockRejectedValue(new Error("provider exploded"));

    const result = await observe(KNOWN_EMAIL);
    await expect(runAfterTasks()).resolves.not.toThrow();

    expect(result).toEqual({ redirect: NEUTRAL_REDIRECT, threw: false });
  });

  it("a database outage cannot change the response", async () => {
    mocks.findUnique.mockRejectedValue(new Error("connection refused"));

    expect(await observe(KNOWN_EMAIL)).toEqual({
      redirect: NEUTRAL_REDIRECT,
      threw: false,
    });
  });
});

describe("delivery is deferred past the response boundary", () => {
  it("does not deliver before the action returns its redirect", async () => {
    await observe(KNOWN_EMAIL);

    // The action has fully returned here. Nothing may have been sent yet.
    expect(mocks.deliver).not.toHaveBeenCalled();
    expect(mocks.afterTasks.length).toBeGreaterThan(0);

    await runAfterTasks();
    expect(mocks.deliver).toHaveBeenCalledTimes(1);
  });

  it("schedules deferred work uniformly, so registration is not a signal", async () => {
    await observe(KNOWN_EMAIL);
    const known = mocks.afterTasks.length;

    mocks.afterTasks.length = 0;
    await observe(UNKNOWN_EMAIL);
    const unknown = mocks.afterTasks.length;

    mocks.afterTasks.length = 0;
    await observe(DEACTIVATED_EMAIL);
    const deactivated = mocks.afterTasks.length;

    mocks.afterTasks.length = 0;
    mocks.hasExceededResetRequestLimit.mockResolvedValue(true);
    await observe(KNOWN_EMAIL);
    const limited = mocks.afterTasks.length;

    expect(known).toBe(1);
    expect(unknown).toBe(known);
    expect(deactivated).toBe(known);
    expect(limited).toBe(known);
  });

  it("only the eligible known-active account actually delivers", async () => {
    await observe(UNKNOWN_EMAIL);
    await runAfterTasks();
    expect(mocks.deliver).not.toHaveBeenCalled();

    await observe(DEACTIVATED_EMAIL);
    await runAfterTasks();
    expect(mocks.deliver).not.toHaveBeenCalled();

    await observe(KNOWN_EMAIL);
    await runAfterTasks();
    expect(mocks.deliver).toHaveBeenCalledTimes(1);
  });

  it("does not use a bare unawaited promise instead of after()", async () => {
    /*
     * If the action had used `void deliver(...)`, delivery would already have
     * been invoked by the time it returned and there would be no registered
     * task. Both halves are asserted so neither alone can pass.
     */
    await observe(KNOWN_EMAIL);

    expect(mocks.deliver).not.toHaveBeenCalled();
    expect(mocks.afterTasks).toHaveLength(1);
  });
});

describe("no credential reaches the logs", () => {
  it("logs the outcome without token, url or recipient", async () => {
    const logs = captureLogs();
    mocks.deliver.mockResolvedValue({
      provider: "resend",
      reason: "network",
      status: "failed",
    });

    await observe(KNOWN_EMAIL);
    await runAfterTasks();

    const combined = logs.join("\n");
    expect(combined).not.toContain(SENTINEL_TOKEN);
    expect(combined).not.toContain(KNOWN_EMAIL);
    expect(combined).not.toContain("/reset-password?token=");
    // But the operational outcome must still be recoverable.
    expect(combined).toContain("failed");
  });

  it("records the delivery status for every outcome", async () => {
    for (const status of ["delivered", "logged", "unconfigured"] as const) {
      vi.clearAllMocks();
      const logs = captureLogs();
      mocks.findUnique.mockResolvedValue({
        email: KNOWN_EMAIL,
        id: "user-known",
        isActive: true,
      });
      mocks.hasExceededResetRequestLimit.mockResolvedValue(false);
      mocks.issuePasswordResetToken.mockResolvedValue({
        expiresAt: new Date("2026-01-01T00:30:00.000Z"),
        token: SENTINEL_TOKEN,
      });
      mocks.deliver.mockResolvedValue({ provider: "disabled", status });

      await observe(KNOWN_EMAIL);
      await runAfterTasks();

      const combined = logs.join("\n");
      expect(combined).toContain(status);
      expect(combined).not.toContain(SENTINEL_TOKEN);
      vi.restoreAllMocks();
    }
  });
});
