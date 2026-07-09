import { describe, expect, it, vi, beforeEach } from "vitest";
import { getCurrentUser, requireUser, requireCapability } from "@/lib/auth/session";
import { hasDatabaseUrl } from "@/lib/env";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(() => ({ value: "some_cookie_value" })),
  })),
}));

vi.mock("@/lib/env", () => ({
  hasDatabaseUrl: vi.fn(),
  getServerEnv: vi.fn(() => ({ SESSION_COOKIE_NAME: "perx_session" })),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: vi.fn(() => ({
    session: {
      findUnique: vi.fn(),
    },
  })),
}));

describe("Session Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasDatabaseUrl).mockReturnValue(true);
  });

  describe("getCurrentUser", () => {
    it("returns null if DATABASE_URL is missing", async () => {
      vi.mocked(hasDatabaseUrl).mockReturnValue(false);
      const user = await getCurrentUser();
      expect(user).toBeNull();
    });
  });

  describe("requireUser", () => {
    it("redirects to sign-in if no session exists", async () => {
      vi.mocked(hasDatabaseUrl).mockReturnValue(false);
      await expect(requireUser()).rejects.toThrow("REDIRECT:/sign-in?next=/app");
    });
  });

  describe("requireCapability", () => {
    it("redirects to sign-in if no session exists", async () => {
      vi.mocked(hasDatabaseUrl).mockReturnValue(false);
      await expect(requireCapability("admin:access")).rejects.toThrow("REDIRECT:/sign-in?next=/app");
    });
  });
});
