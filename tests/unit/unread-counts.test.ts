import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectionCount: vi.fn(),
  notificationCount: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    $queryRaw: mocks.queryRaw,
    connection: { count: mocks.connectionCount },
    notification: { count: mocks.notificationCount },
  }),
}));

import {
  GENERAL_ACTIVITY_EXCLUDED_NOTIFICATION_TYPES,
  getUnreadCounts,
} from "@/lib/data/unread-counts";

describe("unread count query contract", () => {
  const now = new Date("2026-07-31T12:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    mocks.queryRaw.mockResolvedValue([{ count: 3n }]);
    mocks.connectionCount.mockResolvedValue(4);
    mocks.notificationCount
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(5);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns four distinct database-backed concepts", async () => {
    await expect(getUnreadCounts("user-1")).resolves.toEqual({
      generalActivity: 5,
      pendingConnectionRequests: 4,
      unreadConversations: 3,
      unreadNews: 2,
    });
  });

  it("counts conversations, pending incoming requests, active News, and isolated activity", async () => {
    await getUnreadCounts("user-1");

    const [template, ...parameters] = mocks.queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[],
    ];
    const sql = Array.from(template).join(" ? ");

    expect(sql).toContain('COUNT(DISTINCT cp."conversationId")');
    expect(sql).toContain('c."status" = \'ACTIVE\'');
    expect(sql).toContain('m."senderId" <>');
    expect(parameters).toEqual([
      "user-1",
      "user-1",
      "user-1",
      "user-1",
    ]);
    expect(mocks.connectionCount).toHaveBeenCalledWith({
      where: { receiverId: "user-1", status: "PENDING" },
    });
    expect(mocks.notificationCount).toHaveBeenNthCalledWith(1, {
      where: {
        broadcast: {
          is: {
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            sentAt: { not: null },
          },
        },
        broadcastId: { not: null },
        readAt: null,
        type: "BROADCAST",
        userId: "user-1",
      },
    });
    expect(mocks.notificationCount).toHaveBeenNthCalledWith(2, {
      where: {
        readAt: null,
        type: {
          notIn: [...GENERAL_ACTIVITY_EXCLUDED_NOTIFICATION_TYPES],
        },
        userId: "user-1",
      },
    });
  });
});
