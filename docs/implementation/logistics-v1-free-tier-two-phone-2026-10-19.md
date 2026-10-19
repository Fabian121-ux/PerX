# PtahX Logistics V1 — two-phone GPS pilot, Supabase Free

## Purpose

Build one genuine, lightweight delivery assignment linked to a **previously
accepted PRODUCT Deal**. This is not checkout, funds, insurance, proof of
fulfilment, an automatically purchased shipping label, or a marketplace where
orders can be placed just by clicking Enquire.

**A Wi-Fi hotspot or phone number cannot be used to track its owner.** GPS
works only when the assigned driver separately signs into PtahX on their own
device, accepts the job, grants browser location permission, and chooses a
finite sharing duration. Neither buyer nor seller can switch that on remotely.

## Workflow

1. Seller and buyer already have a PRODUCT Deal. Seller opens Deal →
   **Assign V1 driver** (or Track → Assign V1 driver).
2. Seller enters a registered PtahX member's username. One shipment per Deal
   is enforced by a unique constraint. No shipment is produced by the initial
   product listing, simple enquiry, or ordinary social post.
3. Driver opens Logistics → **Driver dashboard**, accepts the assigned
   delivery, then chooses 15/30/60/120 minutes and taps **Enable live GPS**.
   The browser asks for permission and reports coordinates while this page
   remains open. Only the driver may start, stop, or send coordinates.
4. Seller and buyer can open Track → Open V1 delivery. They see status,
   driver's name and (when recent consent is active) an approximate location.
   The interactive OpenStreetMap iframe is only loaded when the viewer clicks
   Show map. No map location is guessed when data is stale, unavailable or
   permission is denied.
5. Driver confirms parcel collected and in transit. **Buyer confirms physical
   receipt**; this ends the location-sharing session and clears GPS fields.
   Seller may cancel only prior to collection.
6. Driver can stop sharing at any time. Server forces an expiry and suppresses
   any location older than two minutes. The server clears stored coordinates
   on stop, confirmed delivery, cancellation or an authorized read after
   expiry. No GPS history/table, no continuously running background job.

## Free-tier constraints

- PostgreSQL: **one mutable GPS row per shipment**, no event-by-event position
  inserts and no expensive geospatial extension. Indexed by deal and actor IDs.
- GPS requests: **at most one successful write per driver every 25 seconds**,
  server-enforced using a conditional atomic update.
- Viewer refresh: at most every 30 seconds when page is visible, disabled on
  data saver, no websocket, Redis or third-party realtime subscription.
- Existing product listing and agreement queries remain unchanged. The new
  V1 page queries only the authorized shipment ID; map tiles are click-to-load.
- Hard cap of **20 active pilot assignments**; feature flag defaults OFF.
- When the driver backgrounds the browser tab, V1 stops the local GPS watcher and attempts a best-effort server stop. If that fails, stale observations disappear after two minutes and the server deadline still applies.
- Actual drivers with the screen off/locked may stop producing GPS on mobile
  browsers. This V1 makes no background tracking promise; a later native app
  is needed for reliable background GPS.
- Every actor must be an authenticated PtahX account. Server sessions and
  actor-specific query predicates protect reads/writes. No RLS/Data API grants
  for GPS records. No direct Supabase-js access from the browser.

## Feature activation — DO NOT skip

The feature defaults OFF; user-facing V1 routes return 404 and API 503
until `PTAHX_LOGISTICS_V1_ENABLED=1` is set on an approved deployment.
Apply ONLY the appended
`prisma/migrations/20261019220000_logistics_v1_opt_in/migration.sql`
to the **correct PerX database** after independently verifying migration
history and existing schema; do not apply pending Auth migrations or attempt
this against DataCube_Au. Production migration is **not** part of this PR.
Do not set the flag before migration completes.

The database is NOT the connected Supabase project `DataCube_Au`. Confirm
the PerX PostgreSQL target and preview-test with two test users first. This
feature stays feature-gated through rollout.

## Two-phone acceptance test

- Phone A: log in as seller, and create driver assignment from one real test
  PRODUCT Deal. The buyer must be a participant and proposer in that Deal.
- Phone B (driver): separately sign in with assigned member account; accept,
  share for **15 minutes**, and grant geolocation in the mobile browser.
  Phone A may use a hotspot, but this must NOT track the hotspot owner unless
  they are signed in as driver and deliberately permit GPS.
- Buyer account: open Track → Open V1 delivery. Open map and check rounded GPS
  pin; verify latest updated time and status. Move driver a short safe distance
  outdoors; expect new authorized coordinates within ~30–60 seconds if data
  service and browser remain active.
- Stop GPS on driver phone. Buyer should lose map marker on subsequent refresh;
  also test expiry, app background, network loss, inaccurate GPS, unauthorized
  user, spam updates, wrong product/Deal, cancel and delivered actions.
- This is **a test**. Do not call the feature tested end-to-end until actual
  different-device, proper database, and consent-based checks pass.

## Next versions

V2: real order checkout (separate from Deal), dispatch matching, notifications,
delivery PIN and rider onboarding. V3: managed realtime, GPS expiry cleanup job,
high-traffic load tests and optional native driver app. Do not add all this to V1.
