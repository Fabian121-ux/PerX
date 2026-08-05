"use server";

import crypto from "node:crypto";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { assertCanCreateDeal } from "@/lib/account/enforcement";
import { getPrisma } from "@/lib/db/prisma";
import { getResolvedDataMode, hasDatabaseUrl } from "@/lib/env";
import { parseMoneyToMinor } from "@/lib/money";
import { hasCapability } from "@/lib/permissions/capabilities";
import type { RoleName } from "@/lib/permissions/capabilities";
import { proposalFormSchema } from "@/lib/validation/opportunity";

const proposalVersionIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
const objectionSchema = z.object({
  reason: z.string().trim().min(10).max(1200),
  versionId: proposalVersionIdSchema,
});

function requireProposalCreateCapability(roles: RoleName[]) {
  if (!hasCapability(roles, "proposal:create")) {
    redirect("/app?error=forbidden");
  }
}

function requireProposalDecisionCapability(roles: RoleName[]) {
  if (!hasCapability(roles, "proposal:decide:received")) {
    redirect("/app?error=forbidden");
  }
}

function parseProposalForm(formData: FormData) {
  return proposalFormSchema.safeParse({
    amount: formData.get("amount"),
    deliveryDays: formData.get("deliveryDays"),
    description: formData.get("description"),
    opportunityId: formData.get("opportunityId"),
    revisions: formData.get("revisions"),
  });
}

function versionSnapshot(version: {
  amountMinor: bigint;
  currency: string;
  deliveryDays: number;
  description: string;
  includedRevisions: number;
  versionNumber: number;
}, opportunityTitle: string) {
  return {
    amountMinor: version.amountMinor.toString(),
    currency: version.currency,
    deliveryDays: version.deliveryDays,
    description: version.description,
    includedRevisions: version.includedRevisions,
    opportunityTitle,
    schemaVersion: 1,
    versionNumber: version.versionNumber,
  };
}

async function getOpenOpportunity(opportunityId: string, senderId: string) {
  const opportunity = await getPrisma().opportunity.findFirst({
    where: {
      id: opportunityId,
      moderationStatus: "APPROVED",
      ownerId: { not: senderId },
      status: "PUBLISHED",
    },
  });
  if (!opportunity) redirect("/app/discover?error=opportunity-unavailable");
  return opportunity;
}

export async function saveProposalDraftAction(formData: FormData) {
  const user = await requireUser();
  requireProposalCreateCapability(user.roles);
  if (getResolvedDataMode() === "mock") redirect("/app/proposals/sent?mock=true");
  if (!hasDatabaseUrl()) redirect("/app/proposals/sent?error=database-not-configured");

  const parsed = parseProposalForm(formData);
  if (!parsed.success) redirect("/app/proposals/sent?error=check-fields");
  const opportunity = await getOpenOpportunity(parsed.data.opportunityId, user.id);
  const amount = parseMoneyToMinor(parsed.data.amount, opportunity.currency);

  await getPrisma().$transaction(async (tx) => {
    const proposal = await tx.proposal.create({
      data: {
        amountMinor: amount.amountMinor,
        currency: amount.currency,
        deliveryDays: parsed.data.deliveryDays,
        description: parsed.data.description,
        opportunityId: opportunity.id,
        revisions: parsed.data.revisions,
        senderId: user.id,
        status: "DRAFT",
        statusHistory: {
          create: {
            actorId: user.id,
            note: "Proposal draft created.",
            toStatus: "DRAFT",
          },
        },
        versions: {
          create: {
            amountMinor: amount.amountMinor,
            createdById: user.id,
            currency: amount.currency,
            deliveryDays: parsed.data.deliveryDays,
            description: parsed.data.description,
            includedRevisions: parsed.data.revisions,
            status: "DRAFT",
            versionNumber: 1,
          },
        },
      },
    });
    await tx.auditLog.create({
      data: {
        action: "proposal.draft_created",
        actorId: user.id,
        entityId: proposal.id,
        entityType: "proposal",
        metadata: { opportunityId: opportunity.id },
      },
    });
  });

  redirect("/app/proposals/sent?draft=saved");
}

