import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  conversationEventFindFirst: vi.fn(),
  conversationParticipantFindUnique: vi.fn(),
  dealFindFirst: vi.fn(),
  messageFindFirst: vi.fn(),
  opportunityFindFirst: vi.fn(),
  userFindFirst: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    conversationParticipant: {
      findUnique: prismaMocks.conversationParticipantFindUnique,
    },
    conversationEvent: {
      findFirst: prismaMocks.conversationEventFindFirst,
    },
    deal: {
      findFirst: prismaMocks.dealFindFirst,
    },
    message: {
      findFirst: prismaMocks.messageFindFirst,
    },
    opportunity: {
      findFirst: prismaMocks.opportunityFindFirst,
    },
    user: {
      findFirst: prismaMocks.userFindFirst,
    },
  }),
}));

import {
  normalizeNotificationActionUrl,
  resolveNotificationAction,
} from "@/lib/notifications/action-url";
import {
  parseExactConversationEventTarget,
  parseExactMessageTarget,
} from "@/lib/messages/entry";
import { hasCapability } from "@/lib/permissions/capabilities";

describe("notification action URLs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts safe relative app paths", () => {
    expect(
      normalizeNotificationActionUrl("/app/messages/clx123?from=notifications"),
    ).toBe("/app/messages/clx123?from=notifications");
    expect(normalizeNotificationActionUrl("/u/goodnews")).toBe("/u/goodnews");
    expect(normalizeNotificationActionUrl("/app/news")).toBe("/app/news");
  });

  it("resolves the official News destination for broadcasts", async () => {
    await expect(
      resolveNotificationAction("user-1", {
        actionUrl: "/app/news",
        type: "BROADCAST",
      }),
    ).resolves.toEqual({
      available: true,
      href: "/app/news",
      label: "View details",
    });
  });

  it("rejects external, protocol-relative, JavaScript, admin, API and malformed paths", () => {
    expect(normalizeNotificationActionUrl("https://example.com")).toBeNull();
    expect(normalizeNotificationActionUrl("//example.com/path")).toBeNull();
    expect(normalizeNotificationActionUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeNotificationActionUrl("/admin/messages")).toBeNull();
    expect(normalizeNotificationActionUrl("/api/health")).toBeNull();
    expect(normalizeNotificationActionUrl("/app/messages\\bad")).toBeNull();
  });

  it("validates exact message destinations for conversation participants", async () => {
    prismaMocks.messageFindFirst.mockResolvedValue({
      conversationId: "conversation-1",
      id: "message-1",
      senderId: "user-2",
    });

    const action = await resolveNotificationAction("user-1", {
      actionUrl: "/app/messages/conversation-1?message=message-1",
      type: "NEW_MESSAGE",
    });

    expect(action).toEqual({
      available: true,
      href: "/app/messages/conversation-1?message=message-1",
      label: "Message",
    });
    expect(prismaMocks.messageFindFirst).toHaveBeenCalledWith({
      select: { conversationId: true, id: true, senderId: true },
      where: {
        conversation: {
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
          status: "ACTIVE",
        },
        conversationId: "conversation-1",
        deletedAt: null,
        id: "message-1",
        sender: {
          conversations: { some: { conversationId: "conversation-1" } },
        },
      },
    });
  });

  it("marks unavailable exact message destinations without exposing the route", async () => {
    prismaMocks.messageFindFirst.mockResolvedValue(null);

    const action = await resolveNotificationAction("user-1", {
      actionUrl: "/app/messages/conversation-1?message=missing-message",
      type: "NEW_MESSAGE",
    });

    expect(action).toEqual({
      available: false,
      href: null,
      label: "This message is no longer available.",
      reason: "unavailable",
    });
  });

  it("rejects general messages route for a message notification", async () => {
    const action = await resolveNotificationAction("user-1", {
      actionUrl: "/app/messages",
      type: "NEW_MESSAGE",
    });

    expect(action).toEqual({
      available: false,
      href: null,
      label: "This message is no longer available.",
      reason: "unavailable",
    });
  });

  it("can derive safe message-request destinations from legacy metadata", async () => {
    prismaMocks.messageFindFirst.mockResolvedValue({
      conversationId: "conversation-1",
      id: "message-1",
      senderId: "user-2",
    });

    const action = await resolveNotificationAction("user-1", {
      actionUrl: null,
      metadata: { conversationId: "conversation-1", messageId: "message-1" },
      type: "MESSAGE_REQUEST_RECEIVED",
    });

    expect(action).toMatchObject({
      available: true,
      href: "/app/messages/conversation-1?message=message-1",
      label: "Message",
    });
  });

  it("can derive safe message destinations from legacy metadata", async () => {
    prismaMocks.messageFindFirst.mockResolvedValue({
      conversationId: "conversation-1",
      id: "message-1",
      senderId: "user-2",
    });

    const action = await resolveNotificationAction("user-1", {
      actionUrl: null,
      metadata: { conversationId: "conversation-1", messageId: "message-1" },
      type: "NEW_MESSAGE",
    });

    expect(action).toMatchObject({
      available: true,
      href: "/app/messages/conversation-1?message=message-1",
      label: "Message",
    });
  });

  it("rejects non-exact message URLs and mismatched notification ownership", async () => {
    prismaMocks.messageFindFirst.mockResolvedValue({
      conversationId: "conversation-1",
      id: "message-1",
      senderId: "user-2",
    });

    await expect(
      resolveNotificationAction("user-1", {
        actionUrl:
          "/app/messages/conversation-1?message=message-1&from=notifications",
        type: "NEW_MESSAGE",
      }),
    ).resolves.toMatchObject({ available: false, reason: "unavailable" });

    await expect(
      resolveNotificationAction("user-1", {
        actionUrl: "/app/messages/conversation-1?message=message-1",
        metadata: {
          conversationId: "conversation-1",
          messageId: "message-1",
          recipientId: "another-user",
          senderId: "user-2",
        },
        type: "NEW_MESSAGE",
      }),
    ).resolves.toMatchObject({ available: false, reason: "unavailable" });
  });

  it("parses only the canonical exact target shape", () => {
    expect(
      parseExactMessageTarget("/app/messages/conversation-1?message=message-1"),
    ).toEqual({
      conversationId: "conversation-1",
      href: "/app/messages/conversation-1?message=message-1",
      messageId: "message-1",
    });
    expect(
      parseExactMessageTarget(
        "/app/messages/conversation-1?message=message-1&message=message-2",
      ),
    ).toBeNull();
    expect(
      parseExactMessageTarget(
        "/app/messages/conversation-1/extra?message=message-1",
      ),
    ).toBeNull();
  });

  it("validates exact proposal and Deal event destinations", async () => {
    prismaMocks.conversationParticipantFindUnique.mockResolvedValue({
      id: "participant-1",
      removedAt: null,
    });
    prismaMocks.conversationEventFindFirst.mockResolvedValue({
      conversationId: "conversation-1",
      dealId: "deal-1",
      id: "event-1",
      proposalVersionId: "version-1",
    });

    await expect(
      resolveNotificationAction("user-1", {
        actionUrl: "/app/messages/conversation-1?event=event-1",
        metadata: {
          conversationEventId: "event-1",
          conversationId: "conversation-1",
          dealId: "deal-1",
          proposalVersionId: "version-1",
          recipientId: "user-1",
        },
        type: "PROPOSAL_UPDATE",
      }),
    ).resolves.toEqual({
      available: true,
      href: "/app/messages/conversation-1?event=event-1",
      label: "Review proposal",
    });
    expect(
      parseExactConversationEventTarget(
        "/app/messages/conversation-1?event=event-1",
      ),
    ).toEqual({
      conversationId: "conversation-1",
      eventId: "event-1",
      href: "/app/messages/conversation-1?event=event-1",
    });
  });

  it("rejects malformed dynamic suffixes instead of navigating to a 404", async () => {
    prismaMocks.dealFindFirst.mockResolvedValue({ id: "deal-1" });

    await expect(
      resolveNotificationAction("user-1", {
        actionUrl: "/app/deals/deal-1/not-a-route",
        type: "DEAL",
      }),
    ).resolves.toMatchObject({ available: false, reason: "unavailable" });
    expect(prismaMocks.dealFindFirst).not.toHaveBeenCalled();
  });

  it("allows a direct Deal destination only for a participant", async () => {
    prismaMocks.dealFindFirst.mockResolvedValue({ id: "deal-1" });

    await expect(
      resolveNotificationAction("user-1", {
        actionUrl: "/app/deals/deal-1",
        type: "DEAL",
      }),
    ).resolves.toEqual({
      available: true,
      href: "/app/deals/deal-1",
      label: "View deal",
    });
    expect(prismaMocks.dealFindFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: {
        id: "deal-1",
        participants: { some: { userId: "user-1" } },
      },
    });
  });

  it("hides event destinations after participant-local chat removal", async () => {
    prismaMocks.conversationEventFindFirst.mockResolvedValue(null);

    await expect(
      resolveNotificationAction("user-1", {
        actionUrl: "/app/messages/conversation-1?event=event-1",
        type: "DEAL_UPDATE",
      }),
    ).resolves.toMatchObject({ available: false, reason: "unavailable" });
    expect(prismaMocks.conversationEventFindFirst).toHaveBeenCalledWith({
      where: {
        conversation: {
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
          status: "ACTIVE",
        },
        conversationId: "conversation-1",
        id: "event-1",
      },
    });
  });
});

describe("broadcast capability", () => {
  it("allows admins to create broadcasts without granting the capability to members", () => {
    expect(hasCapability(["ADMIN"], "broadcasts:create")).toBe(true);
    expect(hasCapability(["MASTER_ADMIN"], "enforcement:manage")).toBe(true);
    expect(hasCapability(["MASTER_ADMIN"], "master:admin")).toBe(true);
    expect(hasCapability(["MEMBER"], "broadcasts:create")).toBe(false);
  });
});
