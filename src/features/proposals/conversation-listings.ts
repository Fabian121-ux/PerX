"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentSessionTokenHash, requireUser } from "@/lib/auth/session";
import {
  assertAccountAccessWithClient,
  assertCanCreateDeal,
} from "@/lib/account/enforcement";
import { getPrisma } from "@/lib/db/prisma";
import { getResolvedDataMode, hasDatabaseUrl } from "@/lib/env";
import { lockUserAccount, lockUserPairs } from "@/lib/network/pair-lock";
import { hasCapability } from "@/lib/permissions/capabilities";

/**
 * An ordinary two-person chat can be linked to an already moderated, public
 * listing owned by the other participant. We never create an unreviewed
 * opportunity or bypass the existing versioned-proposal / Deal workflow.
 */
const conversationIdSchema = z.string().cuid();
const linkSchema = z.object({
  conversationId: conversationIdSchema,
  opportunityId: z.string().cuid(),
});

export type ChatDealListing = {
  id: string;
  title: string;
  currency: string;
};

type ListingsResult =
  | { listings: ChatDealListing[] }
  | { error: string };

type LinkResult =
  | { success: true; listing: ChatDealListing }
  | { error: string };

function hasDealPermission(roles: Parameters<typeof hasCapability>[0]) {
  return hasCapability(roles, "proposal:create") &&
    hasCapability(roles, "deal:view:participant");
}

function unavailable() {
  return "This conversation cannot be linked to a listing.";
}

export async function getChatDealListingsAction(
  conversationId: string,
): Promise<ListingsResult> {
  const user = await requireUser();
  if (!hasDealPermission(user.roles)) {
    return { error: "Your account cannot create Deal proposals." };
  }
  if (!conversationIdSchema.safeParse(conversationId).success) {
    return { error: "Invalid conversation." };
  }
  const restriction = await assertCanCreateDeal(user.id);
  if (restriction) return { error: restriction };
  if (getResolvedDataMode() === "mock" || !hasDatabaseUrl()) {
    return { error: "Deal listings are temporarily unavailable." };
  }

  try {
    const db = getPrisma();
    const conversation = await db.conversation.findFirst({
      select: {
        opportunityId: true,
        participants: { select: { userId: true, removedAt: true } },
        _count: { select: { proposals: true } },
      },
      where: {
        id: conversationId,
        status: "ACTIVE",
        participants: { some: { userId: user.id, removedAt: null } },
      },
    });
    if (!conversation ||
      conversation.opportunityId ||
      conversation._count.proposals ||
      conversation.participants.length !== 2 ||
      conversation.participants.some((member) => member.removedAt)) {
      return { listings: [] };
    }
    const partnerId = conversation.participants.find(
      (member) => member.userId !== user.id,
    )?.userId;
    if (!partnerId) return { listings: [] };

    const block = await db.blockedUser.findFirst({
      select: { id: true },
      where: {
        OR: [
          { blockerUserId: user.id, blockedUserId: partnerId },
          { blockerUserId: partnerId, blockedUserId: user.id },
        ],
      },
    });
    if (block) return { listings: [] };

    const listings = await db.opportunity.findMany({
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      select: { id: true, title: true, currency: true },
      take: 20,
      where: {
        ownerId: partnerId,
        moderationStatus: "APPROVED",
        status: "PUBLISHED",
      },
    });
    return { listings };
  } catch {
    return { error: "Unable to load eligible listings. Try again." };
  }
}

export async function linkChatDealListingAction(
  input: { conversationId: string; opportunityId: string },
): Promise<LinkResult> {
  const user = await requireUser();
  if (!hasDealPermission(user.roles)) {
    return { error: "Your account cannot create Deal proposals." };
  }
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) return { error: "Choose a valid listing." };
  const restriction = await assertCanCreateDeal(user.id);
  if (restriction) return { error: restriction };
  if (getResolvedDataMode() === "mock" || !hasDatabaseUrl()) {
    return { error: "Deal listings are temporarily unavailable." };
  }
  const sessionTokenHash = await getCurrentSessionTokenHash();
  if (!sessionTokenHash) return { error: "Authentication required." };

  try {
    const result = await getPrisma().$transaction(async (tx) => {
      // Serialize against submission of proposals and other link attempts.
      await tx.$executeRawUnsafe(
        "SELECT pg_advisory_xact_lock(hashtext($1))",
        `proposal-offer:${parsed.data.conversationId}`,
      );
      const conversation = await tx.conversation.findFirst({
        select: {
          opportunityId: true,
          participants: { select: { userId: true, removedAt: true } },
          _count: { select: { proposals: true } },
        },
        where: {
          id: parsed.data.conversationId,
          status: "ACTIVE",
          participants: { some: { userId: user.id, removedAt: null } },
        },
      });
      if (!conversation ||
        conversation.participants.length !== 2 ||
        conversation.participants.some((member) => member.removedAt)) {
        return { error: unavailable() };
      }
      const partnerId = conversation.participants.find(
        (member) => member.userId !== user.id,
      )?.userId;
      if (!partnerId || conversation._count.proposals !== 0) {
        return { error: unavailable() };
      }
      if (conversation.opportunityId && conversation.opportunityId !== parsed.data.opportunityId) {
        return { error: "This conversation is already linked to another listing." };
      }

      await lockUserAccount(tx, user.id);
      await lockUserPairs(tx, user.id, [partnerId]);

      const [activeSession, block, accountRestriction, listing] = await Promise.all([
        tx.session.findFirst({
          select: { id: true },
          where: {
            expiresAt: { gt: new Date() },
            tokenHash: sessionTokenHash,
            userId: user.id,
          },
        }),
        tx.blockedUser.findFirst({
          select: { id: true },
          where: {
            OR: [
              { blockerUserId: user.id, blockedUserId: partnerId },
              { blockerUserId: partnerId, blockedUserId: user.id },
            ],
          },
        }),
        assertAccountAccessWithClient(tx, user.id, "deal"),
        tx.opportunity.findFirst({
          select: { id: true, title: true, currency: true },
          where: {
            id: parsed.data.opportunityId,
            ownerId: partnerId,
            moderationStatus: "APPROVED",
            status: "PUBLISHED",
          },
        }),
      ]);

      if (!activeSession) return { error: "Authentication required." };
      if (accountRestriction) return { error: accountRestriction };
      if (block || !listing) return { error: unavailable() };

      if (!conversation.opportunityId) {
        const updated = await tx.conversation.updateMany({
          data: { opportunityId: listing.id },
          where: { id: parsed.data.conversationId, opportunityId: null, status: "ACTIVE" },
        });
        if (updated.count !== 1) return { error: unavailable() };
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: "conversation.listing_linked_for_deal",
            entityType: "conversation",
            entityId: parsed.data.conversationId,
            metadata: { opportunityId: listing.id, partnerId },
          },
        });
      }
      return { success: true as const, listing };
    }, { timeout: 30_000 });

    if ("error" in result) return result;
    revalidatePath("/app/messages");
    revalidatePath(`/app/messages/${parsed.data.conversationId}`);
    return result;
  } catch {
    return { error: "Unable to link this listing. Please try again." };
  }
}
