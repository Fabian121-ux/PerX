"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getPrisma } from "@/lib/db/prisma";
import { hasDatabaseUrl, getResolvedDataMode } from "@/lib/env";
import { writeAuditLog } from "@/lib/logging/audit";
import { parseMoneyToMinor } from "@/lib/money";
import {
  contactPreferenceOptions,
  findOption,
  opportunityCategoryOptions,
  propertyListingTypeOptions,
  propertyTypeOptions,
  reportReasonOptions,
} from "@/lib/options";
import { hasCapability } from "@/lib/permissions/capabilities";
import { assertCanPublish } from "@/lib/account/enforcement";
import { requireUser } from "@/lib/auth/session";
import {
  opportunityFormSchema,
  opportunityReportSchema,
} from "@/lib/validation/opportunity";
import { evaluatePolicy, isPolicyBlocking } from "@/lib/policy/enforcement";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function revalidateOpportunityViews(slug?: string) {
  revalidatePath("/app");
  revalidatePath("/app/manage");
  revalidatePath("/app/opportunities");
  revalidatePath("/app/discover");
  revalidatePath("/app/real-estate");
  revalidatePath("/app/services");
  revalidatePath("/app/market");
  revalidatePath("/app/logistics");
  revalidatePath("/app/travel-stay");
  revalidatePath("/discover");
  if (slug) revalidatePath(`/opportunities/${slug}`);
}

function propertyPublishRedirect(target: "new" | string, error: string) {
  if (target === "new") redirect(`/app/opportunities/new?error=${error}&type=PROPERTY&category=real-estate`);
  redirect(`/app/opportunities/${target}/edit?error=${error}`);
}

function propertyFieldsFromFormData(formData: FormData) {
  return {
    authorityDeclaration: String(formData.get("authorityDeclaration") ?? "").trim(),
    contactPreference: String(formData.get("contactPreference") ?? ""),
    listingRulesAccepted: formData.get("listingRulesAccepted") === "on",
    propertyListingType: String(formData.get("propertyListingType") ?? ""),
    propertyType: String(formData.get("propertyType") ?? ""),
  };
}

async function assertPropertyPublishReady({
  formData,
  opportunityId,
  target,
}: {
  formData: FormData;
  opportunityId?: string;
  target: "new" | string;
}) {
  const fields = propertyFieldsFromFormData(formData);
  if (!findOption(propertyTypeOptions, fields.propertyType)) {
    propertyPublishRedirect(target, "property-type");
  }
  if (!findOption(propertyListingTypeOptions, fields.propertyListingType)) {
    propertyPublishRedirect(target, "property-listing-type");
  }
  if (!findOption(contactPreferenceOptions, fields.contactPreference)) {
    propertyPublishRedirect(target, "contact-preference");
  }
  if (fields.authorityDeclaration.length < 20) {
    propertyPublishRedirect(target, "authority-declaration");
  }
  if (!fields.listingRulesAccepted) {
    propertyPublishRedirect(target, "listing-rules");
  }

  if (opportunityId) {
    const cover = await getPrisma().opportunityImage.findFirst({
      select: { id: true },
      where: { isCover: true, opportunityId },
    });
    if (!cover) propertyPublishRedirect(target, "property-image");
  } else {
    propertyPublishRedirect(target, "property-draft-first");
  }
}

