import { AdminSection } from "@/components/admin-section";
import { Card } from "@/components/ui/card";

export default function AdminModerationPage() {
  return (
    <AdminSection description="Moderation actions must be authorised, logged, and linked to the affected entity." title="Moderation actions">
      <Card>
        <p className="text-sm leading-6 text-slate-700">The schema supports persisted moderation actions for users, profiles, opportunities, reports, reviews, and disputes.</p>
      </Card>
    </AdminSection>
  );
}
