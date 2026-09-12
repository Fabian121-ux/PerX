import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({ supportTicket: { findFirst: mocks.findFirst } }),
}));

import {
  getSupportTicketDetail,
  SUPPORT_MESSAGE_HISTORY_LIMIT,
} from "@/features/support/data";
import type { RoleName } from "@/lib/permissions/capabilities";

const viewer = { roles: ["MEMBER"] as RoleName[], userId: "user-1" };

describe("support ticket detail data", () => {
  beforeEach(() => vi.clearAllMocks());

  it("restricts ordinary users to tickets they own and bounds message history", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await getSupportTicketDetail({ ...viewer, ticketId: "ticket-1" });

    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          messages: expect.objectContaining({
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: SUPPORT_MESSAGE_HISTORY_LIMIT,
          }),
        }),
        where: { authorId: "user-1", id: "ticket-1" },
      }),
    );
  });

  it("does not expose another user's ticket to an ordinary user", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(
      getSupportTicketDetail({ ...viewer, ticketId: "someone-elses-ticket" }),
    ).resolves.toBeNull();
  });

  it("allows support staff to query by ticket id without impersonating its owner", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await getSupportTicketDetail({
      roles: ["ADMIN"],
      ticketId: "ticket-1",
      userId: "admin-1",
    });

    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "ticket-1" } }),
    );
  });

  it("returns the bounded newest messages in chronological display order", async () => {
    const older = { id: "message-1" };
    const newer = { id: "message-2" };
    mocks.findFirst.mockResolvedValue({
      authorId: "user-1",
      messages: [newer, older],
    });

    const ticket = await getSupportTicketDetail({
      ...viewer,
      ticketId: "ticket-1",
    });

    expect(ticket?.messages).toEqual([older, newer]);
  });
});
