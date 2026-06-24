import { AdminSection } from "@/components/admin-section";
import { MetricGrid } from "@/components/app-section";
import { getAdminMetrics } from "@/lib/data/admin";

export default async function AdminDashboardPage() {
  const metrics = await getAdminMetrics();

  return (
    <AdminSection description="Monitor platform activity, moderation queues, trust, disputes, and audit trails." title="Admin dashboard">
      <MetricGrid
        items={[
          { detail: "Registered accounts", label: "Users", value: metrics.users },
          { detail: "All opportunity states", label: "Opportunities", value: metrics.opportunities },
          { detail: "Open opportunity reports", label: "Reports", value: metrics.reports },
          { detail: "Recorded audit events", label: "Audit logs", value: metrics.auditLogs },
        ]}
      />
    </AdminSection>
  );
}
