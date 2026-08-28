"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getPrisma } from "@/lib/db/prisma";
import { hasDatabaseUrl, getResolvedDataMode } from "@/lib/env";
import { writeAuditLog } from "@/lib/logging/audit";
import { parseMoneyToMinor } from "@/lib/money";
import {
  allOpportunityCategoryOptions,
  contactPreferenceOptions,
  findOption,
  isRetiredOpportunityCategory,
  isRetiredOpportunityType,
  opportunityCategoryOptions,
  propertyListingTypeOptions,
  propertyTypeOptions,
  reportReasonOptions,
  creatableOpportunityTypeOptions,
} from "@/lib/options";
import { hasCapability } from "@/lib/permissions/capabilities";
import {
  isUnavailableInvestmentPublication,
  wouldPersistUnavailableInvestmentPublication,
} from "@/lib/opportunities/publication";
import { assertCanPublish } from "@/lib/account/enforcement";
import { requireUser } from "@/lib/auth/session";
import {
  opportunityFormSchema,
  opportunityReportSchema,
} from "@/lib/validation/opportunity";
import { evaluatePolicy, isPolicyBlocking } from "@/lib/policy/enforcement";
import { buildPublicOpportunityWhere } from "@/lib/data/public-opportunities";

/**
 * Result of a create/update attempt.
 *
 * The composer previously had no return channel at all: the action always
 * redirected, so every failure - a mistyped budget, a blocked policy phrase, an
 * unknown category - collapsed into `?error=check-fields` and the same
 * "Please check your inputs and try again." banner. The schema was already
 * producing precise, per-field messages; they were discarded at the redirect.
 *
 * `fieldErrors` is keyed by form field name so the composer can mark the exact
 * control, and `message` carries the summary shown above the form.
 */
export type OpportunityFormState = {
  fieldErrors?: Record<string, string>;
  message?: string;
  status: "error" | "idle";
};

/**
 * Flatten Zod issues into one message per field.
 *
 * First issue wins: showing a single actionable sentence per control is more
 * useful than stacking every rule that failed on the same input. Mirrors the
 * reducer the auth actions already use.
 */
function fieldErrorsFromIssues(issues: {
  issues: { message: string; path: PropertyKey[] }[];
}) {
  return issues.issues.reduce<Record<string, string>>((errors, issue) => {
    const field = issue.path[0];
    if (typeof field === "string" && !errors[field]) {
      errors[field] = issue.message;
    }
    return errors;
  }, {});
}

/** Summary line that states how many controls need attention. */
function summarizeFieldErrors(fieldErrors: Record<string, string>) {
  const count = Object.keys(fieldErrors).length;
  if (count === 0) return "We could not save this yet.";
  return count === 1
    ? "We could not save this yet. 1 field needs your attention."
    : `We could not save this yet. ${count} fields need your attention.`;
}

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
  revalidatePath("/app/services");
  revalidatePath("/app/market");
  revalidatePath("/app/logistics");
  revalidatePath("/app/travel-stay");
  revalidatePath("/discover");
  if (slug) revalidatePath(`/opportunities/${slug}`);
}

function propertyPublishRedirect(target: "new" | string, error: string) {
  // `target === "new"` is now unreachable for PROPERTY: the type cannot be
  // selected in the composer and is refused server-side by
  // `createOpportunityAction`. The branch is kept so the validator stays total
  // and degrades to the generic composer rather than throwing, but it no
  // longer pre-selects the retired vertical.
  if (target === "new") redirect(`/app/opportunities/new?error=${error}`);
  redirect(`/app/opportunities/${target}/edit?error=${error}`);
}

function newOpportunityErrorHref(
  error: string,
  type: FormDataEntryValue | null,
  category: FormDataEntryValue | null,
) {
  const params = new URLSearchParams({ error });
  const rawType = String(type ?? "");
  const rawCategory = String(category ?? "");
  if (findOption(creatableOpportunityTypeOptions, rawType)) {
    params.set("type", rawType);
  }
  if (findOption(opportunityCategoryOptions, rawCategory)) {
    params.set("category", rawCategory);
  }
  return `/app/opportunities/new?${params}`;
}

