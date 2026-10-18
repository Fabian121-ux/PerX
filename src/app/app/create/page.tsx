import Link from "next/link";

import { createOptions } from "@/lib/navigation/create-options";
import { requireUser } from "@/lib/auth/session";

export default async function CreateHub() {
  await requireUser();
  return (
    <main className="mx-auto w-full max-w-[640px] pb-12">
      <header className="mb-5 rounded-3xl bg-[linear-gradient(140deg,var(--px-navy),var(--px-navy-3))] p-6 text-white">
        <p className="text-xs font-black uppercase tracking-[0.17em] text-white/70">Create on PtahX</p>
        <h1 className="mt-2 text-2xl font-black">What would you like to share?</h1>
        <p className="mt-2 text-sm leading-6 text-white/80">Post an update or create an opportunity for others to discover.</p>
      </header>
      <div className="grid gap-3">
        {createOptions.map((option) => {
          const Icon = option.icon;
          return (
            <Link key={option.href} href={option.href} className="flex min-h-20 items-center gap-4 rounded-2xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] p-4 text-[color:var(--px-text)] shadow-sm transition hover:border-[color:var(--px-primary)] hover:bg-[color:var(--px-primary-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)]"><Icon aria-hidden size={22} /></span>
              <span className="min-w-0">
                <span className="block font-black">{option.label}</span>
                <span className="mt-1 block text-sm text-[color:var(--px-text-muted)]">{option.description}</span>
              </span>
            </Link>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-[color:var(--px-text-muted)]">All members can post community updates. Business listings may require trader access.</p>
    </main>
  );
}
