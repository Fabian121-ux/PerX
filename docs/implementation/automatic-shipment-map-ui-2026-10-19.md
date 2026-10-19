# Interactive Tracking map / auto-appearance, 19 October 2026

## Delivered UX

This updates **the existing** `/app/track` route rather than adding a
second tracking page.

- Product agreements are detected automatically from `getUserDealsPage`
  scoped to the current authenticated deal participant. Other agreements
  stay separate and accessible on the same page.
- The page auto-refreshes once a minute while visible. It pauses in
  background tabs, and respects the browser's Data Saver preference.
  "Check now" allows on-demand refresh; no courier tracking is invented.
- The interface has a live, pannable and zoomable **OpenStreetMap base map**.
  The embedded map is click-to-load so it does not affect first paint or
  disclose a visitor's map request before consent. It supports a separate
  full OpenStreetMap view with proper attribution.
- The map uses a **general Nigeria viewport without any parcel marker** until
  a signed, trusted carrier location is available. The
  `VerifiedCarrierLocation` interface, coordinate validation and an
  optional approximate map marker are ready for use by an actual carrier
  event adapter, but *no fake or unverified location is passed today*.
- Deal status history renders genuine timestamps, and product-only agreement
  pages link back to the tracking centre. All available delivery actions reuse
  `/app/deals/[dealId]/deliveries`.
- No new client-side map library, heavyweight JS bundle, DB migration,
  payment logic or geolocation permissions required.

## What is not integrated yet

PerX currently has neither physical `Shipment`/`Order` rows, carrier
tracking numbers nor authenticated courier webhook events. Posting a
`PRODUCT` does **not** equal a purchase or a shipped package. Deal milestone
submissions are not proof of carrier collection. This release does not create
fake orders, mark parcels "in transit", or show guessed rider GPS.

To make physical shipping start *automatically* after a legitimate order:

1. Agree on an order/fulfilment model (price, address privacy, seller
   obligations, cancellation and delivery scope), distinct from Beta
   proposal/Deal state.
2. Add transactional `Shipment` records with a uniqueness constraint on
   order + fulfilment, idempotent provisioning from a **confirmed** order
   event; do not generate shipments on a mere listing/view/enquiry.
3. Connect a real courier aggregator / carrier with credentials, registered
   pickup/waybill support, signed webhooks, replay protection, delivery-state
   transitions and retention. Show only user-authorised shipments. Validate
   coordinates from those events and disclose how location is used.
4. Populate `VerifiedCarrierLocation` from verified carrier events only;
   provide fallback statuses if a carrier reports no GPS. Update via
   authenticated polling or server notifications.
5. Use a commercial tile service or self-hosted OSM tiles as user scale grows:
   community OpenStreetMap tiles are best-effort, rate-limited and not an
   unlimited commercial map service. Keep licensing attribution visible.

These steps require backend and provider configuration. They cannot be
truthfully completed through frontend code alone.

## Validation needed

- GitHub lint, TS type-check, tests, production build;
- authenticated mobile (320/360/390/430 px), OSM iframe browser CSP,
  low-bandwidth and denied third-party-network acceptance;
- user review for delivery lifecycle and privacy policy before a courier
  integration or any production schema migration.
