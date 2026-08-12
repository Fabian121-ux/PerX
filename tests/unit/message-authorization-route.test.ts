import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({ conversation: { findMany: mocks.findMany } }),
}));

import { POST } from "@/app/api/messages/authorization/route";

function authorizationRequest(conversationIds: unknown[]) {
  return new Request("http://localhost/api/messages/authorization", {
    body: JSON.stringify({ conversationIds }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

describe("message authorization route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1" });
    mocks.findMany.mockResolvedValue([{ id: "conversation-1" }]);
  });

  it("returns only participant-authorized IDs with symmetric block checks", async () => {
    const response = await POST(
      authorizationRequest(["conversation-1", "conversation-2"]),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ids: ["conversation-1"] });
    expect(mocks.findMany).toHaveBeenCalledWith({
      select: { id: true },
      take: 200,
      where: expect.objectContaining({
        id: { in: ["conversation-1", "conversation-2"] },
        participants: {
          none: {
            user: {
              OR: [
                { blocksMade: { some: { blockedUserId: "user-1" } } },
                { blocksReceived: { some: { blockerUserId: "user-1" } } },
              ],
            },
          },
          some: { removedAt: null, userId: "user-1" },
        },
      }),
    });
  });

  it("rejects authorization requests above the workspace bound", async () => {
    const response = await POST(
      authorizationRequest(
        Array.from({ length: 201 }, (_, index) => `conversation-${index}`),
      ),
    );

    expect(response.status).toBe(400);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
