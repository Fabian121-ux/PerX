# PtahX mobile Home, Create and Messaging UX

Implementation branch: `ux/mobile-home-create-messaging-20261018`
Base: `main` at `dfee3373bcbdd79adc1019c91756c7760d5f3a17`

## Changes

- Mobile Create opens an accessible, keyboard-navigable action sheet; authenticated
  members can share a community update. Business listing choices continue to
  use the existing authorization gate and opportunity composer.
- The feature directory and desktop Create use the same Create concept. A
  dedicated `/app/create` hub gives a non-modal destination for navigation.
- Mobile Home now includes prominent search and trust guidance. Community and
  opportunity sections have clear labels; listing cards show contextual calls
  to action, share/copy-link and direct access to the real response form.
- Community cards show comment and share actions alongside existing reactions.
- Listing detail now uses stored photos (up to four already selected by the
  provider) in a swipeable keyboard-accessible carousel, falling back to the
  existing placeholder only for listings without uploaded photos.
  The text-post composer restores a per-user, per-tab draft.
- Messages retain their current participant authorization, realtime sync,
  history, keyboard behavior and proposal flows. Conversation rows identify
  actual deal records; the mobile composer presents the existing deal action
  without hiding its label.
- Display only persisted trust summaries; no fabricated sales, ratings, Trust
  Score, end-to-end encryption, voice/video, checkout or real escrow claims.

## Database and release boundaries

This UX pass needs no migration; Prisma tables and RLS grants remain unchanged.
The connected Supabase integration only exposes a project named DataCube_Au,
not the PerX PostgreSQL schema. **No SQL was executed on DataCube_Au or on
production**, and this branch does not change authentication or deployment.

Rich media in ordinary community posts, video, multi-image **feed** carousels,
message attachments and fully functional order tracking require separate
backend/storage, security and performance design before they can be advertised
as operational. Product listings in this beta remain enquiry-based.

## Verification required before merge

- Lint, type-check, unit and integration tests, production build.
- Main's pre-existing public-landing matcher setup and suspended-author test
  fixture were minimally aligned with the exact corrections in security PR #16
  so this UX branch can be validated; application authorization is unchanged.
- Browser acceptance at 320/360/375/390/430px and desktop. Confirm central
  Create dialog, public and signed-in feeds, saving/sharing/responding,
  posting/draft restore, and conversation Deal presentation.
- Authenticated and guest authorization, keyboard open/close behavior, and
  existing messaging stream/regression tests.
- Review any CI failures and configure an approved non-production Preview; do
  not attach production credentials to preview.
