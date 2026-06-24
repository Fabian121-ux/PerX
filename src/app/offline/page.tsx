import { BrandLogo } from "@/components/brand-logo";
import { ButtonLink } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50 px-4">
      <div className="prex-card max-w-md p-8 text-center">
        <BrandLogo className="mx-auto h-11" />
        <p className="mt-8 text-sm font-semibold uppercase tracking-wide text-[color:var(--px-primary)]">Offline</p>
        <h1 className="mt-3 text-3xl font-bold text-[color:var(--px-text)]">perX is not connected</h1>
        <p className="mt-3 text-sm leading-6 text-[color:var(--px-text-muted)]">
          Public shell assets are available offline. Private messages, deals, admin data, and mutations are intentionally not cached.
        </p>
        <ButtonLink className="mt-6" href="/">
          Return home
        </ButtonLink>
      </div>
    </main>
  );
}
