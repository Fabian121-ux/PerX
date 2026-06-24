"use server";

import { redirect } from "next/navigation";

import { getPrisma } from "@/lib/db/prisma";
import { hasDatabaseUrl } from "@/lib/env";
import { writeAuditLog } from "@/lib/logging/audit";
import { parseMoneyToMinor } from "@/lib/money";
import { hasCapability } from "@/lib/permissions/capabilities";
import { requireUser } from "@/lib/auth/session";
import { isLocalTestUser } from "@/lib/dev/test-auth";
import { proposalFormSchema } from "@/lib/validation/opportunity";

export async function submitProposalAction(formData: FormData) {
  const user = await requireUser();
  if (isLocalTestUser(user)) redirect("/app/proposals/sent");
  if (!hasCapability(user.roles, "proposal:create")) redirect("/app?error=forbidden");
  if (!hasDatabaseUrl()) redirect("/app/proposals/sent?error=database-not-configured");

  const parsed = proposalFormSchema.safeParse({
    amount: formData.get("amount"),
    deliveryDays: formData.get("deliveryDays"),
    description: formData.get("description"),
    opportunityId: formData.get("opportunityId"),
    revisions: formData.get("revisions"),
  });
  if (!parsed.success) redirect("/app/proposals/sent?error=check-fields");

  const opportunity = await getPrisma().opportunity.findUniqueOrThrow({ where: { id: parsed.data.opportunityId } });
  const amount = parseMoneyToMinor(parsed.data.amount, opportunity.currency);

  const conversation = await getPrisma().conversation.create({
    data: {
      opportunityId: opportunity.id,
      participants: {
        create: [{ userId: user.id }, { userId: opportunity.ownerId }],
      },
    },
  });

  const proposal = await getPrisma().proposal.create({
    data: {
      amountMinor: amount.amountMinor,
      conversationId: conversation.id,
      currency: amount.currency,
      deliveryDays: parsed.data.deliveryDays,
      description: parsed.data.description,
      opportunityId: opportunity.id,
      revisions: parsed.data.revisions,
      senderId: user.id,
      statusHistory: { create: { actorId: user.id, toStatus: "SENT", note: "Proposal submitted." } },
    },
  });

  await writeAuditLog({ actorId: user.id, action: "proposal.submit", entityId: proposal.id, entityType: "proposal" });
  redirect("/app/proposals/sent");
}

export async function acceptProposalAction(formData: FormData) {
  const user = await requireUser();
  if (isLocalTestUser(user)) redirect("/app/deals/deal-1");
  if (!hasCapability(user.roles, "proposal:decide:received")) redirect("/app?error=forbidden");
  if (!hasDatabaseUrl()) redirect("/app/proposals/received?error=database-not-configured");

  const proposalId = String(formData.get("proposalId") ?? "");
  const proposal = await getPrisma().proposal.findUniqueOrThrow({
    include: { milestones: true, opportunity: true },
    where: { id: proposalId },
  });
  if (proposal.opportunity.ownerId !== user.id) redirect("/app?error=forbidden");

  const deal = await getPrisma().$transaction(async (tx) => {
    await tx.proposal.update({
      data: {
        status: "ACCEPTED",
        statusHistory: { create: { actorId: user.id, fromStatus: proposal.status, toStatus: "ACCEPTED" } },
      },
      where: { id: proposal.id },
    });

    return tx.deal.create({
      data: {
        currency: proposal.currency,
        opportunityId: proposal.opportunityId,
        proposalId: proposal.id,
        status: "AWAITING_FUNDING",
        valueMinor: proposal.amountMinor,
        participants: {
          create: [
            { role: "client", userId: proposal.opportunity.ownerId },
            { role: "freelancer", userId: proposal.senderId },
          ],
        },
        milestones: {
          create:
            proposal.milestones.length > 0
              ? proposal.milestones.map((milestone) => ({
                  amountMinor: milestone.amountMinor,
                  currency: proposal.currency,
                  description: milestone.description,
                  title: milestone.title,
                }))
              : [
                  {
                    amountMinor: proposal.amountMinor,
                    currency: proposal.currency,
                    description: "Complete agreed proposal scope.",
                    title: "Project delivery",
                  },
                ],
        },
        statusHistory: {
          create: { actorId: user.id, reason: "Accepted proposal created deal.", toStatus: "AWAITING_FUNDING" },
        },
      },
    });
  });

  await writeAuditLog({ actorId: user.id, action: "proposal.accept", entityId: proposal.id, entityType: "proposal" });
  redirect(`/app/deals/${deal.id}`);
}