function propertyFieldsFromFormData(formData: FormData) {
  return {
    authorityDeclaration: String(
      formData.get("authorityDeclaration") ?? "",
    ).trim(),
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

export async function createOpportunityAction(
  _previous: OpportunityFormState,
  formData: FormData,
): Promise<OpportunityFormState> {
  const user = await requireUser();
  // Server remains the authority. Navigation visibility never implies access.
  if (!hasCapability(user.roles, "opportunity:create"))
    redirect("/app/opportunities/new");

  if (getResolvedDataMode() === "mock") redirect("/app/market?mock=true");
  if (!hasDatabaseUrl())
    redirect(
      newOpportunityErrorHref(
        "database-not-configured",
        formData.get("type"),
        formData.get("category"),
      ),
    );

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

  if (!parsed.success) {
    const fieldErrors = fieldErrorsFromIssues(parsed.error);
    return {
      fieldErrors,
      message: summarizeFieldErrors(fieldErrors),
      status: "error",
    };
  }
  if (parsed.data.type === "INVESTMENT") {
    redirect("/app/opportunities/new?error=type-unavailable");
  }
  // Retired verticals are removed from every picker, but the client is never
  // the authority: a hand-crafted POST must not be able to create new content
  // in a vertical the product no longer offers.
  if (
    isRetiredOpportunityType(parsed.data.type) ||
    isRetiredOpportunityCategory(parsed.data.category)
  ) {
    redirect("/app/opportunities/new?error=type-unavailable");
  }
  if (parsed.data.intent === "publish") {
    const restriction = await assertCanPublish(user.id);
    if (restriction) redirect("/app/manage?error=publishing-restricted");
  }

  const categoryOption = findOption(
    opportunityCategoryOptions,
    parsed.data.category,
  );
  if (!categoryOption) {
    return {
      fieldErrors: { category: "Choose a category from the list." },
      message: summarizeFieldErrors({ category: "" }),
      status: "error",
    };
  }

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
    // A content-policy rejection is not a typo. Telling the user to "check
    // their inputs" sends them hunting through valid fields; the policy layer
    // already provides a user-safe explanation.
    return {
      message:
        policy.userMessage ??
        "This content cannot be published because it breaches the PerX content policy.",
      status: "error",
    };
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
      authorityDeclaration:
        parsed.data.type === "PROPERTY"
          ? parsed.data.authorityDeclaration || null
          : null,
      contactPreference:
        parsed.data.type === "PROPERTY"
          ? parsed.data.contactPreference || null
          : null,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
      propertyListingType:
        parsed.data.type === "PROPERTY"
          ? parsed.data.propertyListingType || null
          : null,
      propertyType:
        parsed.data.type === "PROPERTY"
          ? parsed.data.propertyType || null
          : null,
      propertyVerificationState:
        parsed.data.type === "PROPERTY"
          ? status === "PUBLISHED"
            ? "PENDING_VERIFICATION"
            : "DRAFT"
          : null,
      listingRulesAccepted:
        parsed.data.type === "PROPERTY"
          ? parsed.data.listingRulesAccepted
          : false,
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
      ? `/app/opportunities/${opportunity.id}/edit?created=${opportunity.id}&createdType=${parsed.data.type}`
      : `/app/manage?created=${opportunity.id}&createdType=${parsed.data.type}`,
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

  if (!parsed.success)
    redirect(`/app/opportunities/${opportunityId}/edit?error=check-fields`);
  if (
    wouldPersistUnavailableInvestmentPublication({
      currentStatus: opportunity.status,
      intent: parsed.data.intent,
      propertyListingType: parsed.data.propertyListingType,
      type: parsed.data.type,
    })
  ) {
    redirect(`/app/opportunities/${opportunityId}/edit?error=type-unavailable`);
  }
  // Migrating an existing record INTO a retired vertical is refused, but a
  // record that is already in one may be saved unchanged - otherwise the owner
  // could never edit or archive their legacy listings.
  if (
    isRetiredOpportunityType(parsed.data.type) &&
    parsed.data.type !== opportunity.type
  ) {
    redirect(`/app/opportunities/${opportunityId}/edit?error=type-unavailable`);
  }
  if (
    isRetiredOpportunityCategory(parsed.data.category) &&
    parsed.data.category !== opportunity.category?.slug
  ) {
    redirect(`/app/opportunities/${opportunityId}/edit?error=type-unavailable`);
  }
  if (parsed.data.intent === "publish") {
    const restriction = await assertCanPublish(user.id);
    if (restriction) redirect("/app/manage?error=publishing-restricted");
  }

  // Retired categories bypass the picker list but must still resolve for
  // legacy records that already hold one.
  const categoryOption =
    findOption(opportunityCategoryOptions, parsed.data.category) ??
    (parsed.data.category === opportunity.category?.slug
      ? findOption(allOpportunityCategoryOptions, parsed.data.category)
      : undefined);
  if (!categoryOption)
    redirect(`/app/opportunities/${opportunityId}/edit?error=check-fields`);

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
        authorityDeclaration:
          parsed.data.type === "PROPERTY"
            ? parsed.data.authorityDeclaration || null
            : null,
        contactPreference:
          parsed.data.type === "PROPERTY"
            ? parsed.data.contactPreference || null
            : null,
        publishedAt:
          nextStatus === "PUBLISHED" && parsed.data.type !== "PROPERTY"
            ? (opportunity.publishedAt ?? new Date())
            : opportunity.publishedAt,
        propertyListingType:
          parsed.data.type === "PROPERTY"
            ? parsed.data.propertyListingType || null
            : null,
        propertyType:
          parsed.data.type === "PROPERTY"
            ? parsed.data.propertyType || null
            : null,
        propertyVerificationState:
          parsed.data.type === "PROPERTY"
            ? publishing
              ? "PENDING_VERIFICATION"
              : (opportunity.propertyVerificationState ?? "DRAFT")
            : null,
        listingRulesAccepted:
          parsed.data.type === "PROPERTY"
            ? parsed.data.listingRulesAccepted
            : false,
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
  await transitionOpportunity(
    opportunityId,
    "PUBLISHED",
    "opportunity.publish",
  );
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
  if (!hasCapability(user.roles, "opportunity:update:own")) {
    redirect("/app?error=forbidden");
  }
  const opportunity = await getPrisma().opportunity.findFirst({
    where: { id: opportunityId, ownerId: user.id },
    include: { category: true, images: true },
  });
  if (!opportunity) redirect("/app/manage?error=not-found");
  if (
    toStatus === "PUBLISHED" &&
    isUnavailableInvestmentPublication(opportunity)
  ) {
    redirect("/app/manage?error=type-unavailable");
  }
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

  const transitioned = await getPrisma().$transaction(async (tx) => {
    const result = await tx.opportunity.updateMany({
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
            ? (opportunity.publishedAt ?? new Date())
            : opportunity.publishedAt,
        status: toStatus,
      },
      where: {
        id: opportunityId,
        ownerId: user.id,
        ...(toStatus === "PUBLISHED"
          ? {
              AND: [
                {
                  OR: [
                    { propertyListingType: null },
                    { propertyListingType: { not: "CO_INVESTMENT" } },
                  ],
                },
                {
                  OR: [
                    { type: { not: "PROPERTY" } },
                    {
                      authorityDeclaration: { not: null },
                      contactPreference: { not: null },
                      images: { some: { isCover: true } },
                      listingRulesAccepted: true,
                      propertyListingType: { not: null },
                      propertyType: { not: null },
                      propertyVerificationState: "VERIFIED",
                      type: "PROPERTY",
                    },
                  ],
                },
              ],
              type: { not: "INVESTMENT" as const },
            }
          : {}),
      },
    });
    if (result.count !== 1) return false;
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
    return true;
  });
  if (!transitioned) redirect("/app/manage?error=state-changed");

  revalidateOpportunityViews(opportunity.slug);
  revalidatePath(`/u/${user.username}`);
  if (opportunity.category?.slug) {
    revalidatePath(`/categories/${opportunity.category.slug}`);
  }
  redirect("/app/manage");
}

export async function deleteOpportunityAction(opportunityId: string) {
  const user = await requireUser();
  if (!hasCapability(user.roles, "opportunity:update:own")) {
    redirect("/app?error=forbidden");
  }
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
  if (
    !hasCapability(user.roles, "opportunity:create") ||
    !hasCapability(user.roles, "opportunity:update:own")
  ) {
    redirect("/app?error=forbidden");
  }
  const opportunity = await getPrisma().opportunity.findFirst({
    where: { id: opportunityId, ownerId: user.id },
  });
  if (!opportunity) redirect("/app/manage?error=not-found");
  if (opportunity.type === "INVESTMENT") {
    redirect("/app/manage?error=type-unavailable");
  }

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
  const opportunity = await getPrisma().opportunity.findFirst({
    select: { id: true },
    where: {
      id: opportunityId,
      ...buildPublicOpportunityWhere({ viewerId: user.id }),
    },
  });
  if (!opportunity) redirect("/app/saved?error=not-found");
  await getPrisma().opportunityBookmark.upsert({
    create: { opportunityId, userId: user.id },
    update: {},
    where: { userId_opportunityId: { opportunityId, userId: user.id } },
  });

  redirect("/app/saved");
}

export async function setOpportunityBookmarkAction(
  opportunityId: string,
  saved: boolean,
) {
  const user = await requireUser();
  if (getResolvedDataMode() === "mock" || !hasDatabaseUrl()) {
    return { error: "Saving is temporarily unavailable." };
  }

  try {
    if (saved) {
      const opportunity = await getPrisma().opportunity.findFirst({
        select: { id: true },
        where: {
          id: opportunityId,
          ...buildPublicOpportunityWhere({ viewerId: user.id }),
        },
      });
      if (!opportunity) {
        return { error: "This opportunity is no longer available." };
      }
      await getPrisma().opportunityBookmark.upsert({
        create: { opportunityId, userId: user.id },
        update: {},
        where: { userId_opportunityId: { opportunityId, userId: user.id } },
      });
    } else {
      await getPrisma().opportunityBookmark.deleteMany({
        where: { opportunityId, userId: user.id },
      });
    }
  } catch {
    return { error: "Saving is temporarily unavailable." };
  }

  revalidatePath("/app");
  revalidatePath("/app/saved");
  return { success: true };
}

export async function reportOpportunityAction(formData: FormData) {
  const user = await requireUser();

  if (getResolvedDataMode() === "mock")
    redirect("/discover?status=reported&mock=true");
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
