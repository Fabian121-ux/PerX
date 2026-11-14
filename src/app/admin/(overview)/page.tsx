import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { AdminSection } from "@/components/admin-section";
import { Card } from "@/components/ui/card";
import { getAdminMetrics } from "@/lib/data/admin";
import { requireCapabilityOrNotFound } from "@/lib/auth/session";
import { hasCapability, type Capability } from "@/lib/permissions/capabilities";

const metricLinks: Array<{
  detail: string;
  href: string;
  label: string;
  capability: Capability;
  valueKey: "users" | "opportunities" | "reports" | "reviews" | "disputes" | "verification" | "auditLogs";
}> = [
  { label: "Users", detail: "Registered accounts", href: "/admin/users", capability: "users:read", valueKey: "users" },
  { label: "Opportunities", detail: "All listing states", href: "/admin/opportunities", capability: "opportunity:moderate", valueKey: "opportunities" },
  { label: "Reports", detail: "Open opportunity reports", href: "/admin/reports", capability: "reports:review", valueKey: "reports" },
  { label: "Reviews", detail: "Published and pending reviews", href: "/admin/reviews", capability: "reports:review", valueKey: "reviews" },
  { label: "Disputes", detail: "All recorded disputes", href: "/admin/disputes", capability: "deals:review", valueKey: "disputes" },
  { label: "Verification", detail: "Pending verification requests", href: "/admin/verification", capability: "admin:moderate", valueKey: "verification" },
  { label: "Audit logs", detail: "Recorded administrative events", href: "/admin/audit", capability: "audit:read", valueKey: "auditLogs" },
];

type AdminMetrics = Record<(typeof metricLinks)[number]["valueKey"], number>;

export default async function AdminDashboardPage() {
  const admin = await requireCapabilityOrNotFound("admin:access");
  const metrics = (await getAdminMetrics()) as AdminMetrics;
  const visibleMetrics = metricLinks.filter((item) =>
    hasCapability(admin.roles, item.capability),
  );

  return (
    <AdminSection
      description="A live overview of platform operations. Select a metric to open its corresponding admin workspace."
      title="Admin dashboard"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visibleMetrics.map((item) => (
          <Link
            aria-label={`${item.label}: ${metrics[item.valueKey]}. Open ${item.label.toLowerCase()}`}
            className="group rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            href={item.href}
            key={item.valueKey}
          >
            <Card
              as="article"
              className="h-full border-white/10 bg-slate-900/80 transition duration-200 group-hover:-translate-y-0.5 group-hover:border-cyan-300/30 group-hover:bg-slate-900 group-focus-visible:border-cyan-300"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-300">{item.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
                </div>
                <ArrowUpRight
                  aria-hidden="true"
                  className="shrink-0 text-slate-500 transition group-hover:text-cyan-200"
                  size={18}
                />
              </div>
              <p className="mt-5 text-3xl font-black tracking-tight text-white">
                {metrics[item.valueKey].toLocaleString()}
              </p>
              <p className="mt-2 text-xs font-semibold text-cyan-200/80">
                Open workspace
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </AdminSection>
  );
}