export async function submitProposalAction(formData: FormData) {
  const user = await requireUser();
  requireProposalCreateCapability(user.roles);
  if (getResolvedDataMode() === "mock") redirect("/app/proposals/sent?mock=true");
  if (!hasDatabaseUrl()) redirect("/app/proposals/sent?error=database-not-configured");

  const parsed = parseProposalForm(formData);
  if (!parsed.success) redirect("/app/proposals/sent?error=check-fields");
  const opportunity = await getOpenOpportunity(parsed.data.opportunityId, user.id);
  const amount = parseMoneyToMinor(parsed.data.amount, opportunity.currency);

  const conversationId = await getPrisma().$transaction(async (tx) => {
    const conversation = await tx.conversation.create({
      data: {
        opportunityId: opportunity.id,
        participants: {
          create: [{ userId: user.id }, { userId: opportunity.ownerId }],
        },
      },
    });
    const proposal = await tx.proposal.create({
      data: {
        amountMinor: amount.amountMinor,
        conversationId: conversation.id,
        currency: amount.currency,
        deliveryDays: parsed.data.deliveryDays,
        description: parsed.data.description,
        opportunityId: opportunity.id,
        revisions: parsed.data.revisions,
        senderId: user.id,
        status: "SENT",
        statusHistory: {
          create: {
            actorId: user.id,
            note: "Proposal version 1 submitted.",
            toStatus: "SENT",
          },
        },
      },
    });
    const version = await tx.proposalVersion.create({
      data: {
        amountMinor: amount.amountMinor,
        createdById: user.id,
        currency: amount.currency,
        deliveryDays: parsed.data.deliveryDays,
        description: parsed.data.description,
        includedRevisions: parsed.data.revisions,
        proposalId: proposal.id,
        status: "SUBMITTED",
        submittedAt: new Date(),
        versionNumber: 1,
      },
    });
    const event = await tx.conversationEvent.create({
      data: {
        actorId: user.id,
        conversationId: conversation.id,
        idempotencyKey: `proposal:${proposal.id}:version:1:submitted`,
        proposalVersionId: version.id,
        snapshot: versionSnapshot(version, opportunity.title),
        type: "PROPOSAL_SUBMITTED",
      },
    });
    await tx.conversationParticipant.updateMany({
      data: { removedAt: null },
      where: { conversationId: conversation.id },
    });
    await tx.notification.create({
      data: {
        actionUrl: `/app/messages/${conversation.id}?event=${event.id}`,
        body: `${user.name} submitted version 1 for ${opportunity.title}.`,
        metadata: {
          conversationEventId: event.id,
          conversationId: conversation.id,
          proposalId: proposal.id,
          proposalVersionId: version.id,
          recipientId: opportunity.ownerId,
        },
        title: "Proposal received",
        type: "PROPOSAL",
        userId: opportunity.ownerId,
      },
    });
    await tx.auditLog.create({
      data: {
        action: "proposal.version_submitted",
        actorId: user.id,
        entityId: version.id,
        entityType: "proposal_version",
        metadata: { proposalId: proposal.id, versionNumber: 1 },
      },
    });
    return conversation.id;
  });

  redirect(`/app/messages/${conversationId}`);
}

