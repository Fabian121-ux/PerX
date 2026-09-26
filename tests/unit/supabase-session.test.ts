import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  findSession: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => ({ value: "local-revocation-token" }),
    has: () => true,
  }),
  headers: async () => new Headers(),
}));
vi.mock("@/lib/env", () => ({
  hasDatabaseUrl: () => true,
  getServerEnv: () => ({ SESSION_COOKIE_NAME: "ptahx_session" }),
}));
vi.mock("@/lib/auth/supabase-server", () => ({
  getVerifiedSupabaseIdentity: mocks.identity,
  clearSupabaseSession: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    session: {
      findUnique: mocks.findSession,
      delete: mocks.remove,
      updateMany: mocks.update,
    },
  }),
}));
import {
  getCurrentUser,
  validateCurrentSessionAccess,
} from "@/lib/auth/session";
const uuid = "12345678-1234-4234-8234-123456789abc";
function user(overrides: Record<string, unknown> = {}) {
  return {
    id: "app-cuid",
    authUserId: uuid,
    email: "same@example.test",
    name: "Member",
    username: "member",
    isActive: true,
    verificationStatus: "UNVERIFIED",
    profile: null,
    roles: [{ role: { name: "MEMBER" } }],
    ...overrides,
  };
}
describe("Supabase identity is required in addition to PtahX revocation and enforcement", () => {
  beforeEach(() => {
    vi.stubEnv("PERX_AUTH_PROVIDER", "supabase");
    vi.clearAllMocks();
    mocks.identity.mockResolvedValue({
      id: uuid,
      email_confirmed_at: "2026-09-01T00:00:00Z",
    });
    mocks.remove.mockResolvedValue({});
    mocks.findSession.mockResolvedValue({
      id: "session",
      expiresAt: new Date("2099-01-01"),
      user: user(),
    });
  });
  afterEach(() => vi.unstubAllEnvs());
  it("accepts verified linked identity with application roles", async () => {
    expect(await getCurrentUser()).toMatchObject({
      id: "app-cuid",
      roles: ["MEMBER"],
    });
    expect(mocks.identity).toHaveBeenCalled();
  });
  it.each([
    null,
    { id: uuid, email_confirmed_at: null },
    {
      id: "99999999-1234-4234-8234-123456789abc",
      email: "same@example.test",
      email_confirmed_at: "2026-09-01",
    },
  ])(
    "rejects missing, unverified or mismatched provider identity %j",
    async (identity) => {
      mocks.identity.mockResolvedValue(identity);
      expect(await getCurrentUser()).toBeNull();
      expect(await validateCurrentSessionAccess()).toBe(false);
    },
  );
  it("never links an unknown identity by matching email", async () => {
    mocks.findSession.mockResolvedValue({
      id: "session",
      expiresAt: new Date("2099-01-01"),
      user: user({ authUserId: null }),
    });
    expect(await getCurrentUser()).toBeNull();
  });
  it.each([
    { isActive: false },
    { bannedAt: new Date() },
    { deactivatedAt: new Date() },
    { suspendedAt: new Date(), suspendedUntil: new Date("2099-01-01") },
  ])(
    "enforces PtahX restrictions despite verified provider identity %j",
    async (restriction) => {
      mocks.findSession.mockResolvedValue({
        id: "session",
        expiresAt: new Date("2099-01-01"),
        user: user(restriction),
      });
      expect(await getCurrentUser()).toBeNull();
    },
  );
  it("rejects revoked application session even with valid Supabase identity", async () => {
    mocks.findSession.mockResolvedValue(null);
    expect(await getCurrentUser()).toBeNull();
  });
});
