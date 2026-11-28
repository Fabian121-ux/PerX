import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(path); },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/env", () => ({
  hasDatabaseUrl: () => true,
  getResolvedDataMode: () => "live",
}));
vi.mock("@/lib/auth/session", () => ({
  requireUser: async () => ({ id: "user-1", username: "jane" }),
}));
vi.mock("@/lib/account/enforcement", () => ({
  assertCanEditProfile: async () => null,
}));
vi.mock("@/lib/logging/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    user: { findUnique: async () => ({ id: "user-1" }) },
    $transaction: mocks.transaction,
  }),
}));

import { updateProfileAction } from "@/features/profiles/actions";

function profileForm() {
  const data = new FormData();
  Object.entries({
    name: "Jane Doe",
    username: "jane",
    headline: "Software developer",
    biography: "Building useful products for founders and small businesses.",
    location: "Lagos",
    profileImageUrl: "",
    skills: "",
    websiteUrl: "",
  }).forEach(([key, value]) => data.set(key, value));
  return data;
}

describe("profile preference preservation (PXR-004)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation((callback) => callback({
      user: { update: vi.fn() },
      profile: { upsert: mocks.upsert, findUnique: async () => null },
    }));
  });

  it("does not overwrite the saved member messaging setting on unrelated edits", async () => {
    await expect(updateProfileAction(profileForm())).rejects.toThrow("/app/profile/edit?success=true");
    const input = mocks.upsert.mock.calls[0]![0];
    expect(input.update).not.toHaveProperty("allowMessagesFromMembers");
    expect(input.create.allowMessagesFromMembers).toBe(false);
  });

  it.each([["on", true], ["off", false]])("honors an explicit %s preference", async (value, expected) => {
    const data = profileForm();
    data.set("allowMessagesFromMembers", String(value));
    await expect(updateProfileAction(data)).rejects.toThrow("/app/profile/edit?success=true");
    expect(mocks.upsert.mock.calls[0]![0].update.allowMessagesFromMembers).toBe(expected);
  });
});
