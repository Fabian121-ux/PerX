import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertAccountAccessWithClient: vi.fn(),
  assertCanCreateDeal: vi.fn(),
  getCurrentSessionTokenHash: vi.fn(),
  requireUser: vi.fn(),
  revalidatePath: vi.fn(),
  lockUserAccount: vi.fn(),
  lockUserPairs: vi.fn(),
}));
const tx = vi.hoisted(() => ({
  $executeRawUnsafe: vi.fn(),
  conversation: { findFirst: vi.fn(), updateMany: vi.fn() },
  session: { findFirst: vi.fn() },
  blockedUser: { findFirst: vi.fn() },
  opportunity: { findFirst: vi.fn() },
  auditLog: { create: vi.fn() },
}));
const db = vi.hoisted(() => ({
  conversation: { findFirst: vi.fn() },
  blockedUser: { findFirst: vi.fn() },
  opportunity: { findMany: vi.fn() },
  $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/session", () => ({
  getCurrentSessionTokenHash: mocks.getCurrentSessionTokenHash,
  requireUser: mocks.requireUser,
}));
vi.mock("@/lib/account/enforcement", () => ({
  assertAccountAccessWithClient: mocks.assertAccountAccessWithClient,
  assertCanCreateDeal: mocks.assertCanCreateDeal,
}));
vi.mock("@/lib/db/prisma", () => ({ getPrisma: () => db }));
vi.mock("@/lib/network/pair-lock", () => ({
  lockUserAccount: mocks.lockUserAccount,
  lockUserPairs: mocks.lockUserPairs,
}));
vi.mock("@/lib/env", () => ({
  getResolvedDataMode: () => "database",
  hasDatabaseUrl: () => true,
}));

import {
  getChatDealListingsAction,
  linkChatDealListingAction,
} from "@/features/proposals/conversation-listings";

const conversationId = "cl01234567890123456789012";
const opportunityId = "cl01234567890123456789011";
const listing = { id: opportunityId, title: "Verified delivery", currency: "NGN" };
const conversation = {
  opportunityId: null,
  _count: { proposals: 0 },
  participants: [
    { userId: "user-1", removedAt: null },
    { userId: "user-2", removedAt: null },
  ],
};

describe("link approved counterpart listing to ordinary chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({
      id: "user-1", roles: ["FREELANCER"], name: "Buyer",
    });
    mocks.assertCanCreateDeal.mockResolvedValue(null);
    mocks.assertAccountAccessWithClient.mockResolvedValue(null);
    mocks.getCurrentSessionTokenHash.mockResolvedValue("session-hash");
    db.conversation.findFirst.mockResolvedValue(conversation);
    db.blockedUser.findFirst.mockResolvedValue(null);
    db.opportunity.findMany.mockResolvedValue([listing]);
    tx.conversation.findFirst.mockResolvedValue(conversation);
    tx.blockedUser.findFirst.mockResolvedValue(null);
    tx.opportunity.findFirst.mockResolvedValue(listing);
    tx.session.findFirst.mockResolvedValue({ id: "session-1" });
    tx.conversation.updateMany.mockResolvedValue({ count: 1 });
  });

  it("shows only APPROVED PUBLISHED listings of the other participant", async () => {
    const result = await getChatDealListingsAction(conversationId);
    expect(result).toEqual({ listings: [listing] });
    expect(db.opportunity.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { ownerId: "user-2", moderationStatus: "APPROVED", status: "PUBLISHED" },
    }));
  });

  it("persists the link atomically, auditing it and preserving proposal authorization", async () => {
    const result = await linkChatDealListingAction({ conversationId, opportunityId });
    expect(result).toEqual({ success: true, listing });
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      `proposal-offer:${conversationId}`,
    );
    expect(mocks.lockUserAccount).toHaveBeenCalledWith(tx, "user-1");
    expect(mocks.lockUserPairs).toHaveBeenCalledWith(tx, "user-1", ["user-2"]);
    expect(tx.conversation.updateMany).toHaveBeenCalledWith({
      data: { opportunityId },
      where: { id: conversationId, opportunityId: null, status: "ACTIVE" },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "conversation.listing_linked_for_deal",
        metadata: { opportunityId, partnerId: "user-2" },
      }),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/app/messages/${conversationId}`);
  });

  it("refuses blocked chats and does not leak counterpart listings", async () => {
    db.blockedUser.findFirst.mockResolvedValueOnce({ id: "block-1" });
    expect(await getChatDealListingsAction(conversationId)).toEqual({ listings: [] });
    expect(db.opportunity.findMany).not.toHaveBeenCalled();
    tx.blockedUser.findFirst.mockResolvedValueOnce({ id: "block-1" });
    expect(await linkChatDealListingAction({ conversationId, opportunityId })).toEqual({
      error: "This conversation cannot be linked to a listing.",
    });
    expect(tx.conversation.updateMany).not.toHaveBeenCalled();
  });

  it("refuses forged or revoked listing eligibility", async () => {
    tx.opportunity.findFirst.mockResolvedValueOnce(null);
    const result = await linkChatDealListingAction({ conversationId, opportunityId });
    expect(result).toEqual({ error: "This conversation cannot be linked to a listing." });
    expect(tx.opportunity.findFirst).toHaveBeenCalledWith({
      select: { id: true, title: true, currency: true },
      where: {
        id: opportunityId,
        ownerId: "user-2",
        moderationStatus: "APPROVED",
        status: "PUBLISHED",
      },
    });
    expect(tx.conversation.updateMany).not.toHaveBeenCalled();
  });

  it("never retargets a conversation with existing proposals or a different listing", async () => {
    tx.conversation.findFirst.mockResolvedValueOnce({
      ...conversation, _count: { proposals: 1 },
    }).mockResolvedValueOnce({
      ...conversation, opportunityId: "another-listing",
    });
    expect(await linkChatDealListingAction({ conversationId, opportunityId })).toEqual({
      error: "This conversation cannot be linked to a listing.",
    });
    expect(await linkChatDealListingAction({ conversationId, opportunityId })).toEqual({
      error: "This conversation is already linked to another listing.",
    });
    expect(tx.conversation.updateMany).not.toHaveBeenCalled();
  });

  it("requires an active authenticated account and a live session", async () => {
    mocks.requireUser.mockResolvedValueOnce({ id: "user-1", roles: ["MEMBER"] });
    expect(await linkChatDealListingAction({ conversationId, opportunityId })).toEqual({
      error: "Your account cannot create Deal proposals.",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
    tx.session.findFirst.mockResolvedValueOnce(null);
    expect(await linkChatDealListingAction({ conversationId, opportunityId })).toEqual({
      error: "Authentication required.",
    });
    expect(tx.conversation.updateMany).not.toHaveBeenCalled();
  });
});
