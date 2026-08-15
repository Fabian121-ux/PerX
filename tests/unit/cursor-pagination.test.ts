import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  conversationFindMany: vi.fn(),
  dealFindMany: vi.fn(),
  messageFindMany: vi.fn(),
  opportunityFindMany: vi.fn(),
  userFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({
    conversation: { findMany: prismaMocks.conversationFindMany },
    deal: { findMany: prismaMocks.dealFindMany },
    message: { findMany: prismaMocks.messageFindMany },
    opportunity: { findMany: prismaMocks.opportunityFindMany },
    user: { findMany: prismaMocks.userFindMany },
  }),
}));

import {
  buildCursorPredicate,
  clampCursorPageSize,
  decodeCursor,
  encodeCursor,
} from "@/lib/data/cursor";
import { prismaProvider } from "@/lib/data/providers/prisma-provider";
import {
  mockProvider,
  resetMockStore,
} from "@/lib/data/providers/mock-provider";

const firstTimestamp = new Date("2026-08-01T12:00:00.000Z");
const secondTimestamp = new Date("2026-08-01T11:00:00.000Z");

function adminUserRow(id: string, createdAt: Date) {
  return {
    _count: { deals: 0, opportunities: 0, reviewsReceived: 0 },
    accountClassification: "PUBLIC_BETA_USER",
    bannedAt: null,
    connectionRequestsRestrictedUntil: null,
    createdAt,
    deactivatedAt: null,
    email: `${id}@example.com`,
    id,
    isActive: true,
    messagingRestrictedUntil: null,
    name: id,
    publishingRestrictedUntil: null,
    roles: [],
    suspendedAt: null,
    suspendedUntil: null,
    username: id,
    verificationStatus: "UNVERIFIED",
  };
}