export async function createOpportunityAction(formData: FormData) {
  const user = await requireUser();
  if (!hasCapability(user.roles, "opportunity:create"))
    redirect("/app?error=forbidden");

  if (getResolvedDataMode() === "mock") redirect("/app/market?mock=true");
  if (!hasDatabaseUrl())
    redirect("/app/opportunities/new?error=database-not-configured");

  const parsed = opportunityFormSchema.safeParse({
    budgetMax: formData.get("budgetMax"),
    budgetMin: formData.get("budgetMin"),
    category: formData.get("category"),
    currency: formData.get("currency") || "NGN",
    description: formData.get("description"),
    intent: formData.get("intent") || "draft",
    location: formData.get("location"),
    ...propertyFieldsFromFormData(formData),
    remote: formData.get("remote") === "on",
    skills: formData.get("skills"),
    summary: formData.get("summary"),
    title: formData.get("title"),
    type: formData.get("type"),
  });

  if (!parsed.success) redirect("/app/opportunities/new?error=check-fields");
  if (parsed.data.intent === "publish") {
    const restriction = await assertCanPublish(user.id);
    if (restriction) redirect("/app/manage?error=publishing-restricted");
  }

  const categoryOption = findOption(opportunityCategoryOptions, parsed.data.category);
  if (!categoryOption) redirect("/app/opportunities/new?error=check-fields");

  const policy = evaluatePolicy({
    actorId: user.id,
    content: `${parsed.data.title}\n${parsed.data.summary}\n${parsed.data.description}`,
    entityType: "opportunity",
  });

  if (policy.outcome !== "ALLOW") {
    await writeAuditLog({
      actorId: user.id,
      action: "policy.opportunity_evaluated",
      entityType: "opportunity",
      metadata: policy.auditMetadata,
    });
  }

  if (isPolicyBlocking(policy)) {
    redirect("/app/opportunities/new?error=check-fields");
  }

  const categorySlug = categoryOption.value;
  const category = await getPrisma().opportunityCategory.upsert({
    where: { slug: categorySlug },
    update: {
      description: categoryOption.description,
      name: categoryOption.label,
    },
    create: {
      description: categoryOption.description,
      name: categoryOption.label,
      slug: categorySlug,
    },
  });

  const currency = parsed.data.currency.toUpperCase();
  const budgetMin = parsed.data.budgetMin
    ? parseMoneyToMinor(parsed.data.budgetMin, currency)
    : null;
  const budgetMax = parsed.data.budgetMax
    ? parseMoneyToMinor(parsed.data.budgetMax, currency)
    : null;
  if (parsed.data.type === "PROPERTY" && parsed.data.intent === "publish") {
    await assertPropertyPublishReady({ formData, target: "new" });
  }

  const status = parsed.data.intent === "publish" ? "PUBLISHED" : "DRAFT";
  const moderationStatus =
    status === "PUBLISHED"
      ? policy.outcome === "ALLOW"
        ? "APPROVED"
        : "FLAGGED"
      : "PENDING";
  const slug = `${slugify(parsed.data.title)}-${Date.now().toString(36)}`;

  const opportunity = await getPrisma().opportunity.create({
    data: {
      budgetMaxMinor: budgetMax?.amountMinor,
      budgetMinMinor: budgetMin?.amountMinor,
      categoryId: category.id,
      currency,
      description: parsed.data.description,
      location: parsed.data.location,
      moderationStatus,
      ownerId: user.id,
      authorityDeclaration: parsed.data.authorityDeclaration || null,
      contactPreference: parsed.data.contactPreference || null,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
      propertyListingType: parsed.data.propertyListingType || null,
      propertyType: parsed.data.propertyType || null,
      propertyVerificationState:
        parsed.data.type === "PROPERTY"
          ? status === "PUBLISHED"
            ? "PENDING_VERIFICATION"
            : "DRAFT"
          : null,
      listingRulesAccepted: parsed.data.listingRulesAccepted,
      remote: parsed.data.remote,
      skills:
        parsed.data.skills
          ?.split(",")
          .map((skill) => skill.trim())
          .filter(Boolean) ?? [],
      slug,
      status,
      summary: parsed.data.summary,
      title: parsed.data.title,
      type: parsed.data.type,
      statusHistory: {
        create: {
          actorId: user.id,
          note: `Opportunity ${status.toLowerCase()}.`,
          toStatus: status,
        },
      },
    },
  });

  await writeAuditLog({
    actorId: user.id,
    action: "opportunity.create",
    entityId: opportunity.id,
    entityType: "opportunity",
  });
  revalidateOpportunityViews(opportunity.slug);
  revalidatePath(`/u/${user.username}`);
  if (category.slug) revalidatePath(`/categories/${category.slug}`);

  redirect(
    parsed.data.type === "PROPERTY"
      ? `/app/opportunities/${opportunity.id}/edit?created=1`
      : "/app/manage?created=1",
  );
}

