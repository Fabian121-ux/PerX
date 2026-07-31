import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOwnedMessageTarget: vi.fn(),
  getConversationMessages: vi.fn(),
  getConversations: vi.fn(),
  getCurrentUser: vi.fn(),
  markConversationReadForUser: vi.fn(),
  messageFindFirst: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  redirect: vi.fn(),
}));

vi.mock("@/components/messages/message-workspace", () => ({
  MessageWorkspace: vi.fn(() => null),
}));
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));
vi.mock("@/lib/data/app", () => ({
  getConversationMessages: mocks.getConversationMessages,
  getConversations: mocks.getConversations,
}));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({ message: { findFirst: mocks.messageFindFirst } }),
}));
vi.mock("@/lib/messages/entry", () => ({
  findOwnedMessageTarget: mocks.findOwnedMessageTarget,
}));
vi.mock("@/lib/messages/read-state", () => ({
  markConversationReadForUser: mocks.markConversationReadForUser,
}));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));

import ConversationPage from "@/app/app/messages/[conversationId]/page";

function message(id: string, createdAt: string) {
  return {
    body: id,
    createdAt: new Date(createdAt),
    deletedAt: null,
    editedAt: null,
    id,
    readReceipts: [],
    replyTo: null,
    sender: { id: "user-2", name: "Other User", username: "other" },
    senderId: "user-2",
  };
}

function conversation() {
  return {
    id: "conversation-1",
    messages: [message("message-latest", "2026-07-31T12:00:00.000Z")],
    opportunity: null,
    participants: [
      { lastReadAt: null, userId: "user-1", user: null },
      {
        lastReadAt: null,
        userId: "user-2",
        user: {
          imageUrl: null,
          name: "Other User",
          profile: { profileImageUrl: null, showPresence: false },
          sessions: [],
          username: "other",
        },
      },
    ],
    proposals: [],
  };
}

describe("conversation exact message entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({
      id: "user-1",
      name: "Current User",
    });
    mocks.markConversationReadForUser.mockResolvedValue(true);
  });

  it("loads an older owned target outside recent history and passes it to the exact chat", async () => {
    const selected = conversation();
    const olderTarget = message(
      "message-target",
      "2026-07-01T12:00:00.000Z",
    );
    mocks.getConversations.mockResolvedValue([selected]);
    mocks.getConversationMessages.mockResolvedValue([
      message("message-latest", "2026-07-31T12:00:00.000Z"),
    ]);
    mocks.findOwnedMessageTarget.mockResolvedValue({
      conversationId: "conversation-1",
      id: "message-target",
      senderId: "user-2",
    });
    mocks.messageFindFirst.mockResolvedValue(olderTarget);

    const element = await ConversationPage({
      params: Promise.resolve({ conversationId: "conversation-1" }),
      searchParams: Promise.resolve({ message: "message-target" }),
    });
    const props = element.props as {
      defaultConversationId: string;
      highlightMessageId: string;
    };

    expect(mocks.findOwnedMessageTarget).toHaveBeenCalledWith("user-1", {
      conversationId: "conversation-1",
      messageId: "message-target",
    });
    expect(mocks.messageFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          conversationId: "conversation-1",
          deletedAt: null,
          id: "message-target",
        },
      }),
    );
    expect(selected.messages.map((entry) => entry.id)).toEqual([
      "message-target",
      "message-latest",
    ]);
    expect(props).toMatchObject({
      defaultConversationId: "conversation-1",
      highlightMessageId: "message-target",
    });
    expect(mocks.markConversationReadForUser).toHaveBeenCalledWith(
      "conversation-1",
      "user-1",
    );
  });

  it("rejects a target that is not owned by the conversation participant", async () => {
    mocks.getConversations.mockResolvedValue([conversation()]);
    mocks.findOwnedMessageTarget.mockResolvedValue(null);

    await expect(
      ConversationPage({
        params: Promise.resolve({ conversationId: "conversation-1" }),
        searchParams: Promise.resolve({ message: "message-private" }),
      }),
    ).rejects.toThrow("NOT_FOUND");
    expect(mocks.getConversationMessages).not.toHaveBeenCalled();
    expect(mocks.markConversationReadForUser).not.toHaveBeenCalled();
  });
});
