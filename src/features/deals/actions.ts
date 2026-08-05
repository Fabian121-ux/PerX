"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getPrisma } from "@/lib/db/prisma";
import { hasDatabaseUrl, getResolvedDataMode } from "@/lib/env";
import { writeAuditLog } from "@/lib/logging/audit";
import { getDeliveryApprovalDecision } from "@/features/deals/authorization";
import {
  assertEscrowTransition,
  type EscrowState,
} from "@/features/escrow/state-machine";
import { requireUser } from "@/lib/auth/session";
import { assertCanCreateDeal } from "@/lib/account/enforcement";
import { hasCapability } from "@/lib/permissions/capabilities";

const deliverySchema = z.object({
  dealId: z.string().cuid(),
  milestoneId: z.string().cuid(),
  notes: z.string().trim().min(1).max(2000),
  title: z.string().trim().min(1).max(140),
});

const approvalSchema = z.object({
  dealId: z.string().cuid(),
  milestoneId: z.string().cuid(),
});

async function requireDealParticipant(dealId: string, userId: string) {
  const deal = await getPrisma().deal.findUniqueOrThrow({
    include: {
      approvals: true,
      deliveries: true,
      participants: true,
      milestones: true,
      proposal: {
        select: {
          conversationId: true,
          opportunity: { select: { title: true } },
        },
      },
      releases: true,
    },
    where: { id: dealId },
  });
  if (!deal.participants.some((participant) => participant.userId === userId)) {
    redirect("/app?error=forbidden");
  }
  return deal;
}

export async function submitDeliveryAction(formData: FormData) {
  const user = await requireUser();
  if (!hasCapability(user.roles, "deal:transition:participant")) {
    redirect("/app?error=forbidden");
  }
  const accountRestriction = await assertCanCreateDeal(user.id);
  if (accountRestriction) redirect(`/app/deals?error=${encodeURIComponent(accountRestriction)}`);
  if (getResolvedDataMode() === "mock") redirect(`/app/deals/${String(formData.get("dealId") ?? "")}?mock=true`);
  if (!hasDatabaseUrl()) redirect("/app?error=database-not-configured");

  const parsed = deliverySchema.safeParse({
    dealId: formData.get("dealId"),
    milestoneId: formData.get("milestoneId"),
    notes: formData.get("notes"),
    title: formData.get("title"),
  });
  if (!parsed.success) redirect("/app/deals?error=check-delivery-fields");
  const { dealId, milestoneId, notes, title } = parsed.data;
  const deal = await requireDealParticipant(dealId, user.id);
  const participant = deal.participants.find(
    (entry) => entry.userId === user.id,
  );
  if (
    !participant ||
    !["freelancer", "provider", "seller"].includes(
      participant.role.toLocaleLowerCase(),
    )
  ) {
    redirect(`/app/deals/${dealId}/deliveries?error=not-provider`);
  }
  const milestone = deal.milestones.find(
    (entry) => entry.id === milestoneId,
  );
  if (!milestone || milestone.status !== "IN_PROGRESS") {
    redirect(`/app/deals/${dealId}/deliveries?error=milestone-unavailable`);
  }
  const next = assertEscrowTransition(deal.status as EscrowState, "submit");

  await getPrisma().$transaction(async (tx) => {
    const claimedMilestone = await tx.dealMilestone.updateMany({
      data: { status: "SUBMITTED" },
      where: { dealId, id: milestone.id, status: "IN_PROGRESS" },
    });
    const claimedDeal = await tx.deal.updateMany({
      data: { status: next },
      where: { id: dealId, status: deal.status },
    });
    if (!claimedMilestone.count || !claimedDeal.count) {
      throw new Error("Deal or milestone state changed before submission.");
    }
    const delivery = await tx.delivery.create({
      data: {
        dealId,
        milestoneId: milestone.id,
        notes,
        submitterId: user.id,
        title,
      },
    });
    await tx.escrowStatusHistory.create({
      data: {
        actorId: user.id,
        dealId,
        fromStatus: deal.status,
        reason: "Milestone delivery submitted.",
        toStatus: next,
      },
    });
    if (deal.proposal.conversationId) {
      const event = await tx.conversationEvent.create({
        data: {
          actorId: user.id,
          conversationId: deal.proposal.conversationId,
          dealId,
          idempotencyKey: `deal:${dealId}:delivery:${delivery.id}:submitted`,
          proposalVersionId: deal.proposalVersionId,
          snapshot: {
            deliveryId: delivery.id,
            milestoneId: milestone.id,
            schemaVersion: 1,
            title,
          },
          type: "MILESTONE_SUBMITTED",
        },
      });
      await tx.conversationParticipant.updateMany({
        data: { removedAt: null },
        where: { conversationId: deal.proposal.conversationId },
      });
      await tx.notification.createMany({
        data: deal.participants
          .filter((participant) => participant.userId !== user.id)
          .map((participant) => ({
            actionUrl: `/app/messages/${deal.proposal.conversationId}?event=${event.id}`,
            body: `${user.name} submitted a delivery for ${deal.proposal.opportunity.title}.`,
            metadata: {
              conversationEventId: event.id,
              conversationId: deal.proposal.conversationId,
              dealId,
              recipientId: participant.userId,
            },
            title: "Delivery submitted",
            type: "DEAL_UPDATE" as const,
            userId: participant.userId,
          })),
      });
      await tx.conversation.update({
        data: { updatedAt: new Date() },
        where: { id: deal.proposal.conversationId },
      });
    }
    await tx.auditLog.create({
      data: {
        action: "deal.delivery.submit",
        actorId: user.id,
        entityId: dealId,
        entityType: "deal",
        metadata: { deliveryId: delivery.id },
      },
    });
  });
  redirect(`/app/deals/${dealId}`);
}