describe("cursor pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockStore();
  });

  it("round-trips an opaque timestamp and id cursor", () => {
    const encoded = encodeCursor({ id: "row-z", timestamp: firstTimestamp });

    expect(encoded).not.toContain("row-z");
    expect(decodeCursor(encoded)).toEqual({
      id: "row-z",
      timestamp: firstTimestamp,
    });
    expect(decodeCursor("not-a-valid-cursor")).toBeNull();
  });

  it("rejects malformed and cross-user cursor scopes", async () => {
    const cursor = encodeCursor({
      id: "conversation-z",
      scope: "conversations:user-1",
      timestamp: firstTimestamp,
    });

    expect(decodeCursor(cursor)).toEqual({
      id: "conversation-z",
      scope: "conversations:user-1",
      timestamp: firstTimestamp,
    });
    await expect(
      prismaProvider.app.getConversationsPage("user-2", { cursor }),
    ).rejects.toThrow("Invalid cursor scope.");
    await expect(
      prismaProvider.app.getConversationsPage("user-1", {
        cursor: "not-a-valid-cursor",
      }),
    ).rejects.toThrow("Invalid cursor.");
    expect(prismaMocks.conversationFindMany).not.toHaveBeenCalled();
  });

  it("clamps page sizes and exposes a strict timestamp plus id boundary", () => {
    expect(clampCursorPageSize(0)).toBe(1);
    expect(clampCursorPageSize(999)).toBe(50);
    expect(clampCursorPageSize(2.8)).toBe(2);

    expect(
      buildCursorPredicate(
        { id: "row-m", timestamp: firstTimestamp },
        { direction: "desc", field: "updatedAt" },
      ),
    ).toEqual({
      OR: [
        { updatedAt: { lt: firstTimestamp } },
        { updatedAt: firstTimestamp, id: { lt: "row-m" } },
      ],
    });
  });

  it("keeps equal-timestamp conversation pages stable without duplicates", async () => {
    const first = { id: "conversation-z", updatedAt: firstTimestamp };
    const second = { id: "conversation-m", updatedAt: firstTimestamp };
    const third = { id: "conversation-a", updatedAt: secondTimestamp };
    prismaMocks.conversationFindMany
      .mockResolvedValueOnce([first, second])
      .mockResolvedValueOnce([second, third]);

    const firstPage = await prismaProvider.app.getConversationsPage("user-1", {
      pageSize: 1,
    });
    const secondPage = await prismaProvider.app.getConversationsPage("user-1", {
      cursor: firstPage.nextCursor ?? undefined,
      pageSize: 1,
    });

    expect(firstPage.items.map((row: { id: string }) => row.id)).toEqual([
      "conversation-z",
    ]);
    expect(secondPage.items.map((row: { id: string }) => row.id)).toEqual([
      "conversation-m",
    ]);
    expect(
      new Set([
        ...firstPage.items.map((row: { id: string }) => row.id),
        ...secondPage.items.map((row: { id: string }) => row.id),
      ]),
    ).toHaveProperty("size", 2);
    expect(prismaMocks.conversationFindMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 2,
        where: expect.objectContaining({ AND: expect.any(Array) }),
      }),
    );
  });

  it("retains removed-conversation and blocked-participant filters", async () => {
    prismaMocks.conversationFindMany.mockResolvedValue([]);

    await prismaProvider.app.getConversationsPage("user-1", { pageSize: 7 });

    expect(prismaMocks.conversationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 8,
        where: {
          status: "ACTIVE",
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
        },
      }),
    );
  });

  it("returns messages chronologically while paging older rows by timestamp and id", async () => {
    const newest = {
      body: "newest",
      createdAt: firstTimestamp,
      id: "message-z",
    };
    const sameTimestamp = {
      body: "same timestamp",
      createdAt: firstTimestamp,
      id: "message-m",
    };
    const older = {
      body: "older",
      createdAt: secondTimestamp,
      id: "message-a",
    };
    prismaMocks.messageFindMany
      .mockResolvedValueOnce([newest, sameTimestamp, older])
      .mockResolvedValueOnce([older]);

    const firstPage = await prismaProvider.app.getConversationMessagesPage(
      "conversation-1",
      "user-1",
      { pageSize: 2 },
    );
    const secondPage = await prismaProvider.app.getConversationMessagesPage(
      "conversation-1",
      "user-1",
      { cursor: firstPage.nextCursor ?? undefined, pageSize: 2 },
    );

    expect(firstPage.items.map((row: { id: string }) => row.id)).toEqual([
      "message-m",
      "message-z",
    ]);
    expect(secondPage.items.map((row: { id: string }) => row.id)).toEqual([
      "message-a",
    ]);
    expect(prismaMocks.messageFindMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 3,
      }),
    );
    expect(prismaMocks.messageFindMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ AND: expect.any(Array) }),
      }),
    );
  });

  it("collects every bounded opportunity page for the legacy array contract", async () => {
    const rows = Array.from({ length: 51 }, (_, index) => ({
      id: `opportunity-${String(51 - index).padStart(2, "0")}`,
      updatedAt: new Date(firstTimestamp.getTime() - index * 1_000),
    }));
    prismaMocks.opportunityFindMany
      .mockResolvedValueOnce(rows)
      .mockResolvedValueOnce([rows[50]]);

    const opportunities = await prismaProvider.opportunities.getMyOpportunities(
      "user-1",
    );

    expect(opportunities).toHaveLength(51);
    expect(prismaMocks.opportunityFindMany).toHaveBeenCalledTimes(2);
    expect(prismaMocks.opportunityFindMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        take: 51,
        where: expect.objectContaining({ AND: expect.any(Array) }),
      }),
    );
  });

  it("keeps mock conversation and received-proposal access user-scoped", async () => {
    await expect(
      mockProvider.app.getConversationForUser("conv-1", "unrelated-user"),
    ).resolves.toBeNull();
    await expect(
      mockProvider.app.getConversationForUser("conv-1", "maya-client"),
    ).resolves.toMatchObject({ id: "conv-1" });

    const received = await mockProvider.app.getUserProposals(
      "alex-demo",
      "received",
    );
    expect(received.map((proposal: { id: string }) => proposal.id)).toContain(
      "prop-received-1",
    );
  });

  it("bounds admin pages and adds the id tie-breaker", async () => {
    prismaMocks.userFindMany.mockResolvedValue([]);

    const page = await prismaProvider.admin.getAdminListPage("users", {
      pageSize: 999,
    });

    expect(page.pageSize).toBe(50);
    expect(prismaMocks.userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 51,
      }),
    );
  });

  it("reaches older admin users across an equal-timestamp boundary", async () => {
    const newest = adminUserRow("user-z", firstTimestamp);
    const sameTimestamp = adminUserRow("user-m", firstTimestamp);
    const older = adminUserRow("user-a", secondTimestamp);
    prismaMocks.userFindMany
      .mockResolvedValueOnce([newest, sameTimestamp])
      .mockResolvedValueOnce([sameTimestamp, older])
      .mockResolvedValueOnce([older]);

    const firstPage = await prismaProvider.admin.getAdminListPage("users", {
      pageSize: 1,
    });
    const secondPage = await prismaProvider.admin.getAdminListPage("users", {
      cursor: firstPage.nextCursor ?? undefined,
      pageSize: 1,
    });
    const thirdPage = await prismaProvider.admin.getAdminListPage("users", {
      cursor: secondPage.nextCursor ?? undefined,
      pageSize: 1,
    });

    expect(
      [firstPage, secondPage, thirdPage].flatMap((page) =>
        page.items.map((item: { id: string }) => item.id),
      ),
    ).toEqual(["user-z", "user-m", "user-a"]);
    expect(prismaMocks.userFindMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          AND: [
            {},
            {
              OR: [
                { createdAt: { lt: firstTimestamp } },
                { createdAt: firstTimestamp, id: { lt: "user-z" } },
              ],
            },
          ],
        },
      }),
    );
  });

  it("keeps admin deal cursors scoped and ordered by update time", async () => {
    const usersCursor = encodeCursor({
      id: "user-z",
      scope: "admin:users",
      timestamp: firstTimestamp,
    });

    await expect(
      prismaProvider.admin.getAdminListPage("deals", {
        cursor: usersCursor,
      }),
    ).rejects.toThrow("Invalid cursor scope.");
    expect(prismaMocks.dealFindMany).not.toHaveBeenCalled();

    prismaMocks.dealFindMany.mockResolvedValue([]);
    await prismaProvider.admin.getAdminListPage("deals", { pageSize: 4 });

    expect(prismaMocks.dealFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select: expect.objectContaining({
          _count: {
            select: {
              disputes: { where: { status: { not: "RESOLVED" } } },
              milestones: true,
              participants: true,
            },
          },
          participants: expect.objectContaining({
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: 6,
          }),
          settlementMode: true,
        }),
        take: 5,
      }),
    );
  });

  it("selects minimized current-state user summaries and public aggregates", async () => {
    prismaMocks.userFindMany.mockResolvedValue([]);

    await prismaProvider.admin.getAdminUsersPage({ pageSize: 20 });

    const query = prismaMocks.userFindMany.mock.calls[0]?.[0];
    expect(query).toEqual(
      expect.objectContaining({
        select: expect.objectContaining({
          _count: {
            select: {
              deals: {
                where: {
                  deal: { status: { in: ["APPROVED", "RELEASED"] } },
                },
              },
              opportunities: true,
              reviewsReceived: { where: { visibility: "PUBLIC" } },
            },
          },
          bannedAt: true,
          deactivatedAt: true,
          suspendedUntil: true,
        }),
        take: 21,
      }),
    );
    expect(query.select).not.toHaveProperty("passwordHash");
    expect(query.select).not.toHaveProperty("sessions");
    expect(query.select).not.toHaveProperty("enforcementReasonPublic");
  });
});
