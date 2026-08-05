import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteSession: vi.fn(),
  enforcementFindMany: vi.fn(),
  sessionFindUnique: vi.fn(),
  sessionUpdateMany: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => ({ value: "session-token" }),
    has: () => true,
  })),
  headers: vi.fn(async () => new Headers()),
}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@/lib/env", () => ({
  getServerEnv: vi.fn(() => ({ SESSION_COOKIE_NAME: "perx_session" })),
  hasDatabaseUrl: vi.fn(() => true),
}));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: vi.fn(() => ({
    enforcementAction: { findMany: mocks.enforcementFindMany },
    session: {
      delete: mocks.deleteSession,
      findUnique: mocks.sessionFindUnique,
      updateMany: mocks.sessionUpdateMany,
    },
  })),
}));

import { getCurrentUser, touchCurrentSession } from "@/lib/auth/session";

function sessionUser(overrides: Record<string, unknown> = {}) {
  return {
    accountClassification: "PUBLIC_BETA_USER",
    bannedAt: null,
    connectionRequestsRestrictedUntil: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    deactivatedAt: null,
    email: "user@example.test",
    emailVerifiedAt: null,
    enforcementReasonPublic: null,
    id: "user-1",
    imageUrl: null,
    isActive: true,
    messagingRestrictedUntil: null,
    name: "Test User",
    onboardingDismissedAt: null,
    profile: null,
    publishingRestrictedUntil: null,
    roles: [],
    suspendedAt: null,
    suspendedUntil: null,
    username: "test-user",
    verificationStatus: "VERIFIED",
    ...overrides,
  };
}

describe("session account enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforcementFindMany.mockResolvedValue([]);
    mocks.deleteSession.mockResolvedValue({});
    mocks.sessionUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("rejects a currently suspended session and revokes its session record", async () => {
    mocks.sessionFindUnique.mockResolvedValue({
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      id: "session-1",
      user: sessionUser({
        suspendedAt: new Date("2026-01-01T00:00:00.000Z"),
        suspendedUntil: new Date("2099-01-01T00:00:00.000Z"),
      }),
    });

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(mocks.deleteSession).toHaveBeenCalledWith({
      where: { id: "session-1" },
    });
  });

  it("allows an expired suspension and touches the still-valid session", async () => {
    mocks.sessionFindUnique.mockResolvedValue({
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      id: "session-1",
      user: sessionUser({
        suspendedAt: new Date("2026-01-01T00:00:00.000Z"),
        suspendedUntil: new Date("2026-01-02T00:00:00.000Z"),
      }),
    });

    await expect(getCurrentUser()).resolves.toMatchObject({ id: "user-1" });
    await expect(touchCurrentSession()).resolves.toBe(true);
    expect(mocks.sessionUpdateMany).toHaveBeenCalled();
  });

  it("rejects a banned account even when isActive was not independently cleared", async () => {
    mocks.sessionFindUnique.mockResolvedValue({
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      id: "session-1",
      user: sessionUser({ bannedAt: new Date("2026-01-01T00:00:00.000Z") }),
    });

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(mocks.deleteSession).toHaveBeenCalled();
  });
});
