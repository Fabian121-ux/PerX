import { AdminSection } from "@/components/admin-section";
import { Card } from "@/components/ui/card";

export default function AdminActivityPage() {
  return (
    <AdminSection description="Platform activity aggregates operational signals from users, opportunities, proposals, deals, reviews, and moderation." title="Platform activity">
      <Card>
        <p className="text-sm leading-6 text-slate-700">Activity analytics hooks are ready for event aggregation after the core MVP workflows are stable.</p>
      </Card>
    </AdminSection>
  );
}
