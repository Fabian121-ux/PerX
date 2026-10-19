import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  MapPinOff,
  MessageSquare,
  PackageCheck,
  Truck,
} from "lucide-react";

import { AppSection } from "@/components/app-section";
import { CursorPagination } from "@/components/cursor-pagination";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getUserDealsPage } from "@/lib/data/app";

/**
 * This route deliberately reuses the participant-authorized agreement query.
 * Deal deliveries are milestone submissions, NOT physical parcel GPS events.
 * There is no Order/Shipment/ShipmentLocation schema or courier connection yet,
 * so a moving pin or "in transit" status would mislead buyers.
 */
type TrackedAgreement = {
  id: string;
  status: string;
  proposal: { opportunity: { title: string; type: string } };
  statusHistory: { id: string; toStatus: string; createdAt: Date }[];
};

function statusLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

export default async function TrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const user = await requireUser();
  const { cursor } = await searchParams;
  const page = await getUserDealsPage(user.id, { cursor, pageSize: 20 });
  const agreements = page.items as TrackedAgreement[];

  return (
    <AppSection
      title="Tracking centre"
      description="Check progress on agreements you are part of. Courier parcel tracking is not connected yet."
      actions={<ButtonLink href="/app/messages" variant="secondary"><MessageSquare aria-hidden size={16} className="mr-2" />Open messages</ButtonLink>}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          <Card className="border-blue-200 bg-[color:var(--px-surface)]">
            <div className="flex items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[color:var(--px-primary-soft)] text-[color:var(--px-primary)]">
                <Truck aria-hidden size={23} />
              </span>
              <div>
                <h2 className="text-lg font-black text-[color:var(--px-text)]">Your agreements and deliveries</h2>
                <p className="mt-1 text-sm leading-6 text-[color:var(--px-text-muted)]">
                  You can check deal milestones and submitted delivery records here. These records show work agreed or submitted, not the location of a physical package.
                </p>
              </div>
            </div>
          </Card>

          {agreements.length ? (
            <div className="grid gap-3">
              {agreements.map((deal) => {
                const latest = deal.statusHistory?.[0];
                const product = deal.proposal?.opportunity?.type === "PRODUCT";
                return (
                  <Card key={deal.id} className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="inline-flex rounded-full bg-[color:var(--px-primary-soft)] px-2.5 py-1 text-xs font-bold text-[color:var(--px-primary)]">
                          {product ? "Product agreement" : "Service or project agreement"}
                        </span>
                        <h3 className="mt-2 break-words text-base font-black text-[color:var(--px-text)]">
                          {deal.proposal?.opportunity?.title ?? "Agreement"}
                        </h3>
                        <p className="mt-1 text-sm text-[color:var(--px-text-muted)]">
                          Current agreement state: <span className="font-bold text-[color:var(--px-text)]">{statusLabel(deal.status)}</span>
                        </p>
                        {latest ? (
                          <p className="mt-1 text-xs text-[color:var(--px-text-muted)]">
                            Latest recorded change: {statusLabel(latest.toStatus)}
                          </p>
                        ) : null}
                      </div>
                      <PackageCheck aria-hidden className="shrink-0 text-[color:var(--px-primary)]" size={24} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-[color:var(--px-border)] pt-3">
                      <Link className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[color:var(--px-primary)] px-3 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]" href={`/app/deals/${deal.id}`}>
                        View agreement <ArrowRight aria-hidden size={16} />
                      </Link>
                      <Link className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[color:var(--px-border-strong)] bg-[color:var(--px-surface-soft)] px-3 text-sm font-bold text-[color:var(--px-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]" href={`/app/deals/${deal.id}/deliveries`}>
                        <ClipboardCheck aria-hidden size={16} /> Delivery records
                      </Link>
                    </div>
                  </Card>
                );
              })}
              <CursorPagination basePath="/app/track" cursor={page.cursor} label="Tracking centre pagination" nextCursor={page.nextCursor} />
            </div>
          ) : (
            <EmptyState
              title="No agreements to track yet"
              body="Once a proposal is accepted and an agreement is created, you can see its progress here. Enquiring about a product alone does not create an order."
              action={<ButtonLink href="/app/market">Browse listings</ButtonLink>}
            />
          )}
        </div>

        <aside className="space-y-4">
          <Card>
            <div className="flex items-center gap-2 text-[color:var(--px-text)]">
              <MapPinOff aria-hidden size={21} className="text-[color:var(--px-primary)]" />
              <h2 className="font-black">Live parcel map</h2>
            </div>
            <div className="mt-3 grid min-h-40 place-items-center rounded-2xl border border-dashed border-[color:var(--px-border-strong)] bg-[color:var(--px-surface-soft)] p-4 text-center">
              <div>
                <MapPinOff aria-hidden className="mx-auto text-[color:var(--px-text-muted)]" size={30} />
                <p className="mt-2 text-sm font-black text-[color:var(--px-text)]">Location not available</p>
                <p className="mt-1 text-xs leading-5 text-[color:var(--px-text-muted)]">
                  We have not received any verified courier location or tracking number for your parcel.
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-[color:var(--px-text-muted)]">
              A map will only be shown after an actual courier integration sends shipment and location updates. We will not guess where your parcel is.
            </p>
          </Card>
          <Card>
            <h2 className="font-black text-[color:var(--px-text)]">Need a delivery partner?</h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
              Search for logistics services or message the seller about delivery arrangements.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <ButtonLink href="/app/logistics" variant="secondary">Logistics</ButtonLink>
              <ButtonLink href="/app/messages" variant="secondary">Messages</ButtonLink>
            </div>
          </Card>
        </aside>
      </div>
    </AppSection>
  );
}
