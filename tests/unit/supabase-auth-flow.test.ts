import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  signUp: vi.fn(),
  signIn: vi.fn(),
  clear: vi.fn(),
  session: vi.fn(),
  transaction: vi.fn(),
  first: vi.fn(),
  unique: vi.fn(),
  create: vi.fn(),
  role: vi.fn(),
  audit: vi.fn(),
  gate: vi.fn(),
  after: vi.fn(),
  reset: vi.fn(),
  cookie: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error(url), {
      digest: `NEXT_REDIRECT;replace;${url};307;`,
    });
  },
  unstable_rethrow: (e: { digest?: string }) => {
    if (e.digest?.startsWith("NEXT_REDIRECT")) throw e;
  },
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: m.cookie }) }));
vi.mock("next/server", () => ({ after: m.after }));
vi.mock("@/lib/auth/supabase-server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { signUp: m.signUp, signInWithPassword: m.signIn },
  }),
  clearSupabaseSession: m.clear,
  getVerifiedSupabaseIdentity: vi.fn(),
  RECOVERY_COOKIE: "recovery",
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { resetPasswordForEmail: m.reset } }),
}));
vi.mock("@/lib/auth/supabase-config", () => ({
  authEmailRedirect: () => "https://app.example.test/auth/confirm",
  supabaseAuthConfig: () => ({
    url: "https://provider.example.test",
    key: "public-test-key",
  }),
}));
vi.mock("@/lib/auth/session", () => ({
  createSession: m.session,
  destroySession: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    $transaction: m.transaction,
    user: { findFirst: m.first, findUnique: m.unique, create: m.create },
    role: { upsert: m.role },
    auditLog: { create: m.audit },
  }),
}));
vi.mock("@/lib/registration/status", () => ({ checkRegistrationGate: m.gate }));
vi.mock("@/lib/logging/runtime", () => ({ logServerDataError: vi.fn() }));
import {
  supabaseSignIn,
  supabaseSignUp,
  supabasePasswordRecovery,
} from "@/lib/auth/supabase-flow";
const id = "12345678-1234-4234-8234-123456789abc";
const input = {
  email: "member@example.test",
  name: "Member",
  username: "member",
  password: "Testpassword123",
  confirmPassword: "Testpassword123",
  termsAccepted: true as const,
};
const linked = {
  id: "app-cuid",
  authUserId: id,
  isActive: true,
  verificationStatus: "UNVERIFIED",
};
beforeEach(() => {
  vi.clearAllMocks();
  m.transaction.mockImplementation(async (cb) =>
    cb({
      user: { findFirst: m.first, create: m.create },
      role: { upsert: m.role },
      auditLog: { create: m.audit },
    }),
  );
  m.gate.mockResolvedValue({ allowed: true });
  m.first.mockResolvedValue(null);
  m.unique.mockResolvedValue(linked);
  m.create.mockResolvedValue({ id: "app-cuid" });
  m.role.mockResolvedValue({ id: "member-role" });
  m.audit.mockResolvedValue({});
  m.signUp.mockResolvedValue({
    data: {
      user: { id, email: input.email, identities: [{ id: "identity" }] },
      session: null,
    },
    error: null,
  });
  m.signIn.mockResolvedValue({
    data: { user: { id, email_confirmed_at: "2026-09-01" }, session: {} },
    error: null,
  });
  m.reset.mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllEnvs());
describe("Supabase auth orchestration", () => {
  it("assigns only provider UUID, membership and server defaults at signup", async () => {
    await expect(
      supabaseSignUp(
        {
          ...input,
          userId: "attacker",
          authUserId: "attacker",
        } as typeof input,
        {},
      ),
    ).rejects.toThrow("/sign-in?confirmation=required");
    expect(m.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          authUserId: id,
          passwordHash: "!supabase-auth-only",
          accountClassification: "PUBLIC_BETA_USER",
        }),
      }),
    );
    expect(m.create.mock.calls[0][0].data).not.toHaveProperty("id");
    expect(m.session).not.toHaveBeenCalled();
    expect(m.audit).toHaveBeenCalled();
  });
  it("does not call provider when username/email or beta gate rejects", async () => {
    m.first.mockResolvedValue({ id: "existing" });
    expect((await supabaseSignUp(input, {})).status).toBe("error");
    expect(m.signUp).not.toHaveBeenCalled();
  });
  it("explicitly reports provider-success/application-failure without deleting an identity", async () => {
    m.create.mockRejectedValueOnce({ code: "P2002" });
    expect(await supabaseSignUp(input, {})).toMatchObject({
      status: "error",
      message: expect.stringContaining("setup did not finish"),
    });
    expect(m.session).not.toHaveBeenCalled();
  });
  it("rejects ambiguous existing provider identities", async () => {
    m.signUp.mockResolvedValue({
      data: { user: { id, email: input.email, identities: [] } },
      error: null,
    });
    expect((await supabaseSignUp(input, {})).status).toBe("error");
    expect(m.create).not.toHaveBeenCalled();
  });
  it("fails closed when provider confirmation is disabled", async () => {
    m.signUp.mockResolvedValue({
      data: {
        user: {
          id,
          email: input.email,
          identities: [{}],
          email_confirmed_at: "today",
        },
        session: {},
      },
      error: null,
    });
    expect((await supabaseSignUp(input, {})).status).toBe("error");
    expect(m.create).not.toHaveBeenCalled();
    expect(m.clear).toHaveBeenCalled();
  });
  it("verified sign-in selects the unique UUID bridge and creates a revocation session", async () => {
    await expect(supabaseSignIn(input, "/app", {})).rejects.toThrow("/app");
    expect(m.unique).toHaveBeenCalledWith({ where: { authUserId: id } });
    expect(m.session).toHaveBeenCalledWith("app-cuid");
  });
  it("unknown provider identity cannot inherit a matching-email application account", async () => {
    m.unique.mockResolvedValue(null);
    expect((await supabaseSignIn(input, "/app", {})).status).toBe("error");
    expect(m.session).not.toHaveBeenCalled();
    expect(m.clear).toHaveBeenCalled();
  });
  it("unverified sign-in creates no application session", async () => {
    m.signIn.mockResolvedValue({
      data: { user: { id, email_confirmed_at: null }, session: {} },
      error: null,
    });
    expect((await supabaseSignIn(input, "/app", {})).status).toBe("error");
    expect(m.session).not.toHaveBeenCalled();
  });
  it.each([
    { bannedAt: new Date() },
    { deactivatedAt: new Date() },
    { isActive: false },
    { suspendedAt: new Date(), suspendedUntil: new Date("2099-01-01") },
  ])("denies linked restricted account %j", async (restriction) => {
    m.unique.mockResolvedValue({ ...linked, ...restriction });
    expect((await supabaseSignIn(input, "/app", {})).status).toBe("error");
    expect(m.session).not.toHaveBeenCalled();
  });
  it.each([
    null,
    { authUserId: id, isActive: true },
    { authUserId: null, isActive: true },
  ])(
    "recovery has identical immediate response and defers every lookup %j",
    async (user) => {
      m.unique.mockResolvedValue(user);
      const form = new FormData();
      form.set("email", input.email);
      await expect(supabasePasswordRecovery(form)).rejects.toThrow(
        "/password-recovery?status=requested",
      );
      expect(m.unique).not.toHaveBeenCalled();
      expect(m.reset).not.toHaveBeenCalled();
      expect(m.after).toHaveBeenCalledTimes(1);
      await m.after.mock.calls[0][0]();
      expect(m.reset).toHaveBeenCalledTimes(user?.authUserId ? 1 : 0);
    },
  );
});