export async function updateOpportunityAction(
  opportunityId: string,
  formData: FormData,
) {
  const user = await requireUser();
  if (!hasCapability(user.roles, "opportunity:update:own")) {
    redirect("/app?error=forbidden");
  }

  const opportunity = await getPrisma().opportunity.findFirst({
    include: { category: true },
    where: { id: opportunityId, ownerId: user.id },
  });
  if (!opportunity) redirect("/app/manage?error=not-found");

  const parsed = opportunityFormSchema.safeParse({
    budgetMax: formData.get("budgetMax"),
    budgetMin: formData.get("budgetMin"),
    category: formData.get("category"),
    currency: formData.get("currency") || "NGN",
    description: formData.get("description"),
    intent: formData.get("intent") || opportunity.status.toLowerCase(),
    location: formData.get("location"),
    ...propertyFieldsFromFormData(formData),
    remote: formData.get("remote") === "on",
    skills: formData.get("skills"),
    summary: formData.get("summary"),
    title: formData.get("title"),
    type: formData.get("type"),
  });

  if (!parsed.success) redirect(`/app/opportunities/${opportunityId}/edit?error=check-fields`);
  if (parsed.data.intent === "publish") {
    const restriction = await assertCanPublish(user.id);
    if (restriction) redirect("/app/manage?error=publishing-restricted");
  }

  const categoryOption = findOption(opportunityCategoryOptions, parsed.data.category);
  if (!categoryOption) redirect(`/app/opportunities/${opportunityId}/edit?error=check-fields`);

  const policy = evaluatePolicy({
    actorId: user.id,
    content: `${parsed.data.title}\n${parsed.data.summary}\n${parsed.data.description}`,
    entityId: opportunityId,
    entityType: "opportunity",
  });

  if (isPolicyBlocking(policy)) {
    redirect(`/app/opportunities/${opportunityId}/edit?error=policy`);
  }

  const category = await getPrisma().opportunityCategory.upsert({
    create: {
      description: categoryOption.description,
      name: categoryOption.label,
      slug: categoryOption.value,
    },
    update: {
      description: categoryOption.description,
      name: categoryOption.label,
    },
    where: { slug: categoryOption.value },
  });

  const currency = parsed.data.currency.toUpperCase();
  const budgetMin = parsed.data.budgetMin
    ? parseMoneyToMinor(parsed.data.budgetMin, currency)
    : null;
  const budgetMax = parsed.data.budgetMax
    ? parseMoneyToMinor(parsed.data.budgetMax, currency)
    : null;
  const publishing = parsed.data.intent === "publish";
  const nextStatus = publishing ? "PUBLISHED" : opportunity.status;
  const storedStatus =
    parsed.data.type === "PROPERTY" && publishing ? "DRAFT" : nextStatus;
  if (parsed.data.type === "PROPERTY" && publishing) {
    await assertPropertyPublishReady({
      formData,
      opportunityId,
      target: opportunityId,
    });
  }

  await getPrisma().$transaction(async (tx) => {
    await tx.opportunity.update({
      data: {
        budgetMaxMinor: budgetMax?.amountMinor,
        budgetMinMinor: budgetMin?.amountMinor,
        categoryId: category.id,
        currency,
        description: parsed.data.description,
        location: parsed.data.location,
        moderationStatus:
          nextStatus === "PUBLISHED" && parsed.data.type !== "PROPERTY"
            ? policy.outcome === "ALLOW"
              ? "APPROVED"
              : "FLAGGED"
            : parsed.data.type === "PROPERTY" && publishing
              ? "PENDING"
              : opportunity.moderationStatus,
        authorityDeclaration: parsed.data.authorityDeclaration || null,
        contactPreference: parsed.data.contactPreference || null,
        publishedAt:
          nextStatus === "PUBLISHED" && parsed.data.type !== "PROPERTY"
            ? opportunity.publishedAt ?? new Date()
            : opportunity.publishedAt,
        propertyListingType: parsed.data.propertyListingType || null,
        propertyType: parsed.data.propertyType || null,
        propertyVerificationState:
          parsed.data.type === "PROPERTY"
            ? publishing
              ? "PENDING_VERIFICATION"
              : opportunity.propertyVerificationState ?? "DRAFT"
            : null,
        listingRulesAccepted: parsed.data.listingRulesAccepted,
        remote: parsed.data.remote,
        skills:
          parsed.data.skills
            ?.split(",")
            .map((skill) => skill.trim())
            .filter(Boolean) ?? [],
        status: storedStatus,
        summary: parsed.data.summary,
        title: parsed.data.title,
        type: parsed.data.type,
      },
      where: { id: opportunityId },
    });
    await tx.opportunityStatusHistory.create({
      data: {
        actorId: user.id,
        fromStatus: opportunity.status,
        note: "Owner updated opportunity content.",
        opportunityId,
        toStatus: storedStatus,
      },
    });
    await tx.auditLog.create({
      data: {
        action: "opportunity.update",
        actorId: user.id,
        entityId: opportunityId,
        entityType: "opportunity",
        metadata: {
          fromStatus: opportunity.status,
          toStatus: storedStatus,
          verificationState:
            parsed.data.type === "PROPERTY" && publishing
              ? "PENDING_VERIFICATION"
              : null,
        },
      },
    });
  });

  revalidateOpportunityViews(opportunity.slug);
  revalidatePath(`/u/${user.username}`);
  revalidatePath(`/categories/${category.slug}`);
  redirect(
    parsed.data.type === "PROPERTY" && publishing
      ? "/app/manage?submitted=verification"
      : "/app/manage?updated=1",
  );
}

