# PerX B3 Presentation and B4 Boundaries

Status: B3 contract, 2026-08-10.

## B3 Scope

B3 refines responsive presentation and interactions over the existing persisted domains. It does not add database migrations, fabricate records, or treat preview fixtures as production facts.

Supported B3 interactions include persisted message replies, opportunity bookmarks, notification read/open actions, connection actions, opportunity creation for currently available types, and evidence-based Trust presentation.

## Social Engagement

Generic feed comments, reactions, post replies, reaction counts, and their notification fan-out are deferred to B4. The current schema has no generic social-post engagement domain, authorization policy, moderation lifecycle, or notification-event contract. B3 therefore omits those controls rather than presenting fake local state.

Message replies are separate. They belong to the persisted messaging domain and retain conversation authorization, message-level reply targets, safety retention, and read-state rules.

B4 must define the engagement models, object-level authorization, idempotency, moderation and deletion behavior, pagination, notification fan-out, and abuse controls before generic social controls are enabled.

## Trust Presentation

B3 publishes evidence levels, not a numeric Trust Score. `PublicTrustSummary.score` remains `null`. Live B3 factors use record-backed completed agreements and public-review aggregates together with profile, email, and approved-verification evidence.

`Profile.trustScore`, `Profile.completedDeals`, and `Profile.averageRating` are legacy denormalized fields and are not authoritative inputs for the B3 Trust presentation. The weighted scorer under `src/features/trust/trust-score.ts` is a legacy prototype, not an approved production methodology. Numeric values in preview fixtures are fictional demonstration data and must not be interpreted as production scores.

The `AuthoritativeTrustScore` presentation type is an integration boundary only. No live B3 caller supplies it. B4 must provide a server-owned source with approved methodology and model versions, provenance, eligibility rules, recalculation triggers, audit history, dispute handling, anti-manipulation controls, and runtime validation before that branch can be enabled.

## Notifications

B3 uses existing persisted notification types, recipient scoping, server-side destination resolution, read/unread state, filters, and bounded pagination. It does not create a generic social-event pipeline.

B4 must define scalable event production, deduplication and idempotency, delivery preferences, fan-out, retention, moderation coupling, and observability for new social engagement types.

## Capabilities and Regulated Types

B3 enforces the existing role-derived capabilities in presentation and server mutations. These mappings are temporary and are not the B4 server-owned capability-grant model. B4 must define durable grants, administrative provenance, revocation, auditability, and type-sensitive creation permissions.

Investment posts remain unavailable for creation or publication pending formal regulatory and product clearance. Existing records may remain readable or editable as drafts, but B3 does not activate investment publishing.

## In-Chat Deal Entry

B3's in-chat `Make a Deal` entry creates an immutable submitted Proposal version in an existing active, two-party, opportunity-linked conversation. The exact `@deal` composer command opens the same structured form and is not persisted as an ordinary message. It does not infer terms from free text.

A Deal is created only when the opportunity owner explicitly accepts that exact submitted version through the existing Proposal decision flow. Direct-chat Deals, group Deals, multiple concurrent Proposal lifecycles, administrative Deal transitions, real payment custody, and text-based acceptance remain outside B3.

## Admin Operational Summaries

B3 Admin Users and Admin Deals expose read-only, cursor-bounded operational summaries. User rows contain current account availability, verification, authorization roles, active channel restrictions, and record-backed activity counts. Deal rows contain current status, settlement mode, agreement value, bounded participant previews, and aggregate participant, milestone, and unresolved-dispute counts.

These summaries do not add admin detail pages, role assignment, enforcement history, Deal history, administrative Deal transitions, or payment/ledger inspection. Those remain B4 concerns.

## Create Post Browser Recovery

Create Post browser recovery is best-effort local storage, not a persisted PerX Opportunity draft. Keys are scoped to the authenticated user ID and currently creatable opportunity type, are versioned, and expire after 30 days. Storage is read only after hydration, malformed or stale payloads are ignored, and successful server persistence clears only the confirmed user/type key from the authenticated success destination.

Only an explicit allowlist of composer fields is stored. Submission intent, account/session data, object IDs, files, and the Property ownership or authority declaration are excluded. Users are warned not to enter private contact, payment, identity-document, or verification information. Local recovery is not encrypted and is not a confidentiality boundary on a shared browser.

Mobile Create Post keeps core and Property-required fields visible while progressively disclosing optional budget, location, skills, and participation fields. Desktop retains those controls in the normal form flow. Money controls preserve canonical decimal text, declare their currency, and enforce the database's signed 64-bit minor-unit limit. This work introduces no database migration and does not change Investment availability.
