import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  signUpAction,
  signInAction,
  signOutAction,
} from "@/features/auth/actions";
import { getResolvedDataMode, hasDatabaseUrl } from "@/lib/env";
import { getPrisma } from "@/lib/db/prisma";
import * as session from "@/lib/auth/session";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/env", () => ({
  getResolvedDataMode: vi.fn(),
  hasDatabaseUrl: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  createSession: vi.fn(),
  destroySession: vi.fn(),
}));

vi.mock("@/lib/auth/password", () => ({
  verifyPassword: vi.fn(
    (pass, hash) => pass === "validpass" && hash === "hashed_validpass",
  ),
  hashPassword: vi.fn(() => "hashed_password"),
}));

vi.mock("@/lib/logging/audit", () => ({
  writeAuditLog: vi.fn(),
}));

describe("Auth Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasDatabaseUrl).mockReturnValue(true);
    vi.mocked(getResolvedDataMode).mockReturnValue("database");
  });

  describe("signUpAction", () => {
    it("redirects to profile setup on mock mode without hitting DB", async () => {
      vi.mocked(getResolvedDataMode).mockReturnValue("mock");
      const formData = new FormData();

      await expect(signUpAction(formData)).rejects.toThrow(
        "REDIRECT:/app/profile/setup?mock=true",
      );
      expect(getPrisma).not.toHaveBeenCalled();
    });

    it("redirects with email-taken on P2002 error", async () => {
      vi.mocked(getPrisma).mockReturnValue({
        user: {
          create: vi
            .fn()
            .mockRejectedValue({ code: "P2002", meta: { target: ["email"] } }),
          count: vi.fn().mockResolvedValue(0),
        },
      } as never);

      const formData = new FormData();
      formData.set("email", "test@test.com");
      formData.set("name", "Test User");
      formData.set("password", "validpassword");

      await expect(signUpAction(formData)).rejects.toThrow(
        "REDIRECT:/sign-up?error=email-taken",
      );
    });

    it("redirects with username-taken on P2002 error", async () => {
      vi.mocked(getPrisma).mockReturnValue({
        user: {
          create: vi
            .fn()
            .mockRejectedValue({
              code: "P2002",
              meta: { target: ["username"] },
            }),
          count: vi.fn().mockResolvedValue(0),
        },
      } as never);

      const formData = new FormData();
      formData.set("email", "test@test.com");
      formData.set("name", "Test User");
      formData.set("password", "validpassword");

      await expect(signUpAction(formData)).rejects.toThrow(
        "REDIRECT:/sign-up?error=username-taken",
      );
    });

    it("creates user and redirects to setup on success", async () => {
      vi.mocked(getPrisma).mockReturnValue({
        user: {
          create: vi
            .fn()
            .mockResolvedValue({
              id: "user_1",
              email: "test@test.com",
              username: "test",
            }),
          findUnique: vi.fn().mockResolvedValue(null),
          count: vi.fn().mockResolvedValue(0),
        },
      } as never);

      const formData = new FormData();
      formData.set("email", "test@test.com");
      formData.set("name", "Test User");
      formData.set("password", "validpassword");

      await expect(signUpAction(formData)).rejects.toThrow(
        "REDIRECT:/app/profile/setup",
      );
      expect(session.createSession).toHaveBeenCalledWith("user_1");
      expect(getPrisma().role).toBeUndefined();
    });
  });

  describe("signInAction", () => {
    it("redirects to invalid-credentials on incorrect password", async () => {
      vi.mocked(getPrisma).mockReturnValue({
        user: {
          findUnique: vi
            .fn()
            .mockResolvedValue({
              id: "user_1",
              passwordHash: "hashed_wrongpass",
              isActive: true,
            }),
        },
      } as never);

      const formData = new FormData();
      formData.set("email", "test@test.com");
      formData.set("password", "wrongpass");

      await expect(signInAction(formData)).rejects.toThrow(
        "REDIRECT:/sign-in?error=invalid-credentials",
      );
    });

    it("redirects to account-deactivated if user is not active", async () => {
      vi.mocked(getPrisma).mockReturnValue({
        user: {
          findUnique: vi
            .fn()
            .mockResolvedValue({
              id: "user_1",
              passwordHash: "hashed_validpass",
              isActive: false,
            }),
        },
      } as never);

      const formData = new FormData();
      formData.set("email", "test@test.com");
      formData.set("password", "validpass");

      await expect(signInAction(formData)).rejects.toThrow(
        "REDIRECT:/sign-in?error=account-deactivated",
      );
    });

    it("creates session and redirects to /app on success", async () => {
      vi.mocked(getPrisma).mockReturnValue({
        user: {
          findUnique: vi
            .fn()
            .mockResolvedValue({
              id: "user_1",
              passwordHash: "hashed_validpass",
              isActive: true,
            }),
        },
      } as never);

      const formData = new FormData();
      formData.set("email", "test@test.com");
      formData.set("password", "validpass");

      await expect(signInAction(formData)).rejects.toThrow("REDIRECT:/app");
      expect(session.createSession).toHaveBeenCalledWith("user_1");
    });
  });

  describe("signOutAction", () => {
    it("destroys session and redirects to /", async () => {
      await expect(signOutAction()).rejects.toThrow("REDIRECT:/");
      expect(session.destroySession).toHaveBeenCalled();
    });
  });
});
