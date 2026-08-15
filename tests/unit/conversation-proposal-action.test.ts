import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertAccountAccessWithClient: vi.fn(),
  assertCanCreateDeal: vi.fn(),
  getCurrentSessionTokenHash: vi.fn(),
  requireUser: vi.fn(),
  revalidatePath: vi.fn(),
}));

const tx = vi.hoisted(() => ({
  $executeRawUnsafe: vi.fn(),
  auditLog: { create: vi.fn() },
  blockedUser: { findFirst: vi.fn() },
  conversation: { findFirst: vi.fn(), update: vi.fn() },
  conversationEvent: { create: vi.fn(), findUnique: vi.fn() },
  conversationParticipant: { updateMany: vi.fn() },
  notification: { create: vi.fn() },
  opportunity: { findFirst: vi.fn() },
  proposal: { create: vi.fn() },
  proposalVersion: { create: vi.fn() },
  session: { findFirst: vi.fn() },
}));

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
}));
vi.mock("@/lib/account/enforcement", () => ({
  assertAccountAccessWithClient: mocks.assertAccountAccessWithClient,
  assertCanCreateDeal: mocks.assertCanCreateDeal,
}));
vi.mock("@/lib/auth/session", () => ({
  getCurrentSessionTokenHash: mocks.getCurrentSessionTokenHash,
  requireUser: mocks.requireUser,
}));
vi.mock("@/lib/db/prisma", () => ({ getPrisma: () => prisma }));
vi.mock("@/lib/env", () => ({
  getResolvedDataMode: () => "database",
  hasDatabaseUrl: () => true,
}));

import { submitConversationProposalAction } from "@/features/proposals/actions";

const conversationId = "cl01234567890123456789012";
const clientRequestId = "123e4567-e89b-42d3-a456-426614174000";
const input = {
  amount: "250000.50",
  clientRequestId,
  conversationId,
  deliveryDays: 14,
  description:
    "Deliver the agreed implementation with tests and documented acceptance criteria.",
  revisions: 2,
};

function eligibleConversation() {
  return {
    id: conversationId,
    opportunity: {
      currency: "NGN",
      id: "opportunity-1",
      moderationStatus: "APPROVED",
      ownerId: "user-2",
      status: "PUBLISHED",
      title: "Keyboard delivery",
    },
    opportunityId: "opportunity-1",
    participants: [{ userId: "user-1" }, { userId: "user-2" }],
    proposals: [],
  };
}