export async function approveDeliveryAction(formData: FormData) {
  const user = await requireUser();
  if (!hasCapability(user.roles, "deal:transition:participant")) {
    redirect("/app?error=forbidden");
  }
  const accountRestriction = await assertCanCreateDeal(user.id);
  if (accountRestriction) redirect(`/app/deals?error=${encodeURIComponent(accountRestriction)}`);
  if (getResolvedDataMode() === "mock") redirect(`/app/deals/${String(formData.get("dealId") ?? "")}?mock=true`);
  if (!hasDatabaseUrl()) redirect("/app?error=database-not-configured");

  const parsed = approvalSchema.safeParse({
    dealId: formData.get("dealId"),
    milestoneId: formData.get("milestoneId"),
  });
  if (!parsed.success) redirect("/app/deals?error=invalid-approval");
  const { dealId, milestoneId } = parsed.data;
  const deal = await requireDealParticipant(dealId, user.id);
  const milestone = deal.milestones.find((entry) => entry.id === milestoneId);
  const delivery = deal.deliveries.find(
    (entry) =>
      entry.milestoneId === milestoneId && entry.status === "SUBMITTED",
  );
  if (!milestone || milestone.status !== "SUBMITTED" || !delivery) {
    redirect(`/app/deals/${dealId}/deliveries?error=delivery-unavailable`);
  }
  const approvalDecision = getDeliveryApprovalDecision(
    deal,
    user.id,
    milestoneId,
  );
  if (!approvalDecision.allowed) {
    await writeAuditLog({
      actorId: user.id,
      action: "deal.delivery.approve.denied",
      entityId: dealId,
      entityType: "deal",
      metadata: { reason: approvalDecision.reason },
    });
    redirect(`/app/deals/${dealId}/deliveries?error=${approvalDecision.reason}`);
  }

  const reviewState = assertEscrowTransition(
    deal.status as EscrowState,
    "review",
  );
  const approvedState = assertEscrowTransition(reviewState, "approve");
  const simulatedSettlement = deal.settlementMode === "SIMULATED";
  const completedState = simulatedSettlement
    ? assertEscrowTransition(approvedState, "release")
    : approvedState;
  const hasRemainingMilestones = deal.milestones.some(
    (entry) =>
      entry.id !== milestone.id &&
      !["APPROVED", "RELEASED", "CANCELLED"].includes(entry.status),
  );
  const finalState = hasRemainingMilestones
    ? ("IN_PROGRESS" as const)
    : completedState;

  await getPrisma().$transaction(async (tx) => {
    const claimedDeal = await tx.deal.updateMany({
      data: { status: reviewState },
      where: { id: dealId, status: deal.status },
    });
    const claimedMilestone = await tx.dealMilestone.updateMany({
      data: { status: simulatedSettlement ? "RELEASED" : "APPROVED" },
      where: { dealId, id: milestone.id, status: "SUBMITTED" },
    });
    const claimedDelivery = await tx.delivery.updateMany({
      data: { status: "APPROVED" },
      where: { dealId, id: delivery.id, status: "SUBMITTED" },
    });
    if (
      !claimedDeal.count ||
      !claimedMilestone.count ||
      !claimedDelivery.count
    ) {
      throw new Error("Delivery state changed before approval.");
    }
    await tx.approval.create({
      data: {
        actorId: user.id,
        dealId,
        milestoneId: milestone.id,
        note: simulatedSettlement
          ? "Approved in simulated release flow. No real funds are collected or held by PerX."
          : "Delivery approved. Online payment is not active; no release was recorded.",
      },
    });
    if (simulatedSettlement) {
      await tx.release.create({
        data: {
          actorId: user.id,
          amountMinor: milestone.amountMinor,
          currency: deal.currency,
          dealId,
          idempotencyKey: `release:${dealId}:milestone:${milestone.id}`,
          milestoneId: milestone.id,
        },
      });
      await tx.ledgerEntry.create({
        data: {
          amountMinor: milestone.amountMinor,
          currency: deal.currency,
          dealId,
          idempotencyKey: `ledger:release:${dealId}:milestone:${milestone.id}`,
          note: "Simulated release state only. No real funds are collected, held, transferred, or released by PerX.",
          type: "RELEASE",
        },
      });
    }
    const finalizedDeal = await tx.deal.updateMany({
      data: { status: finalState },
      where: { id: dealId, status: reviewState },
    });
    if (!finalizedDeal.count) {
      throw new Error("Deal state changed before approval completed.");
    }
    await tx.escrowStatusHistory.createMany({
      data: [
        {
          actorId: user.id,
          dealId,
          fromStatus: deal.status,
          reason: "Delivery moved to review.",
          toStatus: reviewState,
        },
        ...(hasRemainingMilestones
          ? [
              {
                actorId: user.id,
                dealId,
                fromStatus: reviewState,
                reason:
                  "Milestone approved; remaining milestones continue in progress.",
                toStatus: finalState,
              },
            ]
          : [
              {
                actorId: user.id,
                dealId,
                fromStatus: reviewState,
                reason: "Final milestone approved.",
                toStatus: approvedState,
              },
            ]),
        ...(!hasRemainingMilestones && simulatedSettlement
          ? [
              {
                actorId: user.id,
                dealId,
                fromStatus: approvedState,
                reason:
                  "Simulated release state recorded. No real funds were released.",
                toStatus: finalState,
              },
            ]
          : []),
      ],
    });
    if (deal.proposal.conversationId) {
      const approvalEvent = await tx.conversationEvent.create({
        data: {
          actorId: user.id,
          conversationId: deal.proposal.conversationId,
          dealId,
          idempotencyKey: `deal:${dealId}:milestone:${milestone.id}:approved`,
          proposalVersionId: deal.proposalVersionId,
          snapshot: {
            amountMinor: milestone.amountMinor.toString(),
            currency: deal.currency,
            dealStatus: finalState,
            onlinePaymentActive: false,
            milestoneId: milestone.id,
            schemaVersion: 1,
            settlementMode: deal.settlementMode,
            status: simulatedSettlement ? "RELEASED" : "APPROVED",
          },
          type: "MILESTONE_APPROVED",
        },
      });
      if (simulatedSettlement) {
        await tx.conversationEvent.create({
          data: {
            actorId: user.id,
            conversationId: deal.proposal.conversationId,
            dealId,
            idempotencyKey: `deal:${dealId}:milestone:${milestone.id}:simulated-release`,
            proposalVersionId: deal.proposalVersionId,
            snapshot: {
              amountMinor: milestone.amountMinor.toString(),
              currency: deal.currency,
              milestoneId: milestone.id,
              realFundsReleased: false,
              schemaVersion: 1,
              settlementMode: "SIMULATED",
            },
            type: "SIMULATED_RELEASE_RECORDED",
          },
        });
      }
      await tx.conversationParticipant.updateMany({
        data: { removedAt: null },
        where: { conversationId: deal.proposal.conversationId },
      });
      await tx.notification.createMany({
        data: deal.participants
          .filter((participant) => participant.userId !== user.id)
          .map((participant) => ({
            actionUrl: `/app/messages/${deal.proposal.conversationId}?event=${approvalEvent.id}`,
            body: simulatedSettlement
              ? "Delivery approved and a simulated release state was recorded. No real funds were released."
              : "Delivery approved. Online payment is not active, so no release was recorded.",
            metadata: {
              conversationEventId: approvalEvent.id,
              conversationId: deal.proposal.conversationId,
              dealId,
              recipientId: participant.userId,
            },
            title: "Delivery approved",
            type: "DEAL_UPDATE" as const,
            userId: participant.userId,
          })),
      });
      await tx.conversation.update({
        data: { updatedAt: new Date() },
        where: { id: deal.proposal.conversationId },
      });
    }
    await tx.auditLog.create({
      data: {
        action: "deal.delivery.approve",
        actorId: user.id,
        entityId: dealId,
        entityType: "deal",
        metadata: {
          settlementMode: deal.settlementMode,
          milestoneId: milestone.id,
          simulatedReleaseRecorded: simulatedSettlement,
        },
      },
    });
  });
  redirect(`/app/deals/${dealId}`);
}