export async function publishOpportunityAction(opportunityId: string) {
  await transitionOpportunity(opportunityId, "PUBLISHED", "opportunity.publish");
}

export async function pauseOpportunityAction(opportunityId: string) {
  await transitionOpportunity(opportunityId, "PAUSED", "opportunity.pause");
}

export async function archiveOpportunityAction(opportunityId: string) {
  await transitionOpportunity(opportunityId, "ARCHIVED", "opportunity.archive");
}

export async function restoreOpportunityAction(opportunityId: string) {
  await transitionOpportunity(opportunityId, "DRAFT", "opportunity.restore");
}

async function transitionOpportunity(
  opportunityId: string,
  toStatus: "DRAFT" | "PUBLISHED" | "PAUSED" | "ARCHIVED",
  action: string,
) {
  const user = await requireUser();
  const opportunity = await getPrisma().opportunity.findFirst({
    where: { id: opportunityId, ownerId: user.id },
    include: { category: true, images: true },
  });
  if (!opportunity) redirect("/app/manage?error=not-found");
  if (toStatus === "PUBLISHED") {
    const restriction = await assertCanPublish(user.id);
    if (restriction) redirect("/app/manage?error=publishing-restricted");
  }

  const policy =
    toStatus === "PUBLISHED"
      ? evaluatePolicy({
          actorId: user.id,
          content: `${opportunity.title}\n${opportunity.summary}\n${opportunity.description}`,
          entityId: opportunity.id,
          entityType: "opportunity",
        })
      : null;

  if (policy && isPolicyBlocking(policy)) {
    redirect("/app/manage?error=policy");
  }

  if (toStatus === "PUBLISHED" && opportunity.type === "PROPERTY") {
    const hasCover = opportunity.images.some((image) => image.isCover);
    if (
      !hasCover ||
      !opportunity.propertyType ||
      !opportunity.propertyListingType ||
      !opportunity.contactPreference ||
      !opportunity.authorityDeclaration ||
      !opportunity.listingRulesAccepted
    ) {
      redirect("/app/manage?error=property-requirements");
    }

    if (opportunity.propertyVerificationState !== "VERIFIED") {
      await getPrisma().opportunity.update({
        data: {
          moderationStatus: "PENDING",
          propertyVerificationState: "PENDING_VERIFICATION",
          status: "DRAFT",
        },
        where: { id: opportunityId },
      });
      await writeAuditLog({
        action: "opportunity.property_verification_submitted",
        actorId: user.id,
        entityId: opportunityId,
        entityType: "opportunity",
      });
      revalidateOpportunityViews(opportunity.slug);
      revalidatePath(`/u/${user.username}`);
      if (opportunity.category?.slug) {
        revalidatePath(`/categories/${opportunity.category.slug}`);
      }
      redirect("/app/manage?submitted=verification");
    }
  }

  await getPrisma().$transaction(async (tx) => {
    await tx.opportunity.update({
      data: {
        archivedAt: toStatus === "ARCHIVED" ? new Date() : null,
        closedAt: null,
        moderationStatus:
          toStatus === "PUBLISHED"
            ? policy?.outcome === "ALLOW"
              ? "APPROVED"
              : "FLAGGED"
            : opportunity.moderationStatus,
        propertyVerificationState:
          opportunity.type === "PROPERTY"
            ? toStatus === "PUBLISHED"
              ? "PUBLISHED"
              : toStatus === "PAUSED"
                ? "PAUSED"
                : toStatus === "ARCHIVED"
                  ? "ARCHIVED"
                  : opportunity.propertyVerificationState
            : null,
        pausedAt: toStatus === "PAUSED" ? new Date() : null,
        publishedAt:
          toStatus === "PUBLISHED"
            ? opportunity.publishedAt ?? new Date()
            : opportunity.publishedAt,
        status: toStatus,
      },
      where: { id: opportunityId },
    });
    await tx.opportunityStatusHistory.create({
      data: {
        actorId: user.id,
        fromStatus: opportunity.status,
        opportunityId,
        toStatus,
      },
    });
    await tx.auditLog.create({
      data: {
        action,
        actorId: user.id,
        entityId: opportunityId,
        entityType: "opportunity",
        metadata: { fromStatus: opportunity.status, toStatus },
      },
    });
  });

  revalidateOpportunityViews(opportunity.slug);
  revalidatePath(`/u/${user.username}`);
  if (opportunity.category?.slug) {
    revalidatePath(`/categories/${opportunity.category.slug}`);
  }
  redirect("/app/manage");
}

