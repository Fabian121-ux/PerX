import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({
  verify: vi.fn(),
  find: vi.fn(),
  update: vi.fn(),
  session: vi.fn(),
  clear: vi.fn(),
  grant: vi.fn(),
  set: vi.fn(),
}));
vi.mock("@/lib/auth/supabase-server", () => ({
  createSupabaseServerClient: async () => ({ auth: { verifyOtp: m.verify } }),
  clearSupabaseSession: m.clear,
  RECOVERY_COOKIE: "recovery",
}));
vi.mock("@/lib/auth/supabase-config", () => ({
  authEmailRedirect: () => "https://app.example.test/auth/confirm",
}));
vi.mock("@/lib/auth/session", () => ({ createSession: m.session }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: m.set }) }));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({ user: { findUnique: m.find, update: m.update } }),
}));
vi.mock("@/lib/auth/password-reset", () => ({
  issuePasswordResetToken: m.grant,
}));
import { GET } from "@/app/auth/confirm/route";
const uuid = "12345678-1234-4234-8234-123456789abc";
beforeEach(() => {
  vi.clearAllMocks();
  m.verify.mockResolvedValue({
    data: { user: { id: uuid, email_confirmed_at: "2026-09-01" }, session: {} },
    error: null,
  });
  m.find.mockResolvedValue({
    id: "app-user",
    authUserId: uuid,
    isActive: true,
  });
  m.grant.mockResolvedValue({
    token: "test-grant",
    expiresAt: new Date("2099-01-01"),
  });
});
function request(query: string) {
  return new NextRequest(`https://app.example.test/auth/confirm?${query}`);
}
it.each(["", "token_hash=bad&type=unknown", "type=signup"])(
  "rejects invalid confirmation input %s without contacting provider",
  async (query) => {
    expect((await GET(request(query))).headers.get("location")).toBe(
      "https://app.example.test/sign-in?confirmation=invalid",
    );
    expect(m.verify).not.toHaveBeenCalled();
    expect(m.session).not.toHaveBeenCalled();
  },
);
it("rejects expired tokens without establishing application session", async () => {
  m.verify.mockResolvedValue({
    data: { user: null, session: null },
    error: { message: "expired" },
  });
  expect(
    (await GET(request("token_hash=test&type=signup"))).headers.get("location"),
  ).toContain("confirmation=invalid");
  expect(m.session).not.toHaveBeenCalled();
});
it("rejects unknown verified identity rather than matching email", async () => {
  m.find.mockResolvedValue(null);
  await GET(request("token_hash=test&type=signup"));
  expect(m.find).toHaveBeenCalledWith({ where: { authUserId: uuid } });
  expect(m.session).not.toHaveBeenCalled();
  expect(m.clear).toHaveBeenCalled();
});
it.each(["https://evil.example", "//evil.example", "/\\evil.example"])(
  "rejects hostile return path %s",
  async (next) => {
    const r = await GET(
      request(`token_hash=test&type=signup&next=${encodeURIComponent(next)}`),
    );
    expect(r.headers.get("location")).toBe(
      "https://app.example.test/app/profile/setup",
    );
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(m.session).toHaveBeenCalledWith("app-user");
  },
);
it("recovery issues a server-only one-use grant without application access", async () => {
  const r = await GET(request("token_hash=test&type=recovery"));
  expect(r.headers.get("location")).toBe(
    "https://app.example.test/reset-password",
  );
  expect(m.grant).toHaveBeenCalledWith({ userId: "app-user" });
  expect(m.set).toHaveBeenCalledWith(
    "recovery",
    "test-grant",
    expect.objectContaining({ httpOnly: true }),
  );
  expect(m.session).not.toHaveBeenCalled();
});

it("uses the trusted app origin even when Next supplies an internal request host", async () => {
  const r = await GET(
    new NextRequest(
      "http://localhost:3100/auth/confirm?token_hash=test&type=signup",
    ),
  );
  expect(r.headers.get("location")).toBe(
    "https://app.example.test/app/profile/setup",
  );
});
