import { AlertTriangle, ClipboardCheck, ShieldCheck } from "lucide-react";

import { AppSection, MetricGrid } from "@/components/app-section";
import { Card } from "@/components/ui/card";

const queues = [
  { label: "Verification requests", value: "12", detail: "Identity and profile evidence awaiting review" },
  { label: "Opportunity reports", value: "5", detail: "Fictional reports queued for moderation review" },
  { label: "Open disputes", value: "2", detail: "Simulated deal disputes with evidence required" },
  { label: "Audit events", value: "148", detail: "Protected actions recorded in demo activity" },
];

export default function PreviewAdminPage() {
  return (
    <AppSection
      description="Restricted Demo Admin previews moderation, verification, reports and audit activity without enabling destructive actions."
      title="Restricted Demo Admin"
    >
      <MetricGrid items={queues} />
      <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <Card className="grid gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-[var(--px-radius-sm)] bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)]">
              <ClipboardCheck aria-hidden size={18} />
            </span>
            <div>
              <h2 className="font-bold text-[color:var(--px-text)]">Moderation queue</h2>
              <p className="text-sm text-[color:var(--px-text-muted)]">Demo actions are review-only and cannot mutate production records.</p>
            </div>
          </div>
          {["Review reported opportunity", "Check profile verification", "Assess escrow dispute evidence"].map((item, index) => (
            <div className="flex items-center justify-between gap-3 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-3" key={item}>
              <span className="text-sm font-semibold text-[color:var(--px-text)]">{item}</span>
              <span className="rounded-full bg-[color:var(--px-primary-soft)] px-3 py-1 text-xs font-bold text-[color:var(--px-primary)]">
                {index === 0 ? "High" : "Review"}
              </span>
            </div>
          ))}
        </Card>
        <Card className="grid gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-[var(--px-radius-sm)] bg-amber-500/15 text-amber-500">
              <AlertTriangle aria-hidden size={18} />
            </span>
            <div>
              <h2 className="font-bold text-[color:var(--px-text)]">Demo safety</h2>
              <p className="text-sm text-[color:var(--px-text-muted)]">Sensitive admin operations are disabled or simulated in Preview Mode.</p>
            </div>
          </div>
          <div className="rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-muted)] p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-[color:var(--px-text)]">
              <ShieldCheck aria-hidden className="text-[color:var(--px-primary)]" size={17} />
              Audit-safe preview
            </div>
            <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
              This screen demonstrates the admin visual system while preserving real `/admin` authorisation checks.
            </p>
          </div>
        </Card>
      </div>
    </AppSection>
  );
}