export async function deleteOpportunityAction(opportunityId: string) {
  const user = await requireUser();
  const opportunity = await getPrisma().opportunity.findFirst({
    where: { id: opportunityId, ownerId: user.id },
  });
  if (!opportunity) redirect("/app/manage?error=not-found");
  if (!["DRAFT", "ARCHIVED"].includes(opportunity.status)) {
    redirect("/app/manage?error=delete-locked");
  }

  await getPrisma().$transaction(async (tx) => {
    await tx.opportunity.delete({ where: { id: opportunityId } });
    await tx.auditLog.create({
      data: {
        action: "opportunity.delete",
        actorId: user.id,
        entityId: opportunityId,
        entityType: "opportunity",
        metadata: { previousStatus: opportunity.status },
      },
    });
  });

  revalidateOpportunityViews(opportunity.slug);
  revalidatePath(`/u/${user.username}`);
  redirect("/app/manage");
}

export async function duplicateOpportunityAction(opportunityId: string) {
  const user = await requireUser();
  const opportunity = await getPrisma().opportunity.findFirst({
    where: { id: opportunityId, ownerId: user.id },
  });
  if (!opportunity) redirect("/app/manage?error=not-found");

  const duplicate = await getPrisma().opportunity.create({
    data: {
      budgetMaxMinor: opportunity.budgetMaxMinor,
      budgetMinMinor: opportunity.budgetMinMinor,
      categoryId: opportunity.categoryId,
      currency: opportunity.currency,
      description: opportunity.description,
      location: opportunity.location,
      moderationStatus: "PENDING",
      ownerId: user.id,
      authorityDeclaration: opportunity.authorityDeclaration,
      contactPreference: opportunity.contactPreference,
      listingRulesAccepted: opportunity.listingRulesAccepted,
      propertyListingType: opportunity.propertyListingType,
      propertyType: opportunity.propertyType,
      propertyVerificationState:
        opportunity.type === "PROPERTY" ? "DRAFT" : null,
      remote: opportunity.remote,
      skills: opportunity.skills,
      slug: `${slugify(opportunity.title)}-copy-${Date.now().toString(36)}`,
      status: "DRAFT",
      summary: opportunity.summary,
      title: `${opportunity.title} copy`,
      type: opportunity.type,
      statusHistory: {
        create: {
          actorId: user.id,
          note: `Duplicated from ${opportunity.id}.`,
          toStatus: "DRAFT",
        },
      },
    },
  });

  await writeAuditLog({
    action: "opportunity.duplicate",
    actorId: user.id,
    entityId: duplicate.id,
    entityType: "opportunity",
    metadata: { sourceOpportunityId: opportunity.id },
  });
  revalidateOpportunityViews();
  redirect(`/app/opportunities/${duplicate.id}/edit`);
}

