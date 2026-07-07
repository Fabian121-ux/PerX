"use server";

import { redirect } from "next/navigation";

import { getPrisma } from "@/lib/db/prisma";
import { hasDatabaseUrl, getResolvedDataMode } from "@/lib/env";
import { writeAuditLog } from "@/lib/logging/audit";
import { parseMoneyToMinor } from "@/lib/money";
import { hasCapability } from "@/lib/permissions/capabilities";
import { requireUser } from "@/lib/auth/session";
import { isLocalTestUser } from "@/lib/dev/test-auth";
import { opportunityFormSchema } from "@/lib/validation/opportunity";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function createOpportunityAction(formData: FormData) {
  const user = await requireUser();
  if (isLocalTestUser(user)) redirect("/market");
  if (!hasCapability(user.roles, "opportunity:create"))
    redirect("/dashboard?error=forbidden");

  if (getResolvedDataMode() === "mock") redirect("/market?mock=true");
  if (!hasDatabaseUrl())
    redirect("/opportunities/new?error=database-not-configured");

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

  if (!parsed.success) redirect("/opportunities/new?error=check-fields");

  const categorySlug = slugify(parsed.data.category);
  const category = await getPrisma().opportunityCategory.upsert({
    where: { slug: categorySlug },
    update: { name: parsed.data.category },
    create: {
      description: `${parsed.data.category} opportunities on perX.`,
      name: parsed.data.category,
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

  redirect("/market");
}

export async function bookmarkOpportunityAction(formData: FormData) {
  const user = await requireUser();
  if (isLocalTestUser(user)) redirect("/saved");
  
  if (getResolvedDataMode() === "mock") redirect("/saved?mock=true");
  if (!hasDatabaseUrl()) redirect("/saved?error=database-not-configured");

  const opportunityId = String(formData.get("opportunityId") ?? "");
  await getPrisma().opportunityBookmark.upsert({
    create: { opportunityId, userId: user.id },
    update: {},
    where: { userId_opportunityId: { opportunityId, userId: user.id } },
  });

  redirect("/saved");
}

export async function reportOpportunityAction(formData: FormData) {
  const user = await requireUser();
  if (isLocalTestUser(user)) redirect("/discover?status=reported");

  if (getResolvedDataMode() === "mock") redirect("/discover?status=reported&mock=true");
  if (!hasDatabaseUrl()) redirect("/discover?error=database-not-configured");

  const opportunityId = String(formData.get("opportunityId") ?? "");
  const reason = String(formData.get("reason") ?? "Safety concern").slice(
    0,
    240,
  );
  await getPrisma().opportunityReport.create({
    data: { opportunityId, reason, reporterId: user.id },
  });
  await writeAuditLog({
    actorId: user.id,
    action: "opportunity.report",
    entityId: opportunityId,
    entityType: "opportunity",
  });
  redirect("/discover?status=reported");
}

