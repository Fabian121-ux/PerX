import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BrandLogo } from "@/components/brand-logo";
import { FeedPostCard } from "@/components/feed/feed-post-card";
import { SponsoredSlot } from "@/components/sponsored/sponsored-slot";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { getPublicFeedResult } from "@/lib/data/public-feed";
import { AUTHENTICATED_HOME_PATH } from "@/lib/navigation/entry";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Preserve identity-first entry; /app performs its own authoritative check.
  const currentUser = await getCurrentUser().catch(() => null);
  if (currentUser) redirect(AUTHENTICATED_HOME_PATH);

  const { posts, unavailable } = await getPublicFeedResult();
  return (
    <div className="min-h-dvh min-w-0 bg-[color:var(--px-page)]">
      <header className="sticky top-0 z-30 border-b border-[color:var(--px-border)] bg-[color:var(--px-surface)]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[640px] items-center justify-between gap-2 px-3 sm:px-4">
          <Link href="/" aria-label="PtahX home">
            <BrandLogo className="h-9" />
          </Link>
          <nav
            aria-label="Account"
            className="flex shrink-0 items-center gap-1"
          >
            <ButtonLink href="/sign-in" variant="ghost" size="sm">
              Sign in
            </ButtonLink>
            <ButtonLink href="/sign-up" size="sm">
              Sign up
            </ButtonLink>
          </nav>
        </div>
      </header>
      <main
        className="mx-auto grid min-w-0 max-w-[640px] gap-4 px-2 py-4 sm:px-4"
        aria-label="Public feed"
      >
        <h1 className="sr-only">Public feed</h1>
        {unavailable ? (
          <EmptyState
            title="Public feed temporarily unavailable"
            body="Please try again shortly."
          />
        ) : posts.length ? (
          <>
            {posts.map((post, position) => (
              <Fragment key={post.id}>
                <FeedPostCard
                  audience="public"
                  post={post}
                  position={position}
                />
                {position === 2 && <SponsoredSlot limit={1} />}
              </Fragment>
            ))}
            <ButtonLink href="/discover" variant="secondary">
              Explore more opportunities
            </ButtonLink>
          </>
        ) : (
          <EmptyState
            title="No public posts yet"
            body="Sign in or create an account to start building the PtahX ecosystem."
          />
        )}
      </main>
      <footer className="mx-auto flex max-w-[640px] flex-wrap justify-center gap-x-4 gap-y-2 px-4 py-6 text-xs text-[color:var(--px-text-muted)]">
        {[
          ["About", "/about"],
          ["How it works", "/how-it-works"],
          ["Trust & safety", "/trust-safety"],
          ["Help", "/help"],
          ["Privacy", "/privacy"],
          ["Terms", "/terms"],
        ].map(([label, href]) => (
          <Link className="hover:underline" href={href} key={href}>
            {label}
          </Link>
        ))}
      </footer>
    </div>
  );
}
