import { AppSection } from "@/components/app-section";
import { getCurrentUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import Link from "next/link";
import { Card, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OpportunityCard } from "@/components/opportunity-card";
import { removeOpportunityBookmarkAction, removeProfileBookmarkAction } from "@/features/saved/actions";
import { BookmarkMinus } from "lucide-react";

export default async function SavedItemsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;

  const resolvedSearchParams = await searchParams;
  const currentTab = resolvedSearchParams.tab || "listings";

  const savedListings = await getPrisma().opportunityBookmark.findMany({
    where: { userId: user.id },
    include: {
      opportunity: {
        include: { owner: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  const savedProfiles = await getPrisma().profileBookmark.findMany({
    where: { userId: user.id },
    include: {
      profile: {
        include: { user: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <AppSection
      title="Saved Items"
      description="Access your bookmarked opportunities and profiles."
    >
      <div className="mb-6 flex gap-4 border-b border-[color:var(--px-border)]">
        <Link
          href="?tab=listings"
          className={`border-b-2 pb-2 text-sm font-semibold transition-colors ${currentTab === "listings" ? "border-[color:var(--px-primary)] text-[color:var(--px-primary)]" : "border-transparent text-[color:var(--px-text-muted)] hover:text-[color:var(--px-text)]"}`}
        >
          Saved Listings ({savedListings.length})
        </Link>
        <Link
          href="?tab=profiles"
          className={`border-b-2 pb-2 text-sm font-semibold transition-colors ${currentTab === "profiles" ? "border-[color:var(--px-primary)] text-[color:var(--px-primary)]" : "border-transparent text-[color:var(--px-text-muted)] hover:text-[color:var(--px-text)]"}`}
        >
          Saved Profiles ({savedProfiles.length})
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {currentTab === "listings" && (
          savedListings.length > 0 ? (
            savedListings.map(bookmark => (
              <div key={bookmark.id} className="relative group">
                <OpportunityCard opportunity={bookmark.opportunity as unknown as Parameters<typeof OpportunityCard>[0]["opportunity"]} />
                <div className="absolute top-4 right-4 z-10 opacity-0 transition-opacity group-hover:opacity-100">
                  <form action={async () => { "use server"; await removeOpportunityBookmarkAction(bookmark.opportunityId); }}>
                    <Button type="submit" variant="secondary" size="sm" className="h-8 gap-2 bg-white hover:bg-rose-50 hover:text-rose-600 shadow-sm border-[color:var(--px-border)]">
                      <BookmarkMinus size={14} /> Unsave
                    </Button>
                  </form>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full">
              <EmptyState title="No saved listings" body="Opportunities you save will appear here." action={<Link href="/app/discover" className="text-sm font-bold text-[color:var(--px-primary)] hover:underline">Discover opportunities</Link>} />
            </div>
          )
        )}

        {currentTab === "profiles" && (
          savedProfiles.length > 0 ? (
            savedProfiles.map(bookmark => (
              <Card key={bookmark.id} className="relative flex flex-col gap-4">
                <Link href={`/u/${bookmark.profile.user.username}`} className="flex items-center gap-4 hover:opacity-80 transition-opacity">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[color:var(--px-primary-soft)] font-bold text-[color:var(--px-primary)] text-lg">
                    {bookmark.profile.user.name[0]}
                  </div>
                  <div>
                    <h3 className="font-semibold text-[color:var(--px-text)]">{bookmark.profile.user.name}</h3>
                    <p className="text-sm text-[color:var(--px-text-muted)]">{bookmark.profile.headline || "PerX Member"}</p>
                    {bookmark.profile.trustScore > 0 && <span className="mt-1 inline-block rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-[color:var(--px-success)]">Trust {bookmark.profile.trustScore}</span>}
                  </div>
                </Link>
                <div className="mt-auto pt-4 border-t border-[color:var(--px-border)] flex justify-end">
                  <form action={async () => { "use server"; await removeProfileBookmarkAction(bookmark.profileId); }}>
                    <Button type="submit" variant="secondary" size="sm" className="gap-2 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200">
                      <BookmarkMinus size={14} /> Remove
                    </Button>
                  </form>
                </div>
              </Card>
            ))
          ) : (
            <div className="col-span-full">
              <EmptyState title="No saved profiles" body="Profiles you save will appear here." action={<Link href="/app/network" className="text-sm font-bold text-[color:var(--px-primary)] hover:underline">Find people</Link>} />
            </div>
          )
        )}
      </div>
    </AppSection>
  );
}
