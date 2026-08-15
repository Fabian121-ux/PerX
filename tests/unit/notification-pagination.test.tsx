import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectionFindMany: vi.fn(),
  notificationCount: vi.fn(),
  notificationFindMany: vi.fn(),
  requireUser: vi.fn(),
  resolveNotificationActions: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireUser: mocks.requireUser,
}));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    connection: { findMany: mocks.connectionFindMany },
    notification: {
      count: mocks.notificationCount,
      findMany: mocks.notificationFindMany,
    },
  }),
}));
vi.mock("@/lib/notifications/action-url", () => ({
  resolveNotificationActions: mocks.resolveNotificationActions,
}));
vi.mock("@/features/notifications/actions", () => ({
  markAllNotificationsAsReadAction: vi.fn(),
  markNotificationAsReadAction: vi.fn(),
  markNotificationAsUnreadAction: vi.fn(),
}));
vi.mock("@/features/network/actions", () => ({
  acceptConnectionAction: vi.fn(),
  rejectConnectionAction: vi.fn(),
}));

import NotificationsPage from "@/app/app/notifications/page";
import { encodeCursor } from "@/lib/data/cursor";

describe("notification cursor pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-1" });
    mocks.notificationCount.mockResolvedValue(0);
    mocks.notificationFindMany.mockResolvedValue([]);
    mocks.connectionFindMany.mockResolvedValue([]);
    mocks.resolveNotificationActions.mockResolvedValue(new Map());
  });

  it("retains the selected filter inside the cursor-constrained query", async () => {
    const timestamp = new Date("2026-08-01T12:00:00.000Z");
    const cursor = encodeCursor({
      id: "notification-m",
      scope: "notifications:user-1:messages",
      timestamp,
    });

    await NotificationsPage({
      searchParams: Promise.resolve({ cursor, type: "messages" }),
    });

    expect(mocks.notificationFindMany).toHaveBeenCalledWith({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 51,
      where: {
        AND: [
          {
            type: {
              in: ["MESSAGE", "MESSAGE_REQUEST_RECEIVED", "NEW_MESSAGE"],
            },
            userId: "user-1",
          },
          {
            OR: [
              { createdAt: { lt: timestamp } },
              {
                createdAt: timestamp,
                id: { lt: "notification-m" },
              },
            ],
          },
        ],
      },
    });
  });

  it("rejects a cursor from another notification filter before querying", async () => {
    const cursor = encodeCursor({
      id: "notification-m",
      scope: "notifications:user-1:all",
      timestamp: new Date("2026-08-01T12:00:00.000Z"),
    });

    await expect(
      NotificationsPage({
        searchParams: Promise.resolve({ cursor, type: "messages" }),
      }),
    ).rejects.toThrow("Invalid cursor scope.");
    expect(mocks.notificationFindMany).not.toHaveBeenCalled();
  });
});
