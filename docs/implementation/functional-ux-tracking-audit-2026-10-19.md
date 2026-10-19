# Connected UX audit — October 19, 2026

## What the screenshots ask for

Home: large product media, readable title and price, seller identity, category
search, real trust information, connection, Save/Enquire/Share/View/Report,
and a visible Track entry. Messages: existing conversation list, read states,
Deal terms and a route to agreement progress.

## Existing pages checked — no duplicates

| User action | Existing destination |
| --- | --- |
| Home / social posts | `/app` / `/app/posts/new` |
| Discover | `/app/discover` / `/app/search` |
| Seller profile and connection controls | `/u/[username]` |
| Listing details / seller enquiries | `/opportunities/[slug]` |
| Save / Saved | Existing bookmark mutation / `/app/saved` |
| Share | Native share or clipboard fallback |
| Report | `/app/reports/new?targetType=OPPORTUNITY&targetId=...` |
| Chats / proposals | `/app/messages` and related conversation pages |
| Agreements | `/app/deals` / `/app/deals/[dealId]` |
| Milestones and submitted work | `/app/deals/[dealId]/deliveries` |
| Logistics partners | `/app/logistics` |
| Trust | `/app/trust` |
| Track progress | **New** `/app/track` (not an existing route) |

The new Track centre uses `getUserDealsPage(user.id)`, with the existing
participant authorization and 20-item cursor limit. It shows **agreement
status and delivery records**, never invented product orders or location.
Linking to existing deal pages avoids duplicating their business logic.

## Confirmed fixes

- Theme-variable text/background colours on shared empty states, social
  posts/reaction buttons, and Deal deliveries headings. These previously used
  hardcoded light-mode or inherited colours and could disappear in dark mode.
- Product discovery filter: `PRODUCT` is now accepted by the authenticated
  discovery route. Existing Services/Products chips now reach their actual
  filtered listings.
- Home Track icon, desktop Track link, tracking feature directory entry,
  seller profile connection entry, Report action, existing Enquire and Share
  flows, plus a tracking shortcut for conversations with existing Deal records.
- Short mobile texts and real links; no dummy handlers or fake click targets.

## Tracking and map limitations

Production Prisma currently has Deal, DealMilestone, Delivery and Opportunity
records. It does **not** contain a shipment/order table, tracking number,
GPS events, coordinates or a connected courier provider. A map showing an
"in-transit" dot from this data would be made up, so the tracking centre
shows an explicit unavailable map panel rather than pretending to track a
physical item. Physical parcel maps need a separate authorised flow covering
seller shipment creation, carrier integration, webhooks, user access checks,
tracking event retention and map geocoding; that is **not** a frontend-only
configuration.

## Remaining validation

CI lint, TS type-check, unit and integration tests, build, then a real
authenticated mobile browser pass (320–430px), dark/light contrast, keyboard
and SSE messages, and actual page timings (LCP, INP, CLS). Vercel READY does
not prove live runtime. No production DB/schema/permission changes requested.