describe("conversation proposal submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({
      id: "user-1",
      name: "Current User",
      roles: ["FREELANCER"],
    });
    mocks.getCurrentSessionTokenHash.mockResolvedValue("session-hash");
    mocks.assertCanCreateDeal.mockResolvedValue(null);
    mocks.assertAccountAccessWithClient.mockResolvedValue(null);
    tx.conversationEvent.findUnique.mockResolvedValue(null);
    tx.conversation.findFirst.mockResolvedValue(eligibleConversation());
    tx.session.findFirst.mockResolvedValue({ id: "session-1" });
    tx.blockedUser.findFirst.mockResolvedValue(null);
    tx.opportunity.findFirst.mockResolvedValue(eligibleConversation().opportunity);
    tx.proposal.create.mockResolvedValue({ id: "proposal-1" });
    tx.proposalVersion.create.mockResolvedValue({
      amountMinor: 25_000_050n,
      createdAt: new Date("2026-08-13T12:00:00.000Z"),
      currency: "NGN",
      deliveryDays: 14,
      description: input.description,
      id: "version-1",
      includedRevisions: 2,
      versionNumber: 1,
    });
    tx.conversationEvent.create.mockResolvedValue({
      actorId: "user-1",
      conversationId,
      createdAt: new Date("2026-08-13T12:00:00.000Z"),
      dealId: null,
      id: "event-1",
      idempotencyKey: `proposal-offer:user-1:${conversationId}:${clientRequestId}`,
      proposalVersionId: "version-1",
      snapshot: {},
      type: "PROPOSAL_SUBMITTED",
    });
  });

  it("creates a locked proposal version and persisted conversation event", async () => {
    await expect(submitConversationProposalAction(input)).resolves.toEqual({
      event: expect.objectContaining({
        id: "event-1",
        proposalHref: "/app/proposals/sent",
        proposalVersionId: "version-1",
        snapshot: expect.objectContaining({
          amountMinor: "25000050",
          currency: "NGN",
          opportunityTitle: "Keyboard delivery",
          versionNumber: 1,
        }),
        type: "PROPOSAL_SUBMITTED",
      }),
      success: true,
    });

    expect(tx.$executeRawUnsafe).toHaveBeenNthCalledWith(
      1,
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      `proposal-offer:${conversationId}`,
    );
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      "account:user-1",
    );
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      "user-1:user-2",
    );
    expect(tx.proposal.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amountMinor: 25_000_050n,
        conversationId,
        currency: "NGN",
        opportunityId: "opportunity-1",
        senderId: "user-1",
        status: "SENT",
      }),
    });
    expect(tx.proposalVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amountMinor: 25_000_050n,
        proposalId: "proposal-1",
        status: "SUBMITTED",
        versionNumber: 1,
      }),
    });
    expect(tx.conversationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId,
        idempotencyKey: `proposal-offer:user-1:${conversationId}:${clientRequestId}`,
        proposalVersionId: "version-1",
        type: "PROPOSAL_SUBMITTED",
      }),
    });
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actionUrl: `/app/messages/${conversationId}?event=event-1`,
        userId: "user-2",
      }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          conversationId,
          source: "conversation_make_deal",
        }),
      }),
    });
  });

  it("returns an idempotent persisted event without duplicating the proposal", async () => {
    tx.conversationEvent.findUnique.mockResolvedValue({
      createdAt: new Date("2026-08-13T12:00:00.000Z"),
      id: "event-existing",
      proposalVersionId: "version-existing",
      snapshot: {
        amountMinor: "25000050",
        currency: "NGN",
        versionNumber: 1,
      },
    });

    const result = await submitConversationProposalAction(input);

    expect(result).toEqual({
      event: expect.objectContaining({
        id: "event-existing",
        proposalVersionId: "version-existing",
      }),
      success: true,
    });
    expect(tx.conversation.findFirst).toHaveBeenCalledTimes(1);
    expect(tx.session.findFirst).toHaveBeenCalledTimes(1);
    expect(tx.blockedUser.findFirst).toHaveBeenCalledTimes(1);
    expect(tx.proposal.create).not.toHaveBeenCalled();
  });

  it("rejects direct chats and owner-mismatched opportunity context", async () => {
    tx.conversation.findFirst
      .mockResolvedValueOnce({
        ...eligibleConversation(),
        opportunity: null,
        opportunityId: null,
      })
      .mockResolvedValueOnce(eligibleConversation());
    tx.opportunity.findFirst.mockResolvedValueOnce(null);

    await expect(submitConversationProposalAction(input)).resolves.toEqual({
      error:
        "Make a Deal is available only for an active opportunity conversation.",
    });
    await expect(
      submitConversationProposalAction({
        ...input,
        clientRequestId: "123e4567-e89b-42d3-a456-426614174001",
      }),
    ).resolves.toEqual({
      error:
        "Make a Deal is available only for an active opportunity conversation.",
    });
    expect(tx.proposal.create).not.toHaveBeenCalled();
  });

  it("rejects a block or account restriction committed before creation", async () => {
    tx.blockedUser.findFirst.mockResolvedValueOnce({ id: "block-1" });

    await expect(submitConversationProposalAction(input)).resolves.toEqual({
      error: "This conversation is unavailable.",
    });
    expect(tx.proposal.create).not.toHaveBeenCalled();

    tx.blockedUser.findFirst.mockResolvedValue(null);
    mocks.assertAccountAccessWithClient.mockResolvedValue(
      "Deal activity is temporarily restricted for this account.",
    );
    await expect(
      submitConversationProposalAction({
        ...input,
        clientRequestId: "123e4567-e89b-42d3-a456-426614174002",
      }),
    ).resolves.toEqual({
      error: "Deal activity is temporarily restricted for this account.",
    });
    expect(tx.proposal.create).not.toHaveBeenCalled();
  });

  it("rejects duplicate active proposal lifecycles and invalid amounts", async () => {
    tx.conversation.findFirst.mockResolvedValueOnce({
      ...eligibleConversation(),
      proposals: [{ deal: null, id: "proposal-existing", status: "SENT" }],
    });

    await expect(submitConversationProposalAction(input)).resolves.toEqual({
      error: "This conversation already has an active proposal.",
      existingProposalHref: "/app/proposals/sent",
    });

    tx.conversation.findFirst.mockResolvedValue(eligibleConversation());
    await expect(
      submitConversationProposalAction({
        ...input,
        amount: "12,000",
        clientRequestId: "123e4567-e89b-42d3-a456-426614174003",
      }),
    ).resolves.toEqual({
      error: "Enter a valid amount with up to two decimal places.",
    });
    expect(tx.proposal.create).not.toHaveBeenCalled();
  });

  it("rejects missing capability or a session revoked before locked checks", async () => {
    mocks.requireUser.mockResolvedValueOnce({
      id: "user-1",
      name: "Current User",
      roles: ["MEMBER"],
    });
    await expect(submitConversationProposalAction(input)).resolves.toEqual({
      error: "You cannot create Deals with this account.",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();

    tx.session.findFirst.mockResolvedValue(null);
    await expect(
      submitConversationProposalAction({
        ...input,
        clientRequestId: "123e4567-e89b-42d3-a456-426614174004",
      }),
    ).resolves.toEqual({ error: "Authentication required." });
    expect(tx.proposal.create).not.toHaveBeenCalled();
  });
});