export async function updateProposalDraftAction(formData: FormData) {
  const user = await requireUser();
  requireProposalCreateCapability(user.roles);
  if (getResolvedDataMode() === "mock") redirect("/app/proposals/sent?mock=true");
  if (!hasDatabaseUrl()) redirect("/app/proposals/sent?error=database-not-configured");

  const versionId = String(formData.get("versionId") ?? "");
  const parsedVersionId = proposalVersionIdSchema.safeParse(versionId);
  const parsed = parseProposalForm(formData);
  if (!parsedVersionId.success || !parsed.success) {
    redirect("/app/proposals/sent?error=check-fields");
  }

  const draft = await getPrisma().proposalVersion.findFirst({
    include: { proposal: { include: { opportunity: true } } },
    where: {
      id: parsedVersionId.data,
      proposal: { senderId: user.id },
      status: "DRAFT",
    },
  });
  if (!draft || draft.proposal.opportunityId !== parsed.data.opportunityId) {
    redirect("/app?error=forbidden");
  }
  if (
    draft.proposal.opportunity.status !== "PUBLISHED" ||
    draft.proposal.opportunity.moderationStatus !== "APPROVED"
  ) {
    redirect("/app/proposals/sent?error=opportunity-unavailable");
  }
  const amount = parseMoneyToMinor(
    parsed.data.amount,
    draft.proposal.opportunity.currency,
  );

  await getPrisma().$transaction(async (tx) => {
    const updatedProposal = await tx.proposal.updateMany({
      data: {
        amountMinor: amount.amountMinor,
        currency: amount.currency,
        deliveryDays: parsed.data.deliveryDays,
        description: parsed.data.description,
        revisions: parsed.data.revisions,
      },
      where: {
        deal: null,
        id: draft.proposalId,
        senderId: user.id,
        status: { in: ["DRAFT", "SENT", "COUNTERED"] },
      },
    });
    if (!updatedProposal.count) {
      throw new Error("Proposal draft is no longer editable.");
    }
    const updatedVersion = await tx.proposalVersion.updateMany({
      data: {
        amountMinor: amount.amountMinor,
        currency: amount.currency,
        deliveryDays: parsed.data.deliveryDays,
        description: parsed.data.description,
        includedRevisions: parsed.data.revisions,
      },
      where: {
        id: draft.id,
        proposal: { deal: null, senderId: user.id },
        status: "DRAFT",
      },
    });
    if (!updatedVersion.count) {
      throw new Error("Proposal draft is no longer editable.");
    }
    await tx.auditLog.create({
      data: {
        action: "proposal.draft_updated",
        actorId: user.id,
        entityId: draft.id,
        entityType: "proposal_version",
        metadata: { proposalId: draft.proposalId },
      },
    });
  });

  redirect("/app/proposals/sent?draft=updated");
}

export async function deleteProposalDraftAction(formData: FormData) {
  const user = await requireUser();
  requireProposalCreateCapability(user.roles);
  if (getResolvedDataMode() === "mock") redirect("/app/proposals/sent?mock=true");
  if (!hasDatabaseUrl()) redirect("/app/proposals/sent?error=database-not-configured");

  const parsed = proposalVersionIdSchema.safeParse(formData.get("versionId"));
  if (!parsed.success) redirect("/app/proposals/sent?error=invalid-draft");
  const draft = await getPrisma().proposalVersion.findFirst({
    include: { proposal: { include: { deal: true } } },
    where: {
      id: parsed.data,
      proposal: { deal: null, senderId: user.id },
      status: "DRAFT",
    },
  });
  if (!draft || draft.proposal.deal) redirect("/app?error=forbidden");

  await getPrisma().$transaction(async (tx) => {
    if (draft.proposal.status === "DRAFT") {
      const deleted = await tx.proposal.deleteMany({
        where: {
          deal: null,
          id: draft.proposalId,
          senderId: user.id,
          status: "DRAFT",
        },
      });
      if (!deleted.count) {
        throw new Error("Proposal draft is no longer deletable.");
      }
    } else {
      const deleted = await tx.proposalVersion.deleteMany({
        where: {
          id: draft.id,
          proposal: { deal: null, senderId: user.id },
          status: "DRAFT",
        },
      });
      if (!deleted.count) {
        throw new Error("Proposal draft is no longer deletable.");
      }
    }
    await tx.auditLog.create({
      data: {
        action: "proposal.draft_deleted",
        actorId: user.id,
        entityId: draft.id,
        entityType: "proposal_version",
        metadata: { proposalId: draft.proposalId },
      },
    });
  });

  redirect("/app/proposals/sent?draft=deleted");
}

