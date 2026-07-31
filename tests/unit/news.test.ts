import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  requireUser: vi.fn(),
  revalidatePath: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireUser: mocks.requireUser,
}));
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    notification: {
      findMany: mocks.findMany,
      updateMany: mocks.updateMany,
    },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { markVisibleNewsAsReadAction } from "@/features/notifications/actions";
import { getNewsForUser } from "@/lib/data/news";

describe("News data and read ownership", () => {
  const now = new Date("2026-07-31T12:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    mocks.requireUser.mockResolvedValue({ id: "current-user" });
    mocks.updateMany.mockResolvedValue({ count: 2 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("queries only current-user BROADCAST notifications backed by sent, unexpired broadcasts", async () => {
    const sentAt = new Date("2026-07-31T10:00:00.000Z");
    mocks.findMany.mockResolvedValue([
      {
        broadcast: {
          actionUrl: null,
          body: "A real announcement",
          expiresAt: null,
          id: "broadcast-1",
          priority: "NORMAL",
          sentAt,
          title: "Official update",
        },
        id: "notification-1",
        readAt: null,
      },
      { broadcast: null, id: "orphan", readAt: null },
      {
        broadcast: {
          actionUrl: null,
          body: "Expired",
          expiresAt: new Date("2026-07-31T11:59:59.000Z"),
          id: "broadcast-expired",
          priority: "NORMAL",
          sentAt,
          title: "Expired update",
        },
        id: "notification-expired",
        readAt: null,
      },
    ]);

    await expect(getNewsForUser("current-user", now)).resolves.toEqual([
      {
        actionUrl: null,
        body: "A real announcement",
        expiresAt: null,
        id: "broadcast-1",
        notificationId: "notification-1",
        priority: "NORMAL",
        readAt: null,
        sentAt,
        title: "Official update",
      },
    ]);
    expect(mocks.findMany).toHaveBeenCalledWith({
      orderBy: [
        { broadcast: { sentAt: "desc" } },
        { createdAt: "desc" },
      ],
      select: {
        broadcast: {
          select: {
            actionUrl: true,
            body: true,
            expiresAt: true,
            id: true,
            priority: true,
            sentAt: true,
            title: true,
          },
        },
        id: true,
        readAt: true,
      },
      where: {
        broadcast: {
          is: {
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            sentAt: { not: null },
          },
        },
        broadcastId: { not: null },
        type: "BROADCAST",
        userId: "current-user",
      },
    });
  });

  it("marks only requested, owned, active News notifications read", async () => {
    await markVisibleNewsAsReadAction([
      "notification-1",
      "notification-1",
      "notification-2",
    ]);

    expect(mocks.updateMany).toHaveBeenCalledWith({
      data: { readAt: now },
      where: {
        broadcast: {
          is: {
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            sentAt: { not: null },
          },
        },
        broadcastId: { not: null },
        id: { in: ["notification-1", "notification-2"] },
        readAt: null,
        type: "BROADCAST",
        userId: "current-user",
      },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/news");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app");
  });
});
