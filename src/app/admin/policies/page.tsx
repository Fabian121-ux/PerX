import { AdminSection } from "@/components/admin-section";
import { Card } from "@/components/ui/card";
import { policyCategories, policyOutcomes } from "@/lib/policy/enforcement";

export default function AdminPoliciesPage() {
  return (
    <AdminSection
      description="Inspect the central policy categories and outcomes used by server-side content checks."
      title="Policies"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-bold text-[color:var(--px-text)]">Outcomes</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {policyOutcomes.map((outcome) => (
              <span
                className="rounded-full bg-[color:var(--px-primary-soft)] px-3 py-1 text-xs font-bold text-[color:var(--px-primary)]"
                key={outcome}
              >
                {outcome}
              </span>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="font-bold text-[color:var(--px-text)]">Categories</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {policyCategories.map((category) => (
              <span
                className="rounded-full bg-[color:var(--px-muted)] px-3 py-1 text-xs font-semibold text-[color:var(--px-text-muted)]"
                key={category}
              >
                {category.replaceAll("_", " ")}
              </span>
            ))}
          </div>
        </Card>
      </div>
    </AdminSection>
  );
}
