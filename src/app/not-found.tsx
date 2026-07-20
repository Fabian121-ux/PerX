import { SearchX } from "lucide-react";

import { PublicPageShell } from "@/components/standard-page";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <PublicPageShell>
      <main className="mx-auto grid min-h-[calc(100dvh-4.5rem)] max-w-3xl place-items-center px-4 py-16 text-center sm:px-6 lg:px-8">
        <section>
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-[color:var(--px-surface-soft)] text-[color:var(--px-primary)]">
            <SearchX aria-hidden size={28} />
          </div>
          <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-[color:var(--px-primary)]">
            Page not found
          </p>
          <h1 className="mt-3 text-4xl font-black text-[color:var(--px-text)]">
            This PerX page is not available
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[color:var(--px-text-muted)]">
            The link may be outdated, private, or still being prepared for beta.
            You can return home or continue exploring available opportunities.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/">Go home</ButtonLink>
            <ButtonLink href="/discover" variant="secondary">
              Explore discover
            </ButtonLink>
          </div>
        </section>
      </main>
    </PublicPageShell>
  );
}
