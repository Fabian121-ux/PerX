import Link from "next/link";

import { AdminSection } from "@/components/admin-section";
import { Card, EmptyState } from "@/components/ui/card";
import { getPrisma } from "@/lib/db/prisma";

export default async function AdminModerationPage() {
  const [
    messageCases,
    listingCases,
    dealDisputes,
    verificationRequests,
    openReports,
    appealedCases,
  ] = await Promise.all([
    getPrisma().moderationCase.count({
      where: { conversationId: { not: null }, status: { notIn: ["RESOLVED", "DISMISSED", "CLOSED"] } },
    }),
    getPrisma().moderationCase.count({
      where: { source: "LISTING_REPORT", status: { notIn: ["RESOLVED", "DISMISSED", "CLOSED"] } },
    }),
    getPrisma().dispute.count({ where: { status: { not: "RESOLVED" } } }),
    getPrisma().verificationRequest.count({ where: { status: "PENDING" } }),
    getPrisma().userReport.count({ where: { status: { in: ["SUBMITTED", "IN_REVIEW"] } } }),
    getPrisma().moderationCase.count({ where: { status: "APPEALED" } }),
  ]);

  const queues = [
    {
      detail: "Reports and policy-triggered cases with conversation context.",
      href: "/admin/messages",
      label: "Message cases",
      value: messageCases,
    },
    {
      detail: "User reports for listings and public user-generated content.",
      href: "/admin/reports",
      label: "Listing and content reports",
      value: listingCases + openReports,
    },
    {
      detail: "Open deal disputes and simulated deal workflow concerns.",
      href: "/admin/deals",
      label: "Deal disputes",
      value: dealDisputes,
    },
    {
      detail: "Profile, business, and property verification reviews.",
      href: "/admin/verification",
      label: "Verification reviews",
      value: verificationRequests,
    },
    {
      detail: "Appeals that need separate reviewer attention.",
      href: "/admin/reports",
      label: "Appeals",
      value: appealedCases,
    },
  ];

  return (
    <AdminSection
      description="Route real moderation work to cases, reports, disputes, and verification reviews."
      title="Moderation"
    >
      {queues.some((queue) => queue.value > 0) ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {queues.map((queue) => (
            <Link className="block" href={queue.href} key={queue.label}>
              <Card className="h-full transition hover:border-[color:var(--px-primary)]">
                <p className="text-sm font-semibold text-[color:var(--px-text-muted)]">
                  {queue.label}
                </p>
                <p className="mt-2 text-3xl font-black text-[color:var(--px-text)]">
                  {queue.value}
                </p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
                  {queue.detail}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          body="New reports, disputes, appeals, and verification reviews will appear here."
          title="No active moderation queues"
        />
      )}
    </AdminSection>
  );
}
