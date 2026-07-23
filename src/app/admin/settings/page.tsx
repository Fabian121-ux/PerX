import { AdminSection } from "@/components/admin-section";
import { Card } from "@/components/ui/card";
import { getSignupConfig } from "@/lib/env";

export default function AdminSettingsPage() {
  const signup = getSignupConfig();

  return (
    <AdminSection
      description="Review production-facing configuration that is safe to display in the admin interface."
      title="Admin settings"
    >
      <Card>
        <h2 className="font-bold text-[color:var(--px-text)]">Registration</h2>
        <dl className="mt-4 grid gap-3 text-sm">
          <div>
            <dt className="font-semibold text-[color:var(--px-text-muted)]">Mode</dt>
            <dd className="text-[color:var(--px-text)]">{signup.mode}</dd>
          </div>
          <div>
            <dt className="font-semibold text-[color:var(--px-text-muted)]">Open beta capacity</dt>
            <dd className="text-[color:var(--px-text)]">
              {signup.maximumUsers === null ? "Unlimited for current mode" : signup.maximumUsers}
            </dd>
          </div>
        </dl>
      </Card>
    </AdminSection>
  );
}
