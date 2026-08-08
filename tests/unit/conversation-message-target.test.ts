import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  conversationEventFindFirst: vi.fn(),
  findOwnedConversationEventTarget: vi.fn(),
  findOwnedMessageTarget: vi.fn(),
  getConversationForUser: vi.fn(),
  getConversationMessagesPage: vi.fn(),
  getConversationsPage: vi.fn(),
  getConversations: vi.fn(),
  getCurrentUser: vi.fn(),
  markConversationReadForUser: vi.fn(),
  messageFindFirst: vi.fn(),
  getRequestCorrelationId: vi.fn(),
  logServerDataError: vi.fn(),
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
  getConversationMessagesPage: mocks.getConversationMessagesPage,
  getConversationForUser: mocks.getConversationForUser,
  getConversationsPage: mocks.getConversationsPage,
  getConversations: mocks.getConversations,
}));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    conversationEvent: { findFirst: mocks.conversationEventFindFirst },
    message: { findFirst: mocks.messageFindFirst },
  }),
}));
vi.mock("@/lib/messages/entry", () => ({
  findOwnedConversationEventTarget: mocks.findOwnedConversationEventTarget,
  findOwnedMessageTarget: mocks.findOwnedMessageTarget,
  parseMessageRouteId: (value: unknown) =>
    typeof value === "string" && /^[A-Za-z0-9_-]+$/.test(value) ? value : null,
}));
vi.mock("@/lib/messages/read-state", () => ({
  markConversationReadForUser: mocks.markConversationReadForUser,
}));
vi.mock("@/lib/logging/runtime", () => ({
  getRequestCorrelationId: mocks.getRequestCorrelationId,
  logServerDataError: mocks.logServerDataError,
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
  const events: unknown[] = [];
  return {
    events,
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
      roles: [],
    });
    mocks.getRequestCorrelationId.mockResolvedValue("request-test");
    mocks.markConversationReadForUser.mockResolvedValue(true);
    mocks.getConversationsPage.mockImplementation(async () => ({
      cursor: null,
      items: await mocks.getConversations(),
      nextCursor: null,
      pageSize: 50,
    }));
  });

  it("loads an older owned target outside recent history and passes it to the exact chat", async () => {
    const selected = conversation();
    const olderTarget = message("message-target", "2026-07-01T12:00:00.000Z");
    mocks.getConversations.mockResolvedValue([selected]);
    mocks.getConversationMessagesPage.mockResolvedValue({
      cursor: null,
      items: [message("message-latest", "2026-07-31T12:00:00.000Z")],
      nextCursor: "recent-page-cursor",
      pageSize: 50,
    });
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
      conversations: Array<{ olderMessagesCursor: string | null }>;
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
    expect(props.conversations[0]?.olderMessagesCursor).toBe(
      "recent-page-cursor",
    );
    expect(mocks.markConversationReadForUser).not.toHaveBeenCalled();
    expect(mocks.getConversationsPage).toHaveBeenCalledWith("user-1", {
      pageSize: 50,
    });
    expect(mocks.getConversationMessagesPage).toHaveBeenCalledWith(
      "conversation-1",
      "user-1",
      { pageSize: 50 },
    );
  });

  it("loads an authorized conversation when it is beyond the bounded list page", async () => {
    const selected = conversation();
    mocks.getConversations.mockResolvedValue([]);
    mocks.getConversationForUser.mockResolvedValue(selected);
    mocks.getConversationMessagesPage.mockResolvedValue({
      cursor: null,
      items: selected.messages,
      nextCursor: null,
      pageSize: 50,
    });

    const element = await ConversationPage({
      params: Promise.resolve({ conversationId: "conversation-1" }),
      searchParams: Promise.resolve({}),
    });

    expect(mocks.getConversationForUser).toHaveBeenCalledWith(
      "conversation-1",
      "user-1",
    );
    expect(element.props.defaultConversationId).toBe("conversation-1");
  });

  it("loads and highlights an exact immutable conversation event", async () => {
    const selected = conversation();
    const event = {
      actorId: "user-2",
      conversationId: "conversation-1",
      createdAt: new Date("2026-07-01T12:00:00.000Z"),
      dealId: null,
      id: "event-target",
      idempotencyKey: "proposal:1:submitted",
      proposalVersionId: "version-1",
      snapshot: { schemaVersion: 1, versionNumber: 1 },
      type: "PROPOSAL_SUBMITTED",
    };
    mocks.getConversations.mockResolvedValue([selected]);
    mocks.getConversationMessagesPage.mockResolvedValue({
      cursor: null,
      items: selected.messages,
      nextCursor: null,
      pageSize: 50,
    });
    mocks.findOwnedConversationEventTarget.mockResolvedValue(event);

    const element = await ConversationPage({
      params: Promise.resolve({ conversationId: "conversation-1" }),
      searchParams: Promise.resolve({ event: "event-target" }),
    });
    const props = element.props as {
      highlightEventId: string;
    };

    expect(mocks.findOwnedConversationEventTarget).toHaveBeenCalledWith(
      "user-1",
      { conversationId: "conversation-1", eventId: "event-target" },
    );
    expect(selected.events).toEqual([event]);
    expect(props.highlightEventId).toBe("event-target");
  });

  it("rejects ambiguous message and event targets", async () => {
    mocks.getConversations.mockResolvedValue([conversation()]);

    await expect(
      ConversationPage({
        params: Promise.resolve({ conversationId: "conversation-1" }),
        searchParams: Promise.resolve({
          event: "event-target",
          message: "message-target",
        }),
      }),
    ).rejects.toThrow("NOT_FOUND");
    expect(mocks.findOwnedMessageTarget).not.toHaveBeenCalled();
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
    expect(mocks.getConversationMessagesPage).not.toHaveBeenCalled();
    expect(mocks.markConversationReadForUser).not.toHaveBeenCalled();
  });

  it("rejects duplicate or malformed route targets before querying Prisma", async () => {
    await expect(
      ConversationPage({
        params: Promise.resolve({ conversationId: "conversation-1" }),
        searchParams: Promise.resolve({
          message: ["message-1", "message-2"],
        }),
      }),
    ).rejects.toThrow("NOT_FOUND");

    expect(mocks.getConversations).not.toHaveBeenCalled();
    expect(mocks.findOwnedMessageTarget).not.toHaveBeenCalled();
  });

  it("renders legacy event snapshots and missing optional participant data safely", async () => {
    const selected = conversation();
    selected.participants[1]!.user = null;
    const event = {
      actorId: null,
      conversationId: "conversation-1",
      createdAt: new Date("2026-07-01T12:00:00.000Z"),
      dealId: null,
      id: "event-legacy",
      idempotencyKey: "legacy:null-snapshot",
      proposalVersionId: null,
      snapshot: null,
      type: "DEAL_STATUS_CHANGED",
    };
    selected.events.push(event);
    mocks.getConversations.mockResolvedValue([selected]);
    mocks.getConversationMessagesPage.mockResolvedValue({
      cursor: null,
      items: selected.messages,
      nextCursor: null,
      pageSize: 50,
    });
    mocks.findOwnedConversationEventTarget.mockResolvedValue(event);

    const element = await ConversationPage({
      params: Promise.resolve({ conversationId: "conversation-1" }),
      searchParams: Promise.resolve({ event: "event-legacy" }),
    });
    const props = element.props as {
      conversations: Array<{
        events: Array<{ snapshot: Record<string, unknown> }>;
        participantName: string;
      }>;
    };

    expect(props.conversations[0]?.events[0]?.snapshot).toEqual({});
    expect(props.conversations[0]?.participantName).toBe("Conversation");
  });

  it("does not mark a conversation read during server render", async () => {
    const selected = conversation();
    mocks.getConversations.mockResolvedValue([selected]);
    mocks.getConversationMessagesPage.mockResolvedValue({
      cursor: null,
      items: selected.messages,
      nextCursor: null,
      pageSize: 50,
    });
    const element = await ConversationPage({
      params: Promise.resolve({ conversationId: "conversation-1" }),
      searchParams: Promise.resolve({}),
    });

    expect(element.props.defaultConversationId).toBe("conversation-1");
    expect(mocks.markConversationReadForUser).not.toHaveBeenCalled();
    expect(mocks.logServerDataError).not.toHaveBeenCalled();
  });
});
