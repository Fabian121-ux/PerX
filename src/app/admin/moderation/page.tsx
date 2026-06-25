import { AdminSection } from "@/components/admin-section";
import { Card } from "@/components/ui/card";

const queues = [
  { label: "Opportunity reviews", value: "12", detail: "Pending content and ownership checks" },
  { label: "Profile reports", value: "4", detail: "Identity, impersonation and safety flags" },
  { label: "Deal disputes", value: "3", detail: "Escrow state and delivery disagreements" },
  { label: "Verification requests", value: "8", detail: "Documents and business verification" },
];

export default function AdminModerationPage() {
  return (
    <AdminSection description="Review moderation queues and route issues to the correct admin workflow." title="Moderation">
      <div className="grid gap-4 md:grid-cols-2">
        {queues.map((queue) => (
          <Card key={queue.label}>
            <p className="text-sm font-semibold text-[color:var(--px-text-muted)]">{queue.label}</p>
            <p className="mt-2 text-3xl font-black text-[color:var(--px-text)]">{queue.value}</p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">{queue.detail}</p>
          </Card>
        ))}
      </div>
    </AdminSection>
  );
}
