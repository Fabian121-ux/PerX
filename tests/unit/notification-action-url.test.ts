import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
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
import { hasCapability } from "@/lib/permissions/capabilities";

describe("notification action URLs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts safe relative app paths", () => {
    expect(normalizeNotificationActionUrl("/app/messages/clx123?from=notifications")).toBe(
      "/app/messages/clx123?from=notifications",
    );
    expect(normalizeNotificationActionUrl("/u/goodnews")).toBe("/u/goodnews");
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
    prismaMocks.conversationParticipantFindUnique.mockResolvedValue({ id: "participant-1" });
    prismaMocks.messageFindFirst.mockResolvedValue({ id: "message-1" });

    const action = await resolveNotificationAction("user-1", {
      actionUrl: "/app/messages/conversation-1?message=message-1",
      type: "NEW_MESSAGE",
    });

    expect(action).toEqual({
      available: true,
      href: "/app/messages/conversation-1?message=message-1",
      label: "View message",
    });
    expect(prismaMocks.messageFindFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: {
        conversationId: "conversation-1",
        deletedAt: null,
        id: "message-1",
      },
    });
  });

  it("marks unavailable exact message destinations without exposing the route", async () => {
    prismaMocks.conversationParticipantFindUnique.mockResolvedValue({ id: "participant-1" });
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

  it("can derive safe message destinations from legacy metadata", async () => {
    prismaMocks.conversationParticipantFindUnique.mockResolvedValue({ id: "participant-1" });
    prismaMocks.messageFindFirst.mockResolvedValue({ id: "message-1" });

    const action = await resolveNotificationAction("user-1", {
      actionUrl: null,
      metadata: { conversationId: "conversation-1", messageId: "message-1" },
      type: "NEW_MESSAGE",
    });

    expect(action).toMatchObject({
      available: true,
      href: "/app/messages/conversation-1?message=message-1",
      label: "View message",
    });
  });
});

describe("broadcast capability", () => {
  it("allows admins to create broadcasts without granting the capability to members", () => {
    expect(hasCapability(["ADMIN"], "broadcasts:create")).toBe(true);
    expect(hasCapability(["MEMBER"], "broadcasts:create")).toBe(false);
  });
});
