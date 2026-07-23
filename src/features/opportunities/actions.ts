"use server";

import { redirect } from "next/navigation";

import { getPrisma } from "@/lib/db/prisma";
import { hasDatabaseUrl, getResolvedDataMode } from "@/lib/env";
import { writeAuditLog } from "@/lib/logging/audit";
import { parseMoneyToMinor } from "@/lib/money";
import {
  findOption,
  opportunityCategoryOptions,
  reportReasonOptions,
} from "@/lib/options";
import { hasCapability } from "@/lib/permissions/capabilities";
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
    remote: formData.get("remote") === "on",
    skills: formData.get("skills"),
    summary: formData.get("summary"),
    title: formData.get("title"),
    type: formData.get("type"),
  });

  if (!parsed.success) redirect("/app/opportunities/new?error=check-fields");

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
  const status = parsed.data.intent === "publish" ? "PUBLISHED" : "DRAFT";
  const slug = `${slugify(parsed.data.title)}-${Date.now().toString(36)}`;

  const opportunity = await getPrisma().opportunity.create({
    data: {
      budgetMaxMinor: budgetMax?.amountMinor,
      budgetMinMinor: budgetMin?.amountMinor,
      categoryId: category.id,
      currency,
      description: parsed.data.description,
      location: parsed.data.location,
      moderationStatus: status === "PUBLISHED" ? "PENDING" : "PENDING",
      ownerId: user.id,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
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

  redirect("/app/opportunities");
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
