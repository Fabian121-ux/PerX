# PtahX Deal Workspace V2 — 20 October 2026

## Implemented
- The existing authorized `/app/deals/[dealId]` page is now the **Deal room**.
  No duplicate route, new Deal entity, new message database or migration.
- Clear locked-terms panel reflects the accepted ProposalVersion already
  stored and protected server-side. No editing or deleting locked terms.
- Milestone status and completion percentage are calculated solely from
  actual approved milestones; no fake shipment or payment completion.
- Role/state-specific next action only when the existing
  `submitDeliveryAction`/`approveDeliveryAction` routes can accept it.
- Linked **Discussion** opens the already-authorized conversation route.
  Confirm conversation membership before exposing link, because historic
  Deal participants may no longer have access to that conversation.
- Real Agreement-state history, progress list, participant roles, delivery,
  milestone links and clear *no real funds held* warning.
- Queries reuse the existing authorized Deal loader, with at most one
  additional participant-scoped conversation existence check when linked.
  No new message polling/SSE stream or Supabase paid service.

## Design boundaries and next work
- A distinct Deal-only message thread (with new DealMessage storage, migrations,
  authorization, retention, and real-time fan-out) is **not** introduced here.
  The page links the canonical shared conversation. We must not imply chat
  messages are immutable agreement terms.
- Chat `@deal` drawer and Deal workspace are complementary; submitted
  version immutability must remain server-enforced.
- Real escrow/online payments, live courier location, calls and voice/media
  recording remain unavailable until implemented and security-reviewed.
- Remaining manual QA: Android/iOS chat → Deal room → delivery →
  milestones → chat loop on two authorized accounts, 320px and low-bandwidth
  test, accessibility navigation/focus and actual p75 page speed metrics.
