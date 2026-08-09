import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  auditLog: { findMany: vi.fn() },
  message: { findMany: vi.fn() },
}));

vi.mock("@/lib/db/prisma", () => ({ getPrisma: () => prisma }));

import { decodeCursor } from "@/lib/data/cursor";
import {
  createMessageMutationBaseline,
  getMessageMutationsAfter,
  validateMessageMutationCursor,
} from "@/lib/messages/mutations";

describe("message mutation cursors", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.message.findMany.mockResolvedValue([]);
  });

  it("binds cursors to one user and conversation", () => {
    const cursor = createMessageMutationBaseline(
      "user-1",
      "conversation-1",
      new Date(Date.now() - 30_000),
    );

    expect(() =>
      validateMessageMutationCursor(cursor, "user-1", "conversation-1"),
    ).not.toThrow();
    expect(() =>
      validateMessageMutationCursor(cursor, "user-2", "conversation-1"),
    ).toThrow("Invalid cursor scope.");
    expect(() =>
      validateMessageMutationCursor(cursor, "user-1", "conversation-2"),
    ).toThrow("Invalid cursor scope.");
  });

  it("rejects stale and future cursors before querying", () => {
    const staleCursor = createMessageMutationBaseline(
      "user-1",
      "conversation-1",
      new Date(Date.now() - 16 * 60_000),
    );
    const futureCursor = createMessageMutationBaseline(
      "user-1",
      "conversation-1",
      new Date(Date.now() + 2 * 60_000),
    );

    expect(() =>
      validateMessageMutationCursor(
        staleCursor,
        "user-1",
        "conversation-1",
      ),
    ).toThrow("Invalid cursor.");
    expect(() =>
      validateMessageMutationCursor(
        futureCursor,
        "user-1",
        "conversation-1",
      ),
    ).toThrow("Invalid cursor.");
  });

  it("starts behind the bounded transaction window and delays the upper watermark", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-08-08T12:00:00.000Z");
    vi.setSystemTime(now);
    const baseline = createMessageMutationBaseline(
      "user-1",
      "conversation-1",
    );

    await getMessageMutationsAfter({
      conversationId: "conversation-1",
      cursor: baseline,
      userId: "user-1",
    });

    expect(decodeCursor(baseline)?.timestamp).toEqual(
      new Date("2026-08-08T11:59:30.000Z"),
    );
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              createdAt: { lte: new Date("2026-08-08T11:59:30.000Z") },
            }),
          ]),
        }),
      }),
    );
  });

  it("picks up a mutation that commits after an earlier empty poll", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-08T12:00:00.000Z"));
    const baseline = createMessageMutationBaseline(
      "user-1",
      "conversation-1",
    );
    const mutationAt = new Date("2026-08-08T11:59:31.000Z");
    prisma.auditLog.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { createdAt: mutationAt, entityId: "message-1", id: "audit-late" },
      ]);
    prisma.message.findMany.mockResolvedValue([
      {
        body: "Late visible edit",
        conversationId: "conversation-1",
        deletedAt: null,
        editedAt: mutationAt,
        id: "message-1",
      },
    ]);

    const emptyPage = await getMessageMutationsAfter({
      conversationId: "conversation-1",
      cursor: baseline,
      userId: "user-1",
    });
    await vi.advanceTimersByTimeAsync(31_000);
    const visiblePage = await getMessageMutationsAfter({
      conversationId: "conversation-1",
      cursor: emptyPage.checkpoint,
      userId: "user-1",
    });

    expect(decodeCursor(emptyPage.checkpoint)).toEqual({
      id: "0",
      scope: "message-mutations:user-1:conversation-1",
      timestamp: new Date("2026-08-08T11:59:30.000Z"),
    });
    expect(visiblePage.items).toEqual([
      expect.objectContaining({
        body: "Late visible edit",
        id: "message-1",
      }),
    ]);
  });

  it("advances completed pages to the safe watermark without replaying them", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T10:01:30.000Z"));
    const baseline = createMessageMutationBaseline(
      "user-1",
      "conversation-1",
      new Date("2026-07-31T10:00:00.000Z"),
    );
    const firstEventAt = new Date("2026-07-31T10:00:30.000Z");
    const secondEventAt = new Date("2026-07-31T10:02:00.000Z");
    prisma.auditLog.findMany
      .mockResolvedValueOnce([
        {
          createdAt: firstEventAt,
          entityId: "message-1",
          id: "audit-1",
        },
      ])
      .mockResolvedValueOnce([
        {
          createdAt: secondEventAt,
          entityId: "message-1",
          id: "audit-2",
        },
      ]);
    prisma.message.findMany
      .mockResolvedValueOnce([
        {
          body: "Edited once",
          conversationId: "conversation-1",
          deletedAt: null,
          editedAt: firstEventAt,
          id: "message-1",
        },
      ])
      .mockResolvedValueOnce([
        {
          body: "Edited twice",
          conversationId: "conversation-1",
          deletedAt: null,
          editedAt: secondEventAt,
          id: "message-1",
        },
      ]);

    const firstPage = await getMessageMutationsAfter({
      conversationId: "conversation-1",
      cursor: baseline,
      userId: "user-1",
    });
    await vi.advanceTimersByTimeAsync(90_000);
    const secondPage = await getMessageMutationsAfter({
      conversationId: "conversation-1",
      cursor: firstPage.checkpoint,
      userId: "user-1",
    });

    expect(decodeCursor(firstPage.checkpoint)).toEqual({
      id: "0",
      scope: "message-mutations:user-1:conversation-1",
      timestamp: new Date("2026-07-31T10:01:00.000Z"),
    });
    expect(secondPage.items).toEqual([
      {
        body: "Edited twice",
        conversationId: "conversation-1",
        deletedAt: null,
        editedAt: secondEventAt.toISOString(),
        id: "message-1",
      },
    ]);
    expect(prisma.auditLog.findMany.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        where: {
          AND: [
            expect.any(Object),
            {
              OR: [
                {
                  createdAt: {
                    gt: new Date("2026-07-31T10:01:00.000Z"),
                  },
                },
                {
                  createdAt: new Date("2026-07-31T10:01:00.000Z"),
                  id: { gt: "0" },
                },
              ],
            },
          ],
        },
      }),
    );
  });

  it("returns only current message state that remains authorized", async () => {
    const baselineAt = new Date(Date.now() - 60_000);
    const mutationAt = new Date(Date.now() - 40_000);
    const baseline = createMessageMutationBaseline(
      "user-1",
      "conversation-1",
      baselineAt,
    );
    prisma.auditLog.findMany.mockResolvedValue([
      {
        createdAt: mutationAt,
        entityId: "message-1",
        id: "audit-1",
      },
    ]);
    prisma.message.findMany.mockResolvedValue([]);

    await expect(
      getMessageMutationsAfter({
        conversationId: "conversation-1",
        cursor: baseline,
        userId: "user-1",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        items: [],
      }),
    );
    expect(prisma.message.findMany).toHaveBeenCalledWith({
      select: {
        body: true,
        conversationId: true,
        deletedAt: true,
        editedAt: true,
        id: true,
      },
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
        id: { in: ["message-1"] },
      },
    });
  });
});
