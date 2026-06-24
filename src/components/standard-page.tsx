import type { ReactNode } from "react";

import { SiteHeader } from "@/components/layout/site-header";

export function PublicPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-slate-50">
      <SiteHeader />
      {children}
    </div>
  );
}

export function StandardInfoPage({
  eyebrow,
  sections,
  title,
}: {
  eyebrow: string;
  title: string;
  sections: { heading: string; body: string }[];
}) {
  return (
    <PublicPageShell>
      <main>
        <section className="prex-hero border-b border-[color:var(--px-border)] text-white">
          <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-[color:var(--px-gold)]">{eyebrow}</p>
            <h1 className="mt-3 text-4xl font-bold tracking-normal text-white">{title}</h1>
          </div>
        </section>
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-5">
          {sections.map((section) => (
            <section className="prex-card p-6" key={section.heading}>
              <h2 className="text-xl font-semibold text-[color:var(--px-text)]">{section.heading}</h2>
              <p className="mt-3 text-sm leading-7 text-[color:var(--px-text-muted)]">{section.body}</p>
            </section>
          ))}
          </div>
        </div>
      </main>
    </PublicPageShell>
  );
}
