import { SocialFeedStream } from "@/components/social/social-feed-stream";
import { getSocialFeedResult } from "@/lib/data/social-posts";
import { Fragment } from "react";
import { Search } from "lucide-react";
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

  const [{ posts, unavailable }, social] = await Promise.all([
    getPublicFeedResult(),
    getSocialFeedResult(),
  ]);
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
      <div className="border-b border-[color:var(--px-border)] bg-[linear-gradient(130deg,var(--px-navy),var(--px-navy-3))] px-3 py-3 sm:px-4">
        <Link className="mx-auto flex min-h-12 max-w-[608px] items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-4 text-sm text-white/85 transition hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white" href="/discover">
          <Search aria-hidden size={19} />
          <span className="truncate">Search opportunities, services and people</span>
        </Link>
      </div>
      <main
        className="mx-auto grid min-w-0 max-w-[640px] gap-4 px-2 py-4 sm:px-4"
        aria-label="Public feed"
      >
        <h1 className="px-2 text-xl font-black text-[color:var(--px-text)]">Latest updates</h1>
        {social.items.length ? (
          <SocialFeedStream initialItems={social.items} initialNextCursor={social.nextCursor} />
        ) : null}
        {social.unavailable && (
          <p role="status">Community posts are temporarily unavailable.</p>
        )}
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
        ) : !social.items.length && !social.unavailable ? (
          <EmptyState
            title="No public posts yet"
            body="Sign in or create an account to start building the PtahX ecosystem."
          />
        ) : null}
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
