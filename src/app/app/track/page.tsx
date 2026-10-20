import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  Clock3,
  MessageSquare,
  Package,
  PackageCheck,
  ShieldCheck,
  Truck,
} from "lucide-react";

import { AppSection } from "@/components/app-section";
import { TrackingAutoRefresh } from "@/components/tracking/tracking-auto-refresh";
import { TrackingMapPanel } from "@/components/tracking/tracking-map-panel";
import { CursorPagination } from "@/components/cursor-pagination";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getUserDealsPage } from "@/lib/data/app";
import { getPrisma } from "@/lib/db/prisma";
import { logisticsV1Enabled } from "@/lib/logistics/v1-policy";
import { getVerifiedShipmentForDeal, type VerifiedShipment } from "@/lib/tracking/shipment-provider";

/**
 * The only automatic source today is the participant-authorized Deal stream.
 * A Deal on a PRODUCT listing is a product agreement, not proof of purchase,
 * dispatch or shipment. Never turn Deal.status into a courier delivery status.
 */
type TrackedAgreement = {
  id: string;
  status: string;
  proposal: { opportunity: { title: string; type: string; ownerId?: string } };
  statusHistory: {
    id: string;
    toStatus: string;
    createdAt: Date | string;
  }[];
};

function statusLabel(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

function formatHistoryTime(value: Date | string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  }).format(date);
}

function AgreementCard({ agreement, selected = false, cursor, shipment, v1Id, viewerId }: { agreement: TrackedAgreement; selected?: boolean; cursor?: string; shipment?: VerifiedShipment | null; v1Id?: string; viewerId?: string }) {
  const product = agreement.proposal?.opportunity?.type === "PRODUCT";
  const events = agreement.statusHistory ?? [];

  return (
    <Card className={`min-w-0 overflow-hidden ${selected ? "ring-2 ring-[color:var(--px-primary)]" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="inline-flex rounded-full bg-[color:var(--px-primary-soft)] px-2.5 py-1 text-[11px] font-black text-[color:var(--px-primary)]">
            {product ? "Product agreement" : "Service or project agreement"}
          </span>
          {selected ? <span className="ml-2 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100">Selected for tracking</span> : null}
          <h3 className="mt-2 break-words text-base font-black text-[color:var(--px-text)]">
            {agreement.proposal?.opportunity?.title ?? "Agreement"}
          </h3>
          <p className="mt-1 text-sm leading-6 text-[color:var(--px-text-muted)]">
            Current agreement state:{" "}
            <span className="font-bold text-[color:var(--px-text)]">
              {statusLabel(agreement.status)}
            </span>
          </p>
          {product ? (
            <p className="mt-2 rounded-xl border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] px-3 py-2 text-xs leading-5 text-[color:var(--px-text-muted)]">
              {shipment
                ? `Verified carrier update: ${shipment.carrierName} — ${statusLabel(shipment.status)}.`
                : selected
                  ? "Shipping not confirmed. No verified carrier update is available for this agreement yet."
                  : "Select Track this item to check for verified courier updates."}
            </p>
          ) : null}
        </div>
        {product ? (
          <Package aria-hidden className="shrink-0 text-[color:var(--px-primary)]" size={25} />
        ) : (
          <PackageCheck aria-hidden className="shrink-0 text-[color:var(--px-primary)]" size={25} />
        )}
      </div>

      {events.length ? (
        <div className="mt-4 border-t border-[color:var(--px-border)] pt-4">
          <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[color:var(--px-text)]">
            <Clock3 aria-hidden size={15} /> Recorded agreement activity
          </p>
          <ol className="space-y-3" aria-label="Recorded agreement activity">
            {events.slice(0, 5).map((event) => (
              <li className="flex gap-3 text-xs" key={event.id}>
                <span aria-hidden className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[color:var(--px-primary)]" />
                <span className="min-w-0 flex-1 font-semibold capitalize text-[color:var(--px-text)]">
                  {statusLabel(event.toStatus)}
                </span>
                <time className="shrink-0 text-[color:var(--px-text-muted)]" dateTime={new Date(event.createdAt).toISOString()}>
                  {formatHistoryTime(event.createdAt)}
                </time>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-[color:var(--px-border)] pt-3">
        {product && logisticsV1Enabled() ? (
          v1Id ? (
            <Link href={`/app/logistics/shipments/${v1Id}`} className="inline-flex min-h-11 items-center rounded-xl border border-emerald-600 bg-emerald-50 px-3 text-sm font-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
              Open V1 delivery
            </Link>
          ) : agreement.proposal?.opportunity?.ownerId === viewerId ? (
            <Link href={`/app/logistics/dispatch?deal=${encodeURIComponent(agreement.id)}`} className="inline-flex min-h-11 items-center rounded-xl border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 text-sm font-black text-[color:var(--px-primary)]">
              Assign V1 driver
            </Link>
          ) : null
        ) : null}
        {product && !selected ? (
          <Link
            aria-label={`Track ${agreement.proposal?.opportunity?.title ?? "this product"} on the map`}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[color:var(--px-primary)] bg-[color:var(--px-primary-soft)] px-3 text-sm font-black text-[color:var(--px-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
            href={`/app/track?deal=${encodeURIComponent(agreement.id)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`}
          >
            Track this item <ArrowRight aria-hidden size={16} />
          </Link>
        ) : null}
        <Link
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[color:var(--px-primary)] px-3 text-sm font-bold text-white hover:bg-[color:var(--px-primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
          href={`/app/deals/${agreement.id}`}
        >
          View agreement <ArrowRight aria-hidden size={16} />
        </Link>
        <Link
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[color:var(--px-border-strong)] bg-[color:var(--px-surface-soft)] px-3 text-sm font-bold text-[color:var(--px-text)] hover:bg-[color:var(--px-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--px-focus)]"
          href={`/app/deals/${agreement.id}/deliveries`}
        >
          <ClipboardCheck aria-hidden size={16} /> Delivery records
        </Link>
      </div>
    </Card>
  );
}

const SHIPMENT_STAGES = ["LABEL_CREATED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"] as const;

function CarrierShipmentDetails({ shipment }: { shipment: VerifiedShipment }) {
  const currentIndex = SHIPMENT_STAGES.findIndex((stage) => stage === shipment.status);
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-3">
        <p className="text-xs text-[color:var(--px-text-muted)]">Carrier</p>
        <p className="font-black text-[color:var(--px-text)]">{shipment.carrierName}</p>
        <p className="mt-2 text-xs text-[color:var(--px-text-muted)]">Tracking number</p>
        <p className="break-all font-mono text-sm font-bold text-[color:var(--px-text)]">{shipment.trackingNumber}</p>
        <p className="mt-2 text-xs text-[color:var(--px-text-muted)]">Carrier update</p>
        <p className="font-semibold capitalize text-[color:var(--px-text)]">{statusLabel(shipment.status)}</p>
        <time className="mt-1 block text-xs text-[color:var(--px-text-muted)]" dateTime={shipment.updatedAt}>{formatHistoryTime(shipment.updatedAt)}</time>
      </div>
      {currentIndex >= 0 ? (
        <ol aria-label="Verified shipment progress" className="space-y-2">
          {SHIPMENT_STAGES.map((stage, index) => (
            <li className="flex items-center gap-2 text-xs" key={stage}>
              <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${index <= currentIndex ? "bg-emerald-500" : "bg-[color:var(--px-border-strong)]"}`} />
              <span className={index <= currentIndex ? "font-bold text-[color:var(--px-text)]" : "text-[color:var(--px-text-muted)]"}>{statusLabel(stage)}</span>
              {index === currentIndex ? <span className="ml-auto font-black text-emerald-700 dark:text-emerald-300">Latest</span> : null}
            </li>
          ))}
        </ol>
      ) : <p role="status" className="text-sm font-bold text-[color:var(--px-error)]">Courier reported an exception. Please contact the seller or carrier.</p>}
      <p className="text-xs leading-5 text-[color:var(--px-text-muted)]">
        Status comes from the connected carrier, not PtahX agreement milestones. Map coordinates are approximate and may be older than the latest update.
      </p>
    </div>
  );
}