export async function bookmarkOpportunityAction(formData: FormData) {
  const user = await requireUser();
  
  if (getResolvedDataMode() === "mock") redirect("/app/saved?mock=true");
  if (!hasDatabaseUrl()) redirect("/app/saved?error=database-not-configured");

  const opportunityId = String(formData.get("opportunityId") ?? "");
  await getPrisma().opportunityBookmark.upsert({
    create: { opportunityId, userId: user.id },
    update: {},
    where: { userId_opportunityId: { opportunityId, userId: user.id } },
  });

  redirect("/app/saved");
}

export async function reportOpportunityAction(formData: FormData) {
  const user = await requireUser();

  if (getResolvedDataMode() === "mock") redirect("/discover?status=reported&mock=true");
  if (!hasDatabaseUrl()) redirect("/discover?error=database-not-configured");

  const parsed = opportunityReportSchema.safeParse({
    details: formData.get("details"),
    opportunityId: formData.get("opportunityId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) redirect("/discover?error=invalid-report");

  const reason = findOption(reportReasonOptions, parsed.data.reason);
  const existing = await getPrisma().opportunityReport.findFirst({
    where: {
      opportunityId: parsed.data.opportunityId,
      reporterId: user.id,
      status: { in: ["OPEN", "REVIEWING"] },
    },
  });

  if (!existing) {
    await getPrisma().opportunityReport.create({
      data: {
        details: parsed.data.details || null,
        opportunityId: parsed.data.opportunityId,
        reason: reason?.label ?? parsed.data.reason,
        reporterId: user.id,
      },
    });
  }

  await getPrisma().notification.create({
    data: {
      body: existing
        ? "You already have an open report for this listing."
        : "Your report was received and will be reviewed.",
      title: existing ? "Report already open" : "Report submitted",
      type: "MODERATION",
      userId: user.id,
    },
  });
  await writeAuditLog({
    actorId: user.id,
    action: "opportunity.report",
    entityId: parsed.data.opportunityId,
    entityType: "opportunity",
  });
  redirect("/discover?status=reported");
}
