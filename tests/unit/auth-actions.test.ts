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
  createSessionRecord: vi.fn(),
  destroySession: vi.fn(),
  setSessionCookie: vi.fn(),
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
  const idleState = { status: "idle" } as const;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasDatabaseUrl).mockReturnValue(true);
    vi.mocked(getResolvedDataMode).mockReturnValue("database");
  });

  describe("signUpAction", () => {
    it("redirects to profile setup on mock mode without hitting DB", async () => {
      vi.mocked(getResolvedDataMode).mockReturnValue("mock");
      const formData = new FormData();

      await expect(signUpAction(idleState, formData)).rejects.toThrow(
        "REDIRECT:/app/profile/setup?mock=true",
      );
      expect(getPrisma).not.toHaveBeenCalled();
    });

    it("returns a field error when email is already used", async () => {
      vi.mocked(getPrisma).mockReturnValue({
        user: {
          findFirst: vi.fn().mockResolvedValue({
            email: "test@test.com",
            username: "other",
          }),
        },
      } as never);

      const formData = new FormData();
      formData.set("email", "test@test.com");
      formData.set("name", "Test User");
      formData.set("username", "test");
      formData.set("password", "validpassword1");
      formData.set("confirmPassword", "validpassword1");
      formData.set("terms", "on");

      await expect(signUpAction(idleState, formData)).resolves.toMatchObject({
        fieldErrors: { email: "An account with this email already exists." },
        status: "error",
      });
    });

    it("returns a field error when username is already used", async () => {
      vi.mocked(getPrisma).mockReturnValue({
        user: {
          findFirst: vi.fn().mockResolvedValue({
            email: "other@test.com",
            username: "test",
          }),
        },
      } as never);

      const formData = new FormData();
      formData.set("email", "test@test.com");
      formData.set("name", "Test User");
      formData.set("username", "test");
      formData.set("password", "validpassword1");
      formData.set("confirmPassword", "validpassword1");
      formData.set("terms", "on");

      await expect(signUpAction(idleState, formData)).resolves.toMatchObject({
        fieldErrors: { username: "This username is already taken." },
        status: "error",
      });
    });

    it("creates user and redirects to setup on success", async () => {
      const tx = {
        role: {
          upsert: vi
            .fn()
            .mockResolvedValueOnce({ id: "role_client" })
            .mockResolvedValueOnce({ id: "role_freelancer" }),
        },
        user: {
          create: vi.fn().mockResolvedValue({
            id: "user_1",
          }),
        },
      };
      vi.mocked(getPrisma).mockReturnValue({
        user: {
          findUnique: vi.fn().mockResolvedValue(null),
          findFirst: vi.fn().mockResolvedValue(null),
        },
        $transaction: vi.fn((callback) => callback(tx)),
      } as never);
      vi.mocked(session.createSessionRecord).mockResolvedValue({
        maxAge: 60,
        name: "perx_session",
        value: "session-token",
      });

      const formData = new FormData();
      formData.set("email", "test@test.com");
      formData.set("name", "Test User");
      formData.set("username", "test");
      formData.set("password", "validpassword1");
      formData.set("confirmPassword", "validpassword1");
      formData.set("terms", "on");

      await expect(signUpAction(idleState, formData)).rejects.toThrow(
        "REDIRECT:/app/profile/setup",
      );
      expect(session.createSessionRecord).toHaveBeenCalledWith("user_1", tx);
      expect(session.setSessionCookie).toHaveBeenCalledWith({
        maxAge: 60,
        name: "perx_session",
        value: "session-token",
      });
      expect(tx.role.upsert).toHaveBeenCalledTimes(2);
    });

    it("returns an inline error when confirmation does not match", async () => {
      const formData = new FormData();
      formData.set("email", "test@test.com");
      formData.set("name", "Test User");
      formData.set("username", "test");
      formData.set("password", "validpassword1");
      formData.set("confirmPassword", "differentpassword1");
      formData.set("terms", "on");

      await expect(signUpAction(idleState, formData)).resolves.toMatchObject({
        fieldErrors: { confirmPassword: "Passwords do not match." },
        status: "error",
        values: {
          email: "test@test.com",
          name: "Test User",
          username: "test",
        },
      });
      expect(getPrisma).not.toHaveBeenCalled();
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

      await expect(signInAction(idleState, formData)).resolves.toMatchObject({
        message: "The email or password you entered is incorrect.",
        status: "error",
      });
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

      await expect(signInAction(idleState, formData)).resolves.toMatchObject({
        message:
          "This account is deactivated. Contact support if you believe this is a mistake.",
        status: "error",
      });
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

      await expect(signInAction(idleState, formData)).rejects.toThrow(
        "REDIRECT:/app",
      );
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
