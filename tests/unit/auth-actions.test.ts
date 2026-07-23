import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  signUpAction,
  signInAction,
  signOutAction,
} from "@/features/auth/actions";
import { getResolvedDataMode, getSignupConfig, hasDatabaseUrl } from "@/lib/env";
import { getPrisma } from "@/lib/db/prisma";
import * as session from "@/lib/auth/session";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/env", () => ({
  getResolvedDataMode: vi.fn(),
  getSignupConfig: vi.fn(),
  hasDatabaseUrl: vi.fn(),
  isProductionMockModeError: vi.fn(() => false),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  createSession: vi.fn(),
  createSessionRecord: vi.fn(),
  destroySession: vi.fn(),
  getCurrentUser: vi.fn(async () => null),
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
    vi.mocked(getSignupConfig).mockReturnValue({
      maximumUsers: 10,
      mode: "open_beta",
    });
  });

  describe("signUpAction", () => {
    it("redirects to profile setup on mock mode without hitting DB", async () => {
      vi.mocked(getResolvedDataMode).mockReturnValue("mock");
      const formData = new FormData();
      formData.set("email", "test@test.com");
      formData.set("name", "Test User");
      formData.set("username", "test");
      formData.set("password", "validpassword1");
      formData.set("confirmPassword", "validpassword1");
      formData.set("terms", "on");

      await expect(signUpAction(idleState, formData)).rejects.toThrow(
        "REDIRECT:/app/profile/setup?mock=true",
      );
      expect(getPrisma).not.toHaveBeenCalled();
    });

    it("returns a field error when email is already used", async () => {
      vi.mocked(getPrisma).mockReturnValue({
        $transaction: vi.fn((callback) =>
          callback({
            $executeRawUnsafe: vi.fn().mockResolvedValue(1),
            role: {
              upsert: vi.fn(),
            },
            user: {
              count: vi.fn().mockResolvedValue(0),
              findFirst: vi.fn().mockResolvedValue({
                email: "test@test.com",
                username: "other",
              }),
            },
          }),
        ),
        user: {
          findFirst: vi.fn(),
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
        $transaction: vi.fn((callback) =>
          callback({
            $executeRawUnsafe: vi.fn().mockResolvedValue(1),
            role: {
              upsert: vi.fn(),
            },
            user: {
              count: vi.fn().mockResolvedValue(0),
              findFirst: vi.fn().mockResolvedValue({
                email: "other@test.com",
                username: "test",
              }),
            },
          }),
        ),
        user: {
          findFirst: vi.fn(),
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
        $executeRawUnsafe: vi.fn().mockResolvedValue(1),
        role: {
          upsert: vi
            .fn()
            .mockResolvedValueOnce({ id: "role_member" }),
        },
        user: {
          count: vi.fn().mockResolvedValue(0),
          findFirst: vi.fn().mockResolvedValue(null),
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
      formData.set("accountClassification", "INTERNAL_ADMIN");
      formData.set("roles", "ADMIN");

      await expect(signUpAction(idleState, formData)).rejects.toThrow(
        "REDIRECT:/app/profile/setup",
      );
      expect(session.createSessionRecord).toHaveBeenCalledWith("user_1", tx);
      expect(session.setSessionCookie).toHaveBeenCalledWith({
        maxAge: 60,
        name: "perx_session",
        value: "session-token",
      });
      expect(tx.role.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ name: "MEMBER" }),
          where: { name: "MEMBER" },
        }),
      );
      expect(tx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accountClassification: "PUBLIC_BETA_USER",
            roles: { create: [{ roleId: "role_member" }] },
          }),
        }),
      );
    });

    it("rejects registration when signup mode is closed", async () => {
      vi.mocked(getSignupConfig).mockReturnValue({
        maximumUsers: null,
        mode: "closed",
      });
      const formData = new FormData();
      formData.set("email", "test@test.com");

      await expect(signUpAction(idleState, formData)).resolves.toMatchObject({
        message: "Registration is currently closed.",
        status: "error",
      });
      expect(getPrisma).not.toHaveBeenCalled();
    });

    it("rejects registration when open beta capacity is full", async () => {
      vi.mocked(getPrisma).mockReturnValue({
        $transaction: vi.fn((callback) =>
          callback({
            $executeRawUnsafe: vi.fn().mockResolvedValue(1),
            role: {
              upsert: vi.fn(),
            },
            user: {
              count: vi.fn().mockResolvedValue(10),
              findFirst: vi.fn(),
            },
          }),
        ),
      } as never);

      const formData = new FormData();
      formData.set("email", "test@test.com");
      formData.set("name", "Test User");
      formData.set("username", "test");
      formData.set("password", "validpassword1");
      formData.set("confirmPassword", "validpassword1");
      formData.set("terms", "on");

      await expect(signUpAction(idleState, formData)).resolves.toMatchObject({
        message:
          "The current PerX beta group is full. Registration will reopen when more spaces become available.",
        status: "error",
      });
    });

    it("allows explicit public mode without checking beta capacity", async () => {
      vi.mocked(getSignupConfig).mockReturnValue({
        maximumUsers: null,
        mode: "public",
      });
      const tx = {
        $executeRawUnsafe: vi.fn(),
        role: {
          upsert: vi.fn().mockResolvedValueOnce({ id: "role_member" }),
        },
        user: {
          count: vi.fn(),
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "user_1" }),
        },
      };
      vi.mocked(getPrisma).mockReturnValue({
        $transaction: vi.fn((callback) => callback(tx)),
        user: {
          findUnique: vi.fn().mockResolvedValue(null),
          findFirst: vi.fn().mockResolvedValue(null),
        },
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
      expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();
      expect(tx.user.count).not.toHaveBeenCalled();
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

    it("requires terms acceptance before hitting the database", async () => {
      const formData = new FormData();
      formData.set("email", "test@test.com");
      formData.set("name", "Test User");
      formData.set("username", "test");
      formData.set("password", "validpassword1");
      formData.set("confirmPassword", "validpassword1");

      await expect(signUpAction(idleState, formData)).resolves.toMatchObject({
        fieldErrors: { terms: "You must accept the terms to create an account." },
        status: "error",
      });
      expect(getPrisma).not.toHaveBeenCalled();
    });

    it("returns a controlled retry message when the transaction fails", async () => {
      vi.mocked(getPrisma).mockReturnValue({
        $transaction: vi.fn().mockRejectedValue(new Error("database offline")),
      } as never);

      const formData = new FormData();
      formData.set("email", "test@test.com");
      formData.set("name", "Test User");
      formData.set("username", "test");
      formData.set("password", "validpassword1");
      formData.set("confirmPassword", "validpassword1");
      formData.set("terms", "on");

      await expect(signUpAction(idleState, formData)).resolves.toMatchObject({
        message:
          "Account creation is temporarily unavailable. Please try again shortly.",
        status: "error",
      });
      expect(session.setSessionCookie).not.toHaveBeenCalled();
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
