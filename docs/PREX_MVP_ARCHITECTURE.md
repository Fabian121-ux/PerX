# perX MVP Architecture

## Product Backbone

perX is an opportunity ecosystem, not a freelance clone. The MVP architecture is organised around this backbone:

Users -> Opportunities -> Chat -> Proposals -> Deals -> Trust -> Escrow -> Reputation

Every model, page, permission, and workflow should support this sequence.

## Chosen Stack

Because the repository has no existing application stack, the MVP will use:

- Framework: Next.js App Router
- Language: TypeScript, strict mode
- Styling: Tailwind CSS
- Database: PostgreSQL
- ORM: Prisma 7 with `@prisma/adapter-pg`
- Validation: Zod
- Authentication: database-backed email/password sessions with secure HTTP-only cookies
- Password hashing: bcrypt-compatible hashing
- Tests: Vitest for business logic and integration tests, Playwright for primary end-to-end flow
- PWA: App Router manifest, service worker, offline fallback, icons, Apple touch icon, favicon
- CI: GitHub Actions workflow for install, lint, type-check, test, and build

## Application Structure

Planned top-level structure:

```text
app/
  (public)/
  (auth)/
  app/
  admin/
  api/
components/
  ui/
  layout/
  forms/
features/
  auth/
  profiles/
  roles/
  opportunities/
  saved-opportunities/
  conversations/
  proposals/
  deals/
  escrow/
  reviews/
  trust/
  admin/
lib/
  auth/
  db/
  permissions/
  validation/
  money/
  rate-limit/
  logging/
  security/
prisma/
  schema.prisma
  seed.ts
public/
  image_ux_ux/
  icons/
tests/
  unit/
  integration/
  e2e/
docs/
```

## Core Data Model

### Identity

- `User`
- `Session`
- `Role`
- `UserRole`
- `Profile`
- `ProfileSkill`
- `PortfolioItem`
- `WorkHistory`
- `VerificationRequest`
- `Notification`
- `AuditLog`

Users have one account and many roles. Roles provide capabilities; they are not separate accounts.

### Opportunities

- `Opportunity`
- `OpportunityCategory`
- `OpportunityBookmark`
- `OpportunityReport`
- `OpportunityStatusHistory`

The central `Opportunity` model supports MVP opportunity types:

- Job
- Freelance project

It should be extensible for later types:

- Startup
- Co-founder opportunity
- Investment opportunity
- Property
- Service
- Partnership

### Collaboration

- `Conversation`
- `ConversationParticipant`
- `Message`
- `MessageAttachment`
- `MessageReadReceipt`
- `BlockedUser`

Messaging is communication only. It must not control money, escrow, or deal state.

### Proposals

- `Proposal`
- `ProposalMilestone`
- `ProposalStatusHistory`

Proposals support amount, description, delivery period, milestones, revisions, withdraw, accept, reject, and counteroffer.

### Deals and Escrow

- `Deal`
- `DealParticipant`
- `DealMilestone`
- `Delivery`
- `Approval`
- `Release`
- `Refund`
- `Dispute`
- `LedgerEntry`
- `EscrowStatusHistory`

Money is stored in integer minor units with currency codes, never ordinary floating-point values.

Escrow states:

- Draft
- Awaiting funding
- Funded
- In progress
- Submitted
- Under review
- Approved
- Released
- Cancelled
- Refund pending
- Refunded
- Disputed
- Resolved

The escrow layer must expose a provider-independent adapter interface so a regulated payment provider can be connected later.

### Reviews and Trust

- `Review`
- `TrustSignal`
- `ModerationAction`

Reviews require an eligible completed deal. The system prevents self-reviews, duplicate reviews for the same deal, reviews by non-participants, and reviews before completion.

Trust scores must be explainable through a breakdown of signals:

- Verification
- Profile completeness
- Completed deals
- Successful deliveries
- Ratings
- Disputes
- Moderation history
- Account history

## Permission Model

The application will use capability-aware authorisation.

Examples:

- `opportunity:create`
- `opportunity:update:own`
- `opportunity:moderate`
- `proposal:create`
- `proposal:decide:received`
- `conversation:read:participant`
- `deal:view:participant`
- `deal:transition:participant`
- `admin:access`
- `admin:moderate`

Every protected server operation must verify:

- Authentication
- Object ownership or participation
- Role/capability
- Current object state
- Validated input

## Routing Plan

Public:

- `/`
- `/discover`
- `/opportunities/[slug]`
- `/categories/[slug]`
- `/u/[username]`
- `/about`
- `/how-it-works`
- `/trust-safety`
- `/help`
- `/terms`
- `/privacy`
- `/sign-in`
- `/sign-up`
- `/password-recovery`

Authenticated app:

- `/app`
- `/app/profile/setup`
- `/app/profile/edit`
- `/app/roles`
- `/app/opportunities/new`
- `/app/opportunities`
- `/app/saved`
- `/app/proposals/sent`
- `/app/proposals/received`
- `/app/messages`
- `/app/messages/[conversationId]`
- `/app/deals/[dealId]`
- `/app/deals/[dealId]/milestones`
- `/app/deals/[dealId]/deliveries`
- `/app/deals/[dealId]/escrow`
- `/app/reviews`
- `/app/notifications`
- `/app/settings`
- `/app/settings/security`

Admin:

- `/admin`
- `/admin/users`
- `/admin/profiles`
- `/admin/opportunities`
- `/admin/reports`
- `/admin/reviews`
- `/admin/disputes`
- `/admin/verification`
- `/admin/audit-logs`
- `/admin/activity`
- `/admin/moderation`

Preview (Database-less Static UI Preview):

- `/preview`
- `/preview/profile`
- `/preview/opportunities`
- `/preview/opportunities/new`
- `/preview/saved`
- `/preview/proposals/sent`
- `/preview/proposals/received`
- `/preview/messages`
- `/preview/messages/demo-conversation`
- `/preview/deals/demo-deal`
- `/preview/deals/demo-deal/milestones`
- `/preview/deals/demo-deal/escrow`
- `/preview/reviews`
- `/preview/notifications`
- `/preview/settings`

## PWA Architecture

The PWA implementation will include:

- `app/manifest.ts`
- Service worker registration
- Offline fallback page
- Safe public asset/application shell caching
- No caching of auth responses, private messages, user-specific API responses, admin data, deal data, or mutation responses
- Update flow that calls `skipWaiting` and reloads only after a new worker is ready
- 192x192 and 512x512 icons
- Maskable icon support where possible
- Apple touch icon and favicon

## Security Architecture

Required controls:

- Server-only session lookup
- Secure HTTP-only session cookies
- CSRF-aware mutation design through Server Actions and validated POST APIs
- Zod validation for all external inputs
- Object-level authorisation on every protected operation
- Monetary validation using integer minor units
- Safe file upload type and size validation
- Rate limiting hooks for auth and mutation endpoints
- Security headers in middleware
- Environment variable validation
- Structured logging without secrets
- Audit logging for privileged and state-changing operations
- Safe error messages

## Performance Architecture

- Prefer Server Components
- Keep Client Components limited to forms, menus, toasts, and interactive controls
- Use server-side pagination
- Add Prisma indexes for search and ownership queries
- Avoid N+1 queries through includes/selects
- Use `next/image` for valid local assets
- Dynamically import heavy optional UI
- Avoid public caching for private data
