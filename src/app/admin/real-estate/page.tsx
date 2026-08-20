import { AdminSection } from "@/components/admin-section";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Textarea } from "@/components/ui/form";
import { reviewPropertyListingAction } from "@/features/admin/actions";
import { requireCapabilityOrNotFound } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function AdminRealEstatePage() {
  await requireCapabilityOrNotFound("opportunity:moderate");
  const listings = await getPrisma().opportunity.findMany({
    select: {
      _count: { select: { reports: true } },
      authorityDeclaration: true,
      id: true,
      images: {
        orderBy: [{ isCover: "desc" }, { createdAt: "asc" }],
        select: { createdAt: true, isCover: true, url: true },
      },
      moderationStatus: true,
      owner: { select: { id: true, name: true, username: true } },
      propertyVerificationState: true,
      status: true,
      title: true,
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 50,
    where: { type: "PROPERTY" },
  });

  return (
    <AdminSection
      description="Legacy PROPERTY listings. This vertical is retired for members and no new listings can be created, but existing records still require moderation."
      title="Property review (legacy)"
    >
      {listings.length ? (
        <div className="grid gap-4">
          {listings.map((listing) => {
            const cover = listing.images.find((image) => image.isCover) ?? listing.images[0];
            return (
              <Card className="bg-white text-slate-950" key={listing.id}>
                <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
                  <div className="h-36 overflow-hidden rounded-[var(--px-radius-sm)] bg-slate-100">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" className="h-full w-full object-cover" src={cover.url} />
                    ) : (
                      <div className="grid h-full place-items-center px-3 text-center text-xs font-semibold text-slate-500">
                        No cover image
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                      <span>{listing.status}</span>
                      <span>{listing.moderationStatus}</span>
                      <span>{listing.propertyVerificationState ?? "DRAFT"}</span>
                      <span>{listing._count.reports} report(s)</span>
                    </div>
                    <h2 className="mt-2 truncate text-lg font-black">
                      {listing.title}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Owner: {listing.owner.name} (@{listing.owner.username})
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                      {listing.authorityDeclaration || "No authority declaration provided."}
                    </p>
                  </div>
                </div>
                <form action={reviewPropertyListingAction} className="mt-4 grid gap-3">
                  <input name="opportunityId" type="hidden" value={listing.id} />
                  <label className="grid gap-2 text-sm font-semibold">
                    Review reason
                    <Textarea
                      name="reason"
                      placeholder="Record the reason for this review decision."
                      required
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button name="decision" size="sm" type="submit" value="approve">
                      Approve
                    </Button>
                    <Button name="decision" size="sm" type="submit" value="request_info" variant="secondary">
                      Request info
                    </Button>
                    <Button name="decision" size="sm" type="submit" value="reject" variant="secondary">
                      Reject
                    </Button>
                    <Button name="decision" size="sm" type="submit" value="pause" variant="secondary">
                      Pause
                    </Button>
                    <Button name="decision" size="sm" type="submit" value="restore" variant="secondary">
                      Restore private
                    </Button>
                  </div>
                </form>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          body="Property drafts and review submissions will appear here."
          title="No property listings"
        />
      )}
    </AdminSection>
  );
}