export async function submitProposalDraftAction(formData: FormData) {
  const user = await requireUser();
  requireProposalCreateCapability(user.roles);
  if (getResolvedDataMode() === "mock") redirect("/app/proposals/sent?mock=true");
  if (!hasDatabaseUrl()) redirect("/app/proposals/sent?error=database-not-configured");

  const parsedVersionId = proposalVersionIdSchema.safeParse(
    formData.get("versionId"),
  );
  const parsed = parseProposalForm(formData);
  if (!parsedVersionId.success || !parsed.success) {
    redirect("/app/proposals/sent?error=check-fields");
  }
  const draft = await getPrisma().proposalVersion.findFirst({
    include: {
      milestones: { orderBy: { position: "asc" } },
      proposal: { include: { opportunity: true } },
      supersedes: true,
    },
    where: {
      id: parsedVersionId.data,
      proposal: {
        deal: null,
        senderId: user.id,
        status: { in: ["DRAFT", "SENT", "COUNTERED"] },
      },
      status: "DRAFT",
    },
  });
  if (
    !draft ||
    draft.proposal.opportunityId !== parsed.data.opportunityId
  ) {
    redirect("/app?error=forbidden");
  }
  if (
    draft.proposal.opportunity.status !== "PUBLISHED" ||
    draft.proposal.opportunity.moderationStatus !== "APPROVED"
  ) {
    redirect("/app/proposals/sent?error=opportunity-unavailable");
  }
  const amount = parseMoneyToMinor(
    parsed.data.amount,
    draft.proposal.opportunity.currency,
  );

  const conversationId = await getPrisma().$transaction(async (tx) => {
    const conversation = draft.proposal.conversationId
      ? { id: draft.proposal.conversationId }
      : await tx.conversation.create({
          data: {
            opportunityId: draft.proposal.opportunityId,
            participants: {
              create: [
                { userId: user.id },
                { userId: draft.proposal.opportunity.ownerId },
              ],
            },
          },
          select: { id: true },
        });
    const claimedProposal = await tx.proposal.updateMany({
      data: {
        amountMinor: amount.amountMinor,
        conversationId: conversation.id,
        currency: amount.currency,
        deliveryDays: parsed.data.deliveryDays,
        description: parsed.data.description,
        revisions: parsed.data.revisions,
        status: "SENT",
      },
      where: {
        deal: null,
        id: draft.proposalId,
        senderId: user.id,
        status: { in: ["DRAFT", "SENT", "COUNTERED"] },
      },
    });
    if (!claimedProposal.count) {
      throw new Error("Proposal is no longer available for submission.");
    }
    await tx.proposalVersion.updateMany({
      data: { status: "SUPERSEDED" },
      where: {
        id: { not: draft.id },
        proposalId: draft.proposalId,
        status: "SUBMITTED",
      },
    });
    const claimedVersion = await tx.proposalVersion.updateMany({
      data: {
        amountMinor: amount.amountMinor,
        currency: amount.currency,
        deliveryDays: parsed.data.deliveryDays,
        description: parsed.data.description,
        includedRevisions: parsed.data.revisions,
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
      where: {
        id: draft.id,
        proposal: { deal: null, senderId: user.id },
        status: "DRAFT",
      },
    });
    if (!claimedVersion.count) {
      throw new Error("Proposal draft is no longer editable.");
    }
    const submittedVersion = await tx.proposalVersion.findUniqueOrThrow({
      where: { id: draft.id },
    });
    await tx.proposalStatusHistory.create({
      data: {
        actorId: user.id,
        fromStatus: draft.proposal.status,
        note: `Proposal version ${draft.versionNumber} submitted.`,
        proposalId: draft.proposalId,
        toStatus: "SENT",
      },
    });
    const event = await tx.conversationEvent.create({
      data: {
        actorId: user.id,
        conversationId: conversation.id,
        idempotencyKey: `proposal:${draft.proposalId}:version:${draft.versionNumber}:submitted`,
        proposalVersionId: draft.id,
        snapshot: versionSnapshot(
          submittedVersion,
          draft.proposal.opportunity.title,
        ),
        type: draft.supersedesVersionId
          ? "PROPOSAL_REVISION_SUBMITTED"
          : "PROPOSAL_SUBMITTED",
      },
    });
    await tx.conversationParticipant.updateMany({
      data: { removedAt: null },
      where: { conversationId: conversation.id },
    });
    await tx.notification.create({
      data: {
        actionUrl: `/app/messages/${conversation.id}?event=${event.id}`,
        body: `${user.name} submitted version ${draft.versionNumber} for ${draft.proposal.opportunity.title}.`,
        metadata: {
          conversationEventId: event.id,
          conversationId: conversation.id,
          proposalId: draft.proposalId,
          proposalVersionId: draft.id,
          recipientId: draft.proposal.opportunity.ownerId,
        },
        title: draft.supersedesVersionId ? "Proposal revised" : "Proposal received",
        type: "PROPOSAL_UPDATE",
        userId: draft.proposal.opportunity.ownerId,
      },
    });
    await tx.auditLog.create({
      data: {
        action: "proposal.version_submitted",
        actorId: user.id,
        entityId: draft.id,
        entityType: "proposal_version",
        metadata: {
          proposalId: draft.proposalId,
          versionNumber: draft.versionNumber,
        },
      },
    });
    await tx.conversation.update({
      data: { updatedAt: new Date() },
      where: { id: conversation.id },
    });
    return conversation.id;
  });

  redirect(`/app/messages/${conversationId}`);
}

export async function raiseProposalObjectionAction(formData: FormData) {
  const user = await requireUser();
  requireProposalDecisionCapability(user.roles);
  if (getResolvedDataMode() === "mock") redirect("/app/proposals/received?mock=true");
  if (!hasDatabaseUrl()) redirect("/app/proposals/received?error=database-not-configured");

  const parsed = objectionSchema.safeParse({
    reason: formData.get("reason"),
    versionId: formData.get("versionId"),
  });
  if (!parsed.success) redirect("/app/proposals/received?error=check-objection");
  const version = await getPrisma().proposalVersion.findFirst({
    include: { proposal: { include: { opportunity: true } } },
    where: { id: parsed.data.versionId, status: "SUBMITTED" },
  });
  if (
    !version ||
    version.proposal.opportunity.ownerId !== user.id ||
    !version.proposal.conversationId
  ) {
    redirect("/app?error=forbidden");
  }

  await getPrisma().$transaction(async (tx) => {
    const claimed = await tx.proposal.updateMany({
      data: { status: "COUNTERED" },
      where: {
        deal: null,
        id: version.proposalId,
        opportunity: { ownerId: user.id },
        status: { in: ["SENT", "COUNTERED"] },
        versions: {
          some: { id: version.id, status: "SUBMITTED" },
        },
      },
    });
    if (!claimed.count) {
      throw new Error("Proposal version is no longer open for objections.");
    }
    await tx.proposalStatusHistory.create({
      data: {
        actorId: user.id,
        fromStatus: version.proposal.status,
        note: `Objection raised against version ${version.versionNumber}.`,
        proposalId: version.proposalId,
        toStatus: "COUNTERED",
      },
    });
    const event = await tx.conversationEvent.create({
      data: {
        actorId: user.id,
        conversationId: version.proposal.conversationId!,
        idempotencyKey: `proposal:${version.proposalId}:objection:${crypto.randomUUID()}`,
        proposalVersionId: version.id,
        snapshot: {
          reason: parsed.data.reason,
          schemaVersion: 1,
          versionNumber: version.versionNumber,
        },
        type: "PROPOSAL_OBJECTION_RAISED",
      },
    });
    await tx.conversationParticipant.updateMany({
      data: { removedAt: null },
      where: { conversationId: version.proposal.conversationId! },
    });
    await tx.notification.create({
      data: {
        actionUrl: `/app/messages/${version.proposal.conversationId}?event=${event.id}`,
        body: `An objection was raised against proposal version ${version.versionNumber}.`,
        metadata: {
          conversationEventId: event.id,
          conversationId: version.proposal.conversationId,
          proposalId: version.proposalId,
          proposalVersionId: version.id,
          recipientId: version.proposal.senderId,
        },
        title: "Proposal needs revision",
        type: "PROPOSAL_UPDATE",
        userId: version.proposal.senderId,
      },
    });
    await tx.auditLog.create({
      data: {
        action: "proposal.objection_raised",
        actorId: user.id,
        entityId: version.id,
        entityType: "proposal_version",
        metadata: { proposalId: version.proposalId },
      },
    });
    await tx.conversation.update({
      data: { updatedAt: new Date() },
      where: { id: version.proposal.conversationId! },
    });
  });

  redirect(`/app/messages/${version.proposal.conversationId}`);
}

export async function createProposalRevisionAction(formData: FormData) {
  const user = await requireUser();
  requireProposalCreateCapability(user.roles);
  if (getResolvedDataMode() === "mock") redirect("/app/proposals/sent?mock=true");
  if (!hasDatabaseUrl()) redirect("/app/proposals/sent?error=database-not-configured");

  const parsed = proposalVersionIdSchema.safeParse(formData.get("versionId"));
  if (!parsed.success) redirect("/app/proposals/sent?error=invalid-version");
  const source = await getPrisma().proposalVersion.findFirst({
    include: { milestones: { orderBy: { position: "asc" } }, proposal: true },
    where: {
      id: parsed.data,
      proposal: { senderId: user.id },
      status: "SUBMITTED",
    },
  });
  if (
    !source ||
    !["SENT", "COUNTERED"].includes(source.proposal.status)
  ) {
    redirect("/app?error=forbidden");
  }

  const existingDraft = await getPrisma().proposalVersion.findFirst({
    select: { id: true },
    where: { proposalId: source.proposalId, status: "DRAFT" },
  });
  if (existingDraft) redirect("/app/proposals/sent?error=draft-exists");
  await getPrisma().$transaction(async (tx) => {
    const claimed = await tx.proposal.updateMany({
      data: { updatedAt: new Date() },
      where: {
        deal: null,
        id: source.proposalId,
        senderId: user.id,
        status: { in: ["SENT", "COUNTERED"] },
        versions: { some: { id: source.id, status: "SUBMITTED" } },
      },
    });
    if (!claimed.count) {
      throw new Error("Proposal version is no longer available for revision.");
    }
    const latest = await tx.proposalVersion.aggregate({
      _max: { versionNumber: true },
      where: { proposalId: source.proposalId },
    });
    const revision = await tx.proposalVersion.create({
      data: {
        amountMinor: source.amountMinor,
        createdById: user.id,
        currency: source.currency,
        deliveryDays: source.deliveryDays,
        description: source.description,
        includedRevisions: source.includedRevisions,
        milestones: {
          create: source.milestones.map((milestone) => ({
            amountMinor: milestone.amountMinor,
            description: milestone.description,
            dueInDays: milestone.dueInDays,
            position: milestone.position,
            title: milestone.title,
          })),
        },
        proposalId: source.proposalId,
        status: "DRAFT",
        supersedesVersionId: source.id,
        versionNumber: (latest._max.versionNumber ?? source.versionNumber) + 1,
      },
    });
    await tx.auditLog.create({
      data: {
        action: "proposal.revision_draft_created",
        actorId: user.id,
        entityId: revision.id,
        entityType: "proposal_version",
        metadata: {
          proposalId: source.proposalId,
          supersedesVersionId: source.id,
        },
      },
    });
  });

  redirect("/app/proposals/sent?draft=revision-created");
}

export async function rejectProposalAction(formData: FormData) {
  const user = await requireUser();
  requireProposalDecisionCapability(user.roles);
  if (getResolvedDataMode() === "mock") redirect("/app/proposals/received?mock=true");
  if (!hasDatabaseUrl()) redirect("/app/proposals/received?error=database-not-configured");

  const parsed = proposalVersionIdSchema.safeParse(formData.get("versionId"));
  if (!parsed.success) redirect("/app/proposals/received?error=invalid-version");
  const version = await getPrisma().proposalVersion.findFirst({
    include: { proposal: { include: { opportunity: true } } },
    where: { id: parsed.data, status: "SUBMITTED" },
  });
  if (
    !version ||
    version.proposal.opportunity.ownerId !== user.id ||
    !version.proposal.conversationId
  ) {
    redirect("/app?error=forbidden");
  }

  await getPrisma().$transaction(async (tx) => {
    const claimedProposal = await tx.proposal.updateMany({
      data: { status: "REJECTED" },
      where: {
        deal: null,
        id: version.proposalId,
        opportunity: { ownerId: user.id },
        status: { in: ["SENT", "COUNTERED"] },
        versions: { some: { id: version.id, status: "SUBMITTED" } },
      },
    });
    if (!claimedProposal.count) {
      throw new Error("Proposal version is no longer available.");
    }
    const claimedVersion = await tx.proposalVersion.updateMany({
      data: { status: "REJECTED" },
      where: { id: version.id, status: "SUBMITTED" },
    });
    if (!claimedVersion.count) {
      throw new Error("Proposal version is no longer available.");
    }
    await tx.proposalVersion.updateMany({
      data: { status: "WITHDRAWN" },
      where: {
        id: { not: version.id },
        proposalId: version.proposalId,
        status: "DRAFT",
      },
    });
    await tx.proposalVersion.updateMany({
      data: { status: "SUPERSEDED" },
      where: {
        id: { not: version.id },
        proposalId: version.proposalId,
        status: "SUBMITTED",
      },
    });
    await tx.proposalStatusHistory.create({
      data: {
        actorId: user.id,
        fromStatus: version.proposal.status,
        note: `Proposal version ${version.versionNumber} rejected.`,
        proposalId: version.proposalId,
        toStatus: "REJECTED",
      },
    });
    const event = await tx.conversationEvent.create({
      data: {
        actorId: user.id,
        conversationId: version.proposal.conversationId!,
        idempotencyKey: `proposal:${version.proposalId}:version:${version.versionNumber}:rejected`,
        proposalVersionId: version.id,
        snapshot: {
          schemaVersion: 1,
          versionNumber: version.versionNumber,
        },
        type: "PROPOSAL_REJECTED",
      },
    });
    await tx.conversationParticipant.updateMany({
      data: { removedAt: null },
      where: { conversationId: version.proposal.conversationId! },
    });
    await tx.notification.create({
      data: {
        actionUrl: `/app/messages/${version.proposal.conversationId}?event=${event.id}`,
        body: `Proposal version ${version.versionNumber} was not accepted.`,
        metadata: {
          conversationEventId: event.id,
          conversationId: version.proposal.conversationId,
          proposalId: version.proposalId,
          proposalVersionId: version.id,
          recipientId: version.proposal.senderId,
        },
        title: "Proposal rejected",
        type: "PROPOSAL_UPDATE",
        userId: version.proposal.senderId,
      },
    });
    await tx.auditLog.create({
      data: {
        action: "proposal.version_rejected",
        actorId: user.id,
        entityId: version.id,
        entityType: "proposal_version",
        metadata: { proposalId: version.proposalId },
      },
    });
  });

  redirect(`/app/messages/${version.proposal.conversationId}`);
}

export async function acceptProposalAction(formData: FormData) {
  const user = await requireUser();
  requireProposalDecisionCapability(user.roles);
  const accountRestriction = await assertCanCreateDeal(user.id);
  if (accountRestriction) throw new Error(accountRestriction);
  if (getResolvedDataMode() === "mock") redirect("/app/deals/mock-deal-1?mock=true");
  if (!hasDatabaseUrl()) redirect("/app/proposals/received?error=database-not-configured");

  const parsed = proposalVersionIdSchema.safeParse(formData.get("versionId"));
  if (!parsed.success) redirect("/app/proposals/received?error=invalid-version");
  const version = await getPrisma().proposalVersion.findFirst({
    include: {
      milestones: { orderBy: { position: "asc" } },
      proposal: { include: { deal: true, opportunity: true } },
    },
    where: { id: parsed.data, status: "SUBMITTED" },
  });
  if (
    !version ||
    version.proposal.deal ||
    version.proposal.opportunity.ownerId !== user.id ||
    !version.proposal.conversationId
  ) {
    redirect("/app?error=forbidden");
  }

  const deal = await getPrisma().$transaction(async (tx) => {
    const claimedProposal = await tx.proposal.updateMany({
      data: { status: "ACCEPTED" },
      where: {
        deal: null,
        id: version.proposalId,
        opportunity: { ownerId: user.id },
        status: { in: ["SENT", "COUNTERED"] },
        versions: { some: { id: version.id, status: "SUBMITTED" } },
      },
    });
    const claimedVersion = await tx.proposalVersion.updateMany({
      data: { acceptedAt: new Date(), status: "ACCEPTED" },
      where: { id: version.id, status: "SUBMITTED" },
    });
    if (!claimedVersion.count || !claimedProposal.count) {
      throw new Error("Proposal version is no longer available for acceptance.");
    }
    await tx.proposalVersion.updateMany({
      data: { status: "WITHDRAWN" },
      where: {
        id: { not: version.id },
        proposalId: version.proposalId,
        status: "DRAFT",
      },
    });
    await tx.proposalVersion.updateMany({
      data: { status: "SUPERSEDED" },
      where: {
        id: { not: version.id },
        proposalId: version.proposalId,
        status: "SUBMITTED",
      },
    });
    await tx.proposalStatusHistory.create({
      data: {
        actorId: user.id,
        fromStatus: version.proposal.status,
        note: `Accepted immutable proposal version ${version.versionNumber}.`,
        proposalId: version.proposalId,
        toStatus: "ACCEPTED",
      },
    });
    const createdDeal = await tx.deal.create({
      data: {
        currency: version.currency,
        opportunityId: version.proposal.opportunityId,
        proposalId: version.proposalId,
        proposalVersionId: version.id,
        settlementMode: "PROVIDER_DISABLED",
        status: "IN_PROGRESS",
        valueMinor: version.amountMinor,
        participants: {
          create: [
            { role: "client", userId: version.proposal.opportunity.ownerId },
            { role: "freelancer", userId: version.proposal.senderId },
          ],
        },
        milestones: {
          create:
            version.milestones.length > 0
              ? version.milestones.map((milestone) => ({
                  amountMinor: milestone.amountMinor,
                  currency: version.currency,
                  description: milestone.description,
                  dueAt: new Date(Date.now() + milestone.dueInDays * 86_400_000),
                  status: "IN_PROGRESS",
                  title: milestone.title,
                }))
              : [
                  {
                    amountMinor: version.amountMinor,
                    currency: version.currency,
                    description: "Complete the accepted proposal scope.",
                    dueAt: new Date(Date.now() + version.deliveryDays * 86_400_000),
                    status: "IN_PROGRESS",
                    title: "Project delivery",
                  },
                ],
        },
        statusHistory: {
          create: {
            actorId: user.id,
            reason: "Accepted proposal version activated a non-custodial Deal record. Online payment is not active.",
            toStatus: "IN_PROGRESS",
          },
        },
      },
    });
    const acceptedEvent = await tx.conversationEvent.create({
      data: {
        actorId: user.id,
        conversationId: version.proposal.conversationId!,
        idempotencyKey: `proposal:${version.proposalId}:version:${version.versionNumber}:accepted`,
        proposalVersionId: version.id,
        snapshot: versionSnapshot(version, version.proposal.opportunity.title),
        type: "PROPOSAL_ACCEPTED",
      },
    });
    await tx.conversationEvent.create({
      data: {
        actorId: user.id,
        conversationId: version.proposal.conversationId!,
        dealId: createdDeal.id,
        idempotencyKey: `deal:${createdDeal.id}:created`,
        proposalVersionId: version.id,
        snapshot: {
          amountMinor: version.amountMinor.toString(),
          currency: version.currency,
          onlinePaymentActive: false,
          proposalVersionNumber: version.versionNumber,
          schemaVersion: 1,
          settlementMode: "PROVIDER_DISABLED",
          status: "IN_PROGRESS",
          title: version.proposal.opportunity.title,
        },
        type: "DEAL_CREATED",
      },
    });
    await tx.conversationParticipant.updateMany({
      data: { removedAt: null },
      where: { conversationId: version.proposal.conversationId! },
    });
    await tx.notification.create({
      data: {
        actionUrl: `/app/messages/${version.proposal.conversationId}?event=${acceptedEvent.id}`,
        body: `Version ${version.versionNumber} was accepted. A Deal record is ready; online payment is not active.`,
        metadata: {
          conversationEventId: acceptedEvent.id,
          conversationId: version.proposal.conversationId,
          dealId: createdDeal.id,
          proposalId: version.proposalId,
          proposalVersionId: version.id,
          recipientId: version.proposal.senderId,
        },
        title: "Proposal accepted",
        type: "DEAL",
        userId: version.proposal.senderId,
      },
    });
    await tx.auditLog.create({
      data: {
        action: "proposal.version_accepted",
        actorId: user.id,
        entityId: version.id,
        entityType: "proposal_version",
        metadata: {
          dealId: createdDeal.id,
          proposalId: version.proposalId,
          settlementMode: "PROVIDER_DISABLED",
          versionNumber: version.versionNumber,
        },
      },
    });
    await tx.conversation.update({
      data: { updatedAt: new Date() },
      where: { id: version.proposal.conversationId! },
    });
    return createdDeal;
  });

  redirect(`/app/deals/${deal.id}`);
}
