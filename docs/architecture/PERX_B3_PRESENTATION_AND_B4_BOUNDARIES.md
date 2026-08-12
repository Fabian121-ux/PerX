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
