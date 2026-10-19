# Automatic shipment display and interactive map — courier adapter

This extends the existing Tracking Centre at `/app/track`. It does not create
a second route, mutate Deals, or claim that every product is purchased/shipped.

## Current user experience

1. After an accepted product proposal creates a Deal, participants automatically
   see it in the existing Track page. The most recent product is selected;
   viewers can pick a different agreement using **Track this item**.
2. The page automatically requests shipment data for **only that selected,
   participant-authorized product Deal** from the configured courier gateway.
3. If that gateway has a booked shipment, the server renders the real carrier,
   tracking reference and verified status timeline. A genuine courier GPS
   observation activates the map marker (rounded to ~100m precision).
4. The OpenStreetMap iframe remains click-to-load: it is a real pannable and
   zoomable map, not an invented route or moving animation. Without verified
   coordinates it shows a general map with no parcel pin.
5. While visible and without data-saver, the page refreshes every minute and
   picks up new agreements and upstream courier events automatically. A manual
   **Check now** button also exists.

## Carrier gateway contract

Set these **server-side** secrets with the app deployment administrator:

- `PTAHX_SHIPMENT_PROVIDER_ORIGIN=https://<approved-courier-gateway-domain>`
- `PTAHX_SHIPMENT_PROVIDER_TOKEN=<long-secret-token>`

The application issues an HTTPS GET:

`/v1/shipments/by-deal/{percent-encoded-dealId}`

with `Authorization: Bearer <token>`. The trusted gateway must associate a
real carrier booking with the Deal ID and return `404` until booked. Example
response (for protocol documentation ONLY, not seeded into the application):

```json
{
  "dealId": "deal-123",
  "carrierName": "Courier name",
  "trackingNumber": "real-reference",
  "status": "IN_TRANSIT",
  "updatedAt": "2026-10-19T17:00:00Z",
  "location": {
    "verified": true,
    "latitude": 6.5244,
    "longitude": 3.3792,
    "observedAt": "2026-10-19T16:55:00Z"
  }
}
```

Status may be `LABEL_CREATED`, `PICKED_UP`, `IN_TRANSIT`,
`OUT_FOR_DELIVERY`, `DELIVERED`, or `EXCEPTION`.

The GET is read-only, bounded to 16KiB, times out after 3.5 seconds, does not
follow redirects, uses no caching and fails closed when credentials, gateway
data, or GPS verification are absent. The app never accepts a URL/coordinate
from the buyer to construct a carrier map marker. `Deal.status` does **not**
become a shipping status.

## Before calling it a live courier service

The gateway must be implemented and deployed by an approved carrier or
integration operator. Real shipping requires signed carrier events,
authenticated sender/receiver scopes, shipment creation/booking,
tracking-number storage, cancellation and exception handling, retry/dedup
policies, and data privacy assessment. **No provider is connected by this PR.**
No database schema, shipping charge, fulfillment or carrier booking is
invented. Do not enable a courier status banner until provider credentials and
a real booked shipment are present.

QA: CI lint, typecheck, unit + authorization tests, Next build; real-device
responsive, iframe CSP, accessibility, slow network, carrier outage and
deployed browser checks. The map sends data to OpenStreetMap only when the
user opts to open it.