export async function createReviewAction(formData: FormData) {
  const user = await requireUser();
  if (!hasCapability(user.roles, "review:create:eligible")) {
    redirect("/app?error=forbidden");
  }
  const accountRestriction = await assertCanCreateDeal(user.id);
  if (accountRestriction) redirect(`/app/deals?error=${encodeURIComponent(accountRestriction)}`);
  if (getResolvedDataMode() === "mock") redirect("/app/reviews?mock=true");
  if (!hasDatabaseUrl()) redirect("/app/reviews?error=database-not-configured");

  const dealId = String(formData.get("dealId") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const rating = Number(formData.get("rating") ?? 0);
  const title = String(formData.get("title") ?? "").slice(0, 120);
  const body = String(formData.get("body") ?? "").slice(0, 1200);
  const deal = await requireDealParticipant(dealId, user.id);
  if (
    !["APPROVED", "RELEASED"].includes(deal.status) ||
    subjectId === user.id ||
    !deal.participants.some((entry) => entry.userId === subjectId)
  ) {
    redirect("/app/reviews?error=not-eligible");
  }

  await getPrisma().review.create({
    data: {
      authorId: user.id,
      body,
      dealId,
      rating: Math.max(1, Math.min(5, rating)),
      subjectId,
      title,
    },
  });

  await writeAuditLog({
    actorId: user.id,
    action: "review.create",
    entityId: dealId,
    entityType: "deal",
  });
  redirect("/app/reviews");
}
