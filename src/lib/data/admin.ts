import { getPrisma } from "@/lib/db/prisma";
import { hasDatabaseUrl } from "@/lib/env";

export async function getAdminMetrics() {
  if (!hasDatabaseUrl()) {
    return {
      auditLogs: 0,
      disputes: 0,
      opportunities: 0,
      reports: 0,
      reviews: 0,
      users: 0,
      verification: 0,
    };
  }

  const [users, opportunities, reports, reviews, disputes, verification, auditLogs] = await Promise.all([
    getPrisma().user.count(),
    getPrisma().opportunity.count(),
    getPrisma().opportunityReport.count({ where: { status: "OPEN" } }),
    getPrisma().review.count(),
    getPrisma().dispute.count(),
    getPrisma().verificationRequest.count({ where: { status: "PENDING" } }),
    getPrisma().auditLog.count(),
  ]);

  return { auditLogs, disputes, opportunities, reports, reviews, users, verification };
}

export async function getAdminList(kind: "users" | "profiles" | "opportunities" | "reports" | "reviews" | "disputes" | "verification" | "audit") {
  if (!hasDatabaseUrl()) return [];

  switch (kind) {
    case "users":
      return getPrisma().user.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
    case "profiles":
      return getPrisma().profile.findMany({ include: { user: true }, orderBy: { updatedAt: "desc" }, take: 20 });
    case "opportunities":
      return getPrisma().opportunity.findMany({ include: { owner: true }, orderBy: { updatedAt: "desc" }, take: 20 });
    case "reports":
      return getPrisma().opportunityReport.findMany({ include: { opportunity: true, reporter: true }, orderBy: { createdAt: "desc" }, take: 20 });
    case "reviews":
      return getPrisma().review.findMany({ include: { author: true, subject: true }, orderBy: { createdAt: "desc" }, take: 20 });
    case "disputes":
      return getPrisma().dispute.findMany({ include: { openedBy: true }, orderBy: { createdAt: "desc" }, take: 20 });
    case "verification":
      return getPrisma().verificationRequest.findMany({ include: { profile: { include: { user: true } } }, orderBy: { createdAt: "desc" }, take: 20 });
    case "audit":
      return getPrisma().auditLog.findMany({ include: { actor: true }, orderBy: { createdAt: "desc" }, take: 30 });
  }
}
