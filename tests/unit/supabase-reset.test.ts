import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  identity: vi.fn(),
  cookie: vi.fn(),
  user: vi.fn(),
  consume: vi.fn(),
  remove: vi.fn(),
  audit: vi.fn(),
  update: vi.fn(),
  logout: vi.fn(),
  destroy: vi.fn(),
  order: [] as string[],
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: m.cookie }) }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw Object.assign(new Error(path), { digest: "NEXT_REDIRECT;" });
  },
  unstable_rethrow: (e: { digest?: string }) => {
    if (e.digest) throw e;
  },
}));
vi.mock("@/lib/auth/session", () => ({
  createSession: vi.fn(),
  destroySession: m.destroy,
}));
vi.mock("@/lib/auth/supabase-server", () => ({
  getVerifiedSupabaseIdentity: m.identity,
  RECOVERY_COOKIE: "recovery",
  clearSupabaseSession: vi.fn(),
  createSupabaseServerClient: async () => ({
    auth: { updateUser: m.update, signOut: m.logout },
  }),
}));
vi.mock("@/lib/auth/password-reset", () => ({
  consumePasswordResetToken: m.consume,
}));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    user: { findUnique: m.user },
    session: { deleteMany: m.remove },
    auditLog: { create: m.audit },
    $transaction: async (cb: (tx: unknown) => unknown) =>
      cb({ session: { deleteMany: m.remove }, auditLog: { create: m.audit } }),
  }),
}));
vi.mock("@/lib/logging/runtime", () => ({ logServerDataError: vi.fn() }));
import { supabaseResetPassword } from "@/lib/auth/supabase-flow";
beforeEach(() => {
  vi.clearAllMocks();
  m.order.length = 0;
  m.identity.mockResolvedValue({
    id: "provider-uuid",
    email_confirmed_at: "today",
  });
  m.cookie.mockReturnValue({ value: "one-use-grant" });
  m.user.mockResolvedValue({ id: "app-user" });
  m.consume.mockResolvedValue({ ok: true, userId: "app-user" });
  m.remove.mockImplementation(async () => {
    m.order.push("revoke");
  });
  m.update.mockImplementation(async () => {
    m.order.push("provider-password");
    return { error: null };
  });
  m.logout.mockResolvedValue({ error: null });
  m.audit.mockResolvedValue({});
});
it("binds one-use recovery grant to verified UUID and revokes sessions before and after password change", async () => {
  await expect(supabaseResetPassword("Newpassword123")).rejects.toThrow(
    "/sign-in?passwordReset=1",
  );
  expect(m.order).toEqual(["revoke", "provider-password", "revoke"]);
  expect(m.user).toHaveBeenCalledWith({
    where: { authUserId: "provider-uuid" },
    select: { id: true },
  });
  expect(m.logout).toHaveBeenCalledWith({ scope: "global" });
  expect(m.destroy).toHaveBeenCalled();
});
it.each(["no-identity", "no-grant", "wrong-account", "consumed"])(
  "does not update provider password for %s",
  async (state) => {
    if (state === "no-identity") m.identity.mockResolvedValue(null);
    if (state === "no-grant") m.cookie.mockReturnValue(undefined);
    if (state === "wrong-account")
      m.consume.mockResolvedValue({ ok: true, userId: "other" });
    if (state === "consumed") m.consume.mockResolvedValue({ ok: false });
    expect((await supabaseResetPassword("Newpassword123")).status).toBe(
      "error",
    );
    expect(m.update).not.toHaveBeenCalled();
  },
);
it("reports provider failure without claiming password success", async () => {
  m.update.mockResolvedValue({ error: { message: "provider-failure" } });
  expect((await supabaseResetPassword("Newpassword123")).status).toBe("error");
  expect(m.remove).toHaveBeenCalledTimes(1);
  expect(m.destroy).not.toHaveBeenCalled();
});
