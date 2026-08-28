"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireCapabilityOrNotFound, requireUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { hasDatabaseUrl } from "@/lib/env";
import { opportunityCategoryOptions } from "@/lib/options";
import { TRADER_GRANT_ROLE } from "@/lib/trader/access";

export type TraderApplicationFormState = {
  fieldErrors?: Record<string, string>;
  message?: string;
  status: "error" | "idle";
};

/**
 * Kept short on purpose.
 *
 * Four answers, none of them sensitive. There is no verification requirement in
 * the product that would justify collecting identity documents, so none are
 * requested - the decision is a human review of stated intent.
 */
const applicationSchema = z.object({
  applicantKind: z.enum(["INDIVIDUAL", "BUSINESS"]),
  experience: z
    .string()
    .trim()
    .min(30, "Tell us a little more - at least 30 characters.")
    .max(600),
  headline: z
    .string()
    .trim()
    .min(10, "Describe what you want to trade in at least 10 characters.")
    .max(140),
  tradeCategory: z
    .string()
    .trim()
    .refine(
      (value) =>
        opportunityCategoryOptions.some((option) => option.value === value),
      "Choose a category from the list.",
    ),
});

function fieldErrorsFromIssues(error: {
  issues: { message: string; path: PropertyKey[] }[];
}) {
  return error.issues.reduce<Record<string, string>>((errors, issue) => {
    const field = issue.path[0];
    if (typeof field === "string" && !errors[field]) {
      errors[field] = issue.message;
    }
    return errors;
  }, {});
}

/**
 * Submit or re-submit a trading access application.
 *
 * Upserts on `userId`: re-applying after `NEEDS_CHANGES` updates the existing
 * record so one review thread is preserved rather than accumulating duplicates.
 *
 * Approval is never automatic. This only moves the application to
 * `PENDING_REVIEW`; the capability is granted by an authorized reviewer in
 * `decideTraderApplicationAction`.
 */
export async function submitTraderApplicationAction(
  _previous: TraderApplicationFormState,
  formData: FormData,
): Promise<TraderApplicationFormState> {
  const user = await requireUser();
  if (!hasDatabaseUrl()) {
    return {
      message: "Applications are temporarily unavailable. Please try again.",
      status: "error",
    };
  }

  const parsed = applicationSchema.safeParse({
    applicantKind: formData.get("applicantKind"),
    experience: formData.get("experience"),
    headline: formData.get("headline"),
    tradeCategory: formData.get("tradeCategory"),
  });

  if (!parsed.success) {
    const fieldErrors = fieldErrorsFromIssues(parsed.error);
    const count = Object.keys(fieldErrors).length;
    return {
      fieldErrors,
      message:
        count === 1
          ? "We could not send this yet. 1 answer needs your attention."
          : `We could not send this yet. ${count} answers need your attention.`,
      status: "error",
    };
  }

  const existing = await getPrisma().traderApplication.findUnique({
    select: { status: true },
    where: { userId: user.id },
  });

  // An approved account re-submitting would otherwise silently revoke its own
  // access by moving the row back to PENDING_REVIEW.
  if (existing?.status === "APPROVED") {
    redirect("/app/trader?status=already-approved");
  }
  if (existing?.status === "SUSPENDED") {
    return {
      message:
        "Trading access is suspended on this account. Contact support to appeal.",
      status: "error",
    };
  }

  const now = new Date();
  await getPrisma().traderApplication.upsert({
    create: {
      applicantKind: parsed.data.applicantKind,
      experience: parsed.data.experience,
      headline: parsed.data.headline,
      status: "PENDING_REVIEW",
      submittedAt: now,
      tradeCategory: parsed.data.tradeCategory,
      userId: user.id,
    },
    update: {
      applicantKind: parsed.data.applicantKind,
      decidedAt: null,
      experience: parsed.data.experience,
      headline: parsed.data.headline,
      // Cleared so a returned application does not keep showing the previous
      // reviewer's note as if it were a fresh decision.
      reviewerNote: null,
      status: "PENDING_REVIEW",
      submittedAt: now,
      tradeCategory: parsed.data.tradeCategory,
    },
    where: { userId: user.id },
  });

  revalidatePath("/app/trader");
  redirect("/app/trader?status=submitted");
}

const decisionSchema = z.object({
  applicationId: z.string().min(1),
  decision: z.enum(["APPROVED", "NEEDS_CHANGES", "REJECTED", "SUSPENDED"]),
  reviewerNote: z.string().trim().max(600).optional(),
});

/**
 * Record a reviewer decision and, on approval, grant the capability.
 *
 * Gated on `users:manage` - the same capability that governs other account-level
 * administrative changes. Everything happens in one transaction so an approval
 * can never be recorded without the role that makes it meaningful, and the audit
 * row is written alongside rather than through the lossy `writeAuditLog`.
 */
export async function decideTraderApplicationAction(formData: FormData) {
  const admin = await requireCapabilityOrNotFound("users:manage");

  const parsed = decisionSchema.safeParse({
    applicationId: formData.get("applicationId"),
    decision: formData.get("decision"),
    reviewerNote: formData.get("reviewerNote") ?? undefined,
  });
  if (!parsed.success) throw new Error("Choose a decision to record.");

  const application = await getPrisma().traderApplication.findUnique({
    select: { id: true, status: true, userId: true },
    where: { id: parsed.data.applicationId },
  });
  if (!application) throw new Error("That application is unavailable.");

  await getPrisma().$transaction(async (tx) => {
    await tx.traderApplication.update({
      data: {
        decidedAt: new Date(),
        reviewerId: admin.id,
        reviewerNote: parsed.data.reviewerNote || null,
        status: parsed.data.decision,
      },
      where: { id: application.id },
    });

    if (parsed.data.decision === "APPROVED") {
      const role = await tx.role.upsert({
        create: {
          description: `${TRADER_GRANT_ROLE} capability set.`,
          label: TRADER_GRANT_ROLE.toLowerCase().replaceAll("_", " "),
          name: TRADER_GRANT_ROLE,
        },
        update: {},
        where: { name: TRADER_GRANT_ROLE },
      });
      // Idempotent: approving twice must not violate the composite unique.
      await tx.userRole.createMany({
        data: [{ roleId: role.id, userId: application.userId }],
        skipDuplicates: true,
      });
    }

    if (
      parsed.data.decision === "REJECTED" ||
      parsed.data.decision === "SUSPENDED"
    ) {
      /*
        Withdraw the granted role so creation stops at the next request - the
        server is the authority, not any client flag.

        Existing listings and deals are deliberately untouched. Losing the
        ability to publish is not a reason to destroy work that was legitimately
        created, or records a counterparty depends on.
      */
      await tx.userRole.deleteMany({
        where: {
          role: { name: TRADER_GRANT_ROLE },
          userId: application.userId,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        action: `admin.trader_application.${parsed.data.decision.toLowerCase()}`,
        actorId: admin.id,
        entityId: application.userId,
        entityType: "user",
        metadata: { applicationId: application.id },
      },
    });
  });

  revalidatePath("/admin/trader-applications");
  revalidatePath("/app/trader");
}