export default async function TrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; deal?: string }>;
}) {
  const user = await requireUser();
  const { cursor, deal: selectedDealId } = await searchParams;
  // No manual tracking setup: new Deal records for this user show on their
  // next refresh, including product agreements. Only authorized participants
  // can see these records.
  const page = await getUserDealsPage(user.id, { cursor, pageSize: 20 });
  const agreements = page.items as TrackedAgreement[];
  const productAgreements = agreements.filter(
    (deal) => deal.proposal?.opportunity?.type === "PRODUCT",
  );
  const otherAgreements = agreements.filter(
    (deal) => deal.proposal?.opportunity?.type !== "PRODUCT",
  );
  // The selection is restricted to the current authorized result page.
  // Never let a URL parameter authorize fetching a different user's shipment.
  const selectedProduct =
    productAgreements.find((deal) => deal.id === selectedDealId) ??
    productAgreements[0] ??
    null;
  const shipment = selectedProduct
    ? await getVerifiedShipmentForDeal(selectedProduct.id)
    : null;
  // One bounded server query for the current visible product page, never
  // one DB lookup per card or a new tracking route for every agreement.
  const v1ShipmentByDeal = new Map<string, string>();
  if (logisticsV1Enabled() && productAgreements.length > 0) {
    const active = await getPrisma().logisticsV1Shipment.findMany({
      where: {
        dealId: { in: productAgreements.map((item) => item.id) },
        OR: [{ sellerId: user.id }, { buyerId: user.id }, { driverId: user.id }],
      },
      select: { id: true, dealId: true },
      take: 20,
    });
    for (const row of active) v1ShipmentByDeal.set(row.dealId, row.id);
  }

  return (
    <AppSection
      title="Tracking centre"
      description="See the progress of your product agreements and recorded deliveries. Live parcel tracking starts only when a verified courier feed is connected."
      actions={<TrackingAutoRefresh />}
    >
      <section className="overflow-hidden rounded-[24px] bg-[linear-gradient(130deg,#061936,#0d3370)] p-5 text-white shadow-lg sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-100">PtahX deliveries</p>
            <h2 className="mt-2 text-xl font-black sm:text-2xl">Your product updates, one place</h2>
            <p className="mt-2 text-sm leading-6 text-white/85">
              Product agreements appear here automatically after a deal is created.
              Agreement changes refresh every minute while you have this page open.
              We will not say an item has shipped until a carrier confirms it.
            </p>
          </div>
          <span className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 text-xs font-bold text-white">
            <ShieldCheck aria-hidden size={17} /> Your agreements only
          </span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
            <p className="text-xs font-bold text-white/80">Product agreements on this page</p>
            <p className="mt-1 text-2xl font-black text-white">{productAgreements.length}</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
            <p className="text-xs font-bold text-white/80">Selected item: courier location</p>
            <p className="mt-1 text-2xl font-black text-white">{shipment?.location ? "1" : "0"}</p>
            <p className="text-[11px] text-white/80">{shipment?.location ? "Verified event received" : "No verified location yet"}</p>
          </div>
        </div>
      </section>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="order-2 min-w-0 space-y-5 lg:order-1">
          <section aria-labelledby="product-track-heading" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 id="product-track-heading" className="text-lg font-black text-[color:var(--px-text)]">
                Your product agreements
              </h2>
              <Truck aria-hidden className="text-[color:var(--px-primary)]" size={20} />
            </div>
            {productAgreements.length ? (
              productAgreements.map((deal) => (
                <AgreementCard
                  agreement={deal}
                  cursor={cursor}
                  key={deal.id}
                  selected={deal.id === selectedProduct?.id}
                  shipment={deal.id === selectedProduct?.id ? shipment : null}
                  v1Id={v1ShipmentByDeal.get(deal.id)}
                  viewerId={user.id}
                />
              ))
            ) : (
              <EmptyState
                title="No agreements to track yet"
                body="Once a product proposal is accepted and an agreement is created, it will appear here automatically. Enquiring about a product alone does not create an order."
                action={<ButtonLink href="/app/discover?type=PRODUCT">Browse products</ButtonLink>}
              />
            )}
          </section>

          {otherAgreements.length ? (
            <section aria-labelledby="other-deal-heading" className="space-y-3">
              <h2 id="other-deal-heading" className="text-lg font-black text-[color:var(--px-text)]">Other agreements</h2>
              {otherAgreements.map((deal) => <AgreementCard agreement={deal} key={deal.id} />)}
            </section>
          ) : null}
          <CursorPagination basePath="/app/track" cursor={page.cursor} label="Tracking centre pagination" nextCursor={page.nextCursor} />
        </div>

        <aside className="order-1 min-w-0 space-y-4 lg:order-2">
          <Card className="space-y-3">
            <h2 className="text-base font-black text-[color:var(--px-text)]">Shipment details</h2>
            <p className="text-xs leading-5 text-[color:var(--px-text-muted)]">
              {selectedProduct
                ? selectedProduct.proposal?.opportunity?.title
                : "Choose a product agreement once it is created."}
            </p>
            {shipment ? <CarrierShipmentDetails shipment={shipment} /> : (
              <p className="rounded-xl border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-3 text-sm leading-6 text-[color:var(--px-text-muted)]" role="status">
                No verified shipment information is available right now. The parcel may not be booked yet, or the courier service may be offline.
              </p>
            )}
          </Card>
          <TrackingMapPanel key={selectedProduct?.id ?? "none"} location={shipment?.location ?? null} />
          <Card>
            <h2 className="font-black text-[color:var(--px-text)]">What happens next?</h2>
            <ol className="mt-3 space-y-3 text-sm leading-6 text-[color:var(--px-text-muted)]">
              <li><strong className="text-[color:var(--px-text)]">1. Agree:</strong> You and the seller complete a proper Deal.</li>
              <li><strong className="text-[color:var(--px-text)]">2. Ship:</strong> A connected courier confirms collection and sends tracking updates.</li>
              <li><strong className="text-[color:var(--px-text)]">3. Follow:</strong> PtahX can then display verified parcel status and an approximate location.</li>
            </ol>
            <p className="mt-3 rounded-xl bg-[color:var(--px-muted)] p-3 text-xs leading-5 text-[color:var(--px-text-muted)]">
              Step 2 needs a courier integration. Deal delivery records are not proof that a physical parcel was sent.
            </p>
          </Card>
          <Card>
            <h2 className="font-black text-[color:var(--px-text)]">Need help with delivery?</h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--px-text-muted)]">
              Find a logistics partner or ask your seller how the item will be delivered.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <ButtonLink href="/app/logistics" variant="secondary"><Truck aria-hidden size={16} className="mr-2" />Logistics</ButtonLink>
              <ButtonLink href="/app/messages" variant="secondary"><MessageSquare aria-hidden size={16} className="mr-2" />Messages</ButtonLink>
            </div>
          </Card>
        </aside>
      </div>
    </AppSection>
  );
}
