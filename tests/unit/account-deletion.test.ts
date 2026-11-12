import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteAccountAction } from "@/features/account/deletion";
import { getCurrentUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { getResolvedDataMode, hasDatabaseUrl } from "@/lib/env";
import { verifyPassword } from "@/lib/auth/password";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/auth/session", () => ({
  destroySession: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getResolvedDataMode: vi.fn(),
  getServerEnv: vi.fn(() => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
    SUPABASE_AVATAR_BUCKET: "profile-images",
    SUPABASE_LISTING_BUCKET: "listing-images",
    SUPABASE_MESSAGE_BUCKET: "message-images",
  })),
  hasDatabaseUrl: vi.fn(),
}));

vi.mock("@/lib/auth/password", () => ({
  hashPassword: vi.fn(async () => "replacement-hash"),
  verifyPassword: vi.fn(),
}));

describe("deleteAccountAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "user_123" } as never);
    vi.mocked(getResolvedDataMode).mockReturnValue("database");
    vi.mocked(hasDatabaseUrl).mockReturnValue(true);
  });

  it("requires the exact DELETE confirmation before reading account data", async () => {
    const form = new FormData();
    form.set("password", "correct-password");
    form.set("confirmation", "delete");

    await expect(deleteAccountAction({ status: "idle" }, form)).resolves.toMatchObject({
      status: "error",
      message: 'Type DELETE exactly to confirm account deletion.',
    });
    expect(getPrisma).not.toHaveBeenCalled();
  });

  it("rejects an incorrect current password without deleting data", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "user_123",
      email: "member@example.com",
      passwordHash: "existing-hash",
      imageStorageKey: null,
      profile: null,
    });
    vi.mocked(getPrisma).mockReturnValue({
      user: { findUnique },
    } as never);
    vi.mocked(verifyPassword).mockResolvedValue(false);
    const fetchSpy = vi.spyOn(global, "fetch");

    const form = new FormData();
    form.set("password", "wrong-password");
    form.set("confirmation", "DELETE");

    await expect(deleteAccountAction({ status: "idle" }, form)).resolves.toMatchObject({
      status: "error",
      message: "The password you entered is incorrect.",
    });
    expect(findUnique).toHaveBeenCalledOnce();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
