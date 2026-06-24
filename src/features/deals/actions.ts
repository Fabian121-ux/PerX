"use server";

import { redirect } from "next/navigation";

import { getPrisma } from "@/lib/db/prisma";
import { hasDatabaseUrl } from "@/lib/env";
import { writeAuditLog } from "@/lib/logging/audit";
import { assertEscrowTransition, type EscrowState } from "@/features/escrow/state-machine";
import { requireUser } from "@/lib/auth/session";
import { isLocalTestUser } from "@/lib/dev/test-auth";

async function requireDealParticipant(dealId: string, userId: string) {
  const deal = await getPrisma().deal.findUniqueOrThrow({
    include: { participants: true, milestones: true },
    where: { id: dealId },
  });
  if (!deal.participants.some((participant) => participant.userId === userId)) {
    redirect("/app?error=forbidden");
  }
  return deal;
}

export async function submitDeliveryAction(formData: FormData) {
  const user = await requireUser();
  if (isLocalTestUser(user)) redirect(`/app/deals/${String(formData.get("dealId") ?? "")}/deliveries`);
  if (!hasDatabaseUrl()) redirect("/app?error=database-not-configured");

  const dealId = String(formData.get("dealId") ?? "");
  const title = String(formData.get("title") ?? "").slice(0, 140);
  const notes = String(formData.get("notes") ?? "").slice(0, 2000);
  const deal = await requireDealParticipant(dealId, user.id);
  const next = assertEscrowTransition(deal.status as EscrowState, "submit");

  await getPrisma().$transaction([
    getPrisma().delivery.create({
      data: {
        dealId,
        milestoneId: deal.milestones[0]?.id,
        notes,
        submitterId: user.id,
        title,
      },
    }),
    getPrisma().deal.update({
      data: {
        status: next,
        statusHistory: {
          create: { actorId: user.id, fromStatus: deal.status, reason: "Milestone delivery submitted.", toStatus: next },
        },
      },
      where: { id: dealId },
    }),
  ]);

  await writeAuditLog({ actorId: user.id, action: "deal.delivery.submit", entityId: dealId, entityType: "deal" });
  redirect(`/app/deals/${dealId}/deliveries`);
}

export async function approveDeliveryAction(formData: FormData) {
  const user = await requireUser();
  if (isLocalTestUser(user)) redirect(`/app/deals/${String(formData.get("dealId") ?? "")}/escrow`);
  if (!hasDatabaseUrl()) redirect("/app?error=database-not-configured");

  const dealId = String(formData.get("dealId") ?? "");
  const deal = await requireDealParticipant(dealId, user.id);
  const reviewState = assertEscrowTransition(deal.status as EscrowState, "review");
  const approvedState = assertEscrowTransition(reviewState, "approve");
  const releasedState = assertEscrowTransition(approvedState, "release");

  await getPrisma().$transaction(async (tx) => {
    await tx.approval.create({ data: { actorId: user.id, dealId, note: "Approved in simulated escrow flow." } });
    await tx.release.create({
      data: {
        actorId: user.id,
        amountMinor: deal.valueMinor,
        currency: deal.currency,
        dealId,
        idempotencyKey: `release:${dealId}:${user.id}`,
      },
    });
    await tx.ledgerEntry.create({
      data: {
        amountMinor: deal.valueMinor,
        currency: deal.currency,
        dealId,
        idempotencyKey: `ledger:release:${dealId}`,
        note: "Simulated provider-independent escrow release.",
        type: "RELEASE",
      },
    });
    await tx.deal.update({
      data: {
        status: releasedState,
        statusHistory: {
          createMany: {
            data: [
              { actorId: user.id, fromStatus: deal.status, reason: "Delivery moved to review.", toStatus: reviewState },
              { actorId: user.id, fromStatus: reviewState, reason: "Delivery approved.", toStatus: approvedState },
              { actorId: user.id, fromStatus: approvedState, reason: "Funds released in simulated escrow.", toStatus: releasedState },
            ],
          },
        },
      },
      where: { id: dealId },
    });
  });

  await writeAuditLog({ actorId: user.id, action: "deal.delivery.approve", entityId: dealId, entityType: "deal" });
  redirect(`/app/deals/${dealId}/escrow`);
}

export async function createReviewAction(formData: FormData) {
  const user = await requireUser();
  if (isLocalTestUser(user)) redirect("/app/reviews");
  if (!hasDatabaseUrl()) redirect("/app/reviews?error=database-not-configured");

  const dealId = String(formData.get("dealId") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const rating = Number(formData.get("rating") ?? 0);
  const title = String(formData.get("title") ?? "").slice(0, 120);
  const body = String(formData.get("body") ?? "").slice(0, 1200);
  const deal = await requireDealParticipant(dealId, user.id);
  if (deal.status !== "RELEASED" || subjectId === user.id || !deal.participants.some((entry) => entry.userId === subjectId)) {
    redirect("/app/reviews?error=not-eligible");
  }

  await getPrisma().review.create({
    data: { authorId: user.id, body, dealId, rating: Math.max(1, Math.min(5, rating)), subjectId, title },
  });

  await writeAuditLog({ actorId: user.id, action: "review.create", entityId: dealId, entityType: "deal" });
  redirect("/app/reviews");
}
