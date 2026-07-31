import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import type { FeatureDefinition } from "@/lib/navigation/feature-registry";

export function FeatureResultCard({ feature }: { feature: FeatureDefinition }) {
  const Icon = feature.icon;

  return (
    <Card className="min-h-full p-0">
      <Link
        className="group flex min-h-full items-start gap-4 rounded-[var(--px-radius)] p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
        href={feature.href}
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)]">
          <Icon aria-hidden size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-black text-[color:var(--px-text)] group-hover:text-[color:var(--px-primary)]">
              {feature.label}
            </span>
            {feature.status ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                  feature.status.kind === "simulated"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)]"
                }`}
              >
                {feature.status.label}
              </span>
            ) : null}
          </span>
          <span className="mt-1.5 block text-sm leading-6 text-[color:var(--px-text-muted)]">
            {feature.description}
          </span>
        </span>
        <ArrowUpRight
          aria-hidden
          className="mt-1 shrink-0 text-[color:var(--px-text-muted)] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[color:var(--px-primary)]"
          size={17}
        />
      </Link>
    </Card>
  );
}
