# Implementation Plan

## Phase 0: Audit and Plan

Status: complete.

Tasks:

- Inspect repository contents.
- Inspect image assets.
- Record missing framework, package manager, database, auth, routes, and components.
- Record that existing checks cannot run because no app exists.
- Define production-oriented architecture.
- Define implementation risks.

Risks:

- The repo is not initialized as git.
- The initial image source files were empty during Phase 0, but valid reference screenshots are now present in `public/image_ux_ux`.
- The MVP scope is large and must be implemented in slices to avoid disconnected pages.

## Phase 1: Foundation

Goals:

- Scaffold the application with Next.js App Router, TypeScript, Tailwind, Prisma, PostgreSQL, Zod, and tests.
- Copy `image_ux_ux` into `public/image_ux_ux` while preserving the original directory.
- Add environment validation and `.env.example`.
- Add base layout, design tokens, responsive shell, navigation, and shared UI components.
- Add PWA manifest, icons, service worker registration, and offline fallback.
- Add Prisma schema, migrations, and seed data.
- Add lint, formatting, type-check, unit test, integration test, e2e test, and build scripts.
- Add CI workflow.
- Add health-check endpoint.

Status: implemented for the MVP scaffold.

Completion checks:

- `npm run lint`
- `npm run type-check`
- `npm run test`
- `npm run build`

## Phase 2: Identity

Goals:

- Implement registration, sign in, sign out, password recovery shell, secure sessions, and protected route guards.
- Implement one-account, many-role model.
- Implement profiles with headline, biography, location, image URL, skills, portfolio, work history, verification status, roles, ratings, reviews, completed deals, trust score, and profile completeness.
- Implement role management and capability checks.
- Implement public profile pages.

Security checks:

- Server-side authentication for all private pages.
- Object-level authorisation for profile edits.
- Capability checks for role-sensitive actions.

Status: implemented as a database-backed session and role/capability foundation.

## Phase 3: Opportunities

Goals:

- Implement central opportunity model.
- Support jobs and freelance projects for MVP.
- Add create, edit, draft, publish, pause, close, archive, details, search, filter, sort, bookmark, report, pagination, ownership, and moderation status.
- Add discover and category pages backed by persisted data.

Security checks:

- Owners can manage their own opportunities.
- Admin/moderator capabilities required for moderation.
- Public users can read only published, approved opportunities.

Status: implemented for jobs and freelance projects with create, discover, detail, save/report actions, and owner dashboard.

## Phase 4: Collaboration

Goals:

- Implement conversations, participants, messages, attachments metadata, read receipts, blocking/reporting controls, and authorisation.
- Implement proposal submission, withdrawal, acceptance, rejection, counteroffer, milestones, revisions, and status history.
- Ensure messaging cannot mutate monetary or escrow states.

Security checks:

- Only participants can read or send messages in a conversation.
- Only eligible users can submit proposals.
- Only opportunity owners can accept/reject received proposals.

Status: partially implemented. Conversation/proposal schema and proposal submission/acceptance are present. Rich message composition and attachment upload validation remain future hardening work.

## Phase 5: Transactions and Trust

Goals:

- Implement deal creation from accepted proposal.
- Implement milestones, deliveries, approvals, release simulation, refunds, disputes, ledger entries, and escrow status history.
- Implement provider-independent escrow adapter.
- Implement reviews and trust breakdowns.

Security checks:

- Escrow transitions are state-machine validated, authorised, logged, and idempotent.
- Review eligibility is enforced server-side.
- Monetary values use integer minor units.

Status: implemented as a provider-independent simulated escrow state machine, deal records, deliveries, approvals, releases, ledger entries, reviews, and trust-score logic.

## Phase 6: Administration

Goals:

- Implement admin dashboard, users, profiles, opportunities, reports, reviews, disputes, verification requests, audit logs, platform activity, and moderation actions.
- Add admin action logging.

Security checks:

- Admin pages and operations require admin capability server-side.
- Moderation actions are persisted and auditable.

Status: implemented as protected admin route tree and operational queues. Concrete moderation mutation screens remain future hardening work.

## Phase 7: Hardening

Goals:

- Expand unit, integration, and e2e coverage.
- Run accessibility review.
- Run security review.
- Run PWA installability checks.
- Review performance.
- Add deployment documentation, backup notes, and migration notes.

Completion checks:

- Lint passes.
- Type-check passes.
- Tests pass.
- Production build passes.
- Primary e2e journey passes.
- No known critical security issue remains.

Status: baseline implemented. Lint, type-check, unit/integration tests, e2e smoke tests, and production build pass. Remaining risks are documented in `docs/CURRENT_STATE_AUDIT.md`.

## Primary End-to-End Journey

The primary test must cover:

1. User registration.
2. Profile completion.
3. Role selection.
4. Client publishes an opportunity.
5. Freelancer discovers it.
6. Freelancer submits a proposal.
7. Client accepts the proposal.
8. Deal is created.
9. Milestone is delivered.
10. Client approves it.
11. Escrow state becomes releasable or released in the simulated architecture.
12. Both participants leave eligible reviews.

## Implementation Guardrails

- Do not display legacy names or alternate capitalization in UI.
- Do not create dead buttons.
- Do not hide security-sensitive actions only in the frontend.
- Do not use floating-point numbers for money.
- Do not cache private or user-specific data in the service worker.
- Do not force corrupted images into the UI.
- Do not build startup investing, live payments, real estate, AI tools, or analytics before the foundation is stable.

## Phase 8: Simplified Local Demo Preview

Status: complete.

We simplified the Demo Preview feature to be a quick local UI preview using static data under a dedicated `/preview` route group.

Key Implementations:
- Decoupled Demo Preview from database requirements: PostgreSQL, seed scripts, sessions, and environment variables are not required to open `/sign-in` or any `/preview` subroute.
- Created `/preview` route group (`src/app/(preview)`) with custom responsive `PreviewShell` layout.
- Created local static mock data in `src/lib/data/preview.ts` for professional profiles, opportunities, proposals, message logs, and escrow deal workflows.
- Cleaned up real authentication systems: deleted obsolete `src/lib/demo.ts` and `prisma/seed-demo.ts`, removed `isDemo` parameters and assertions from the main app's settings pages, shells, and actions to avoid weakening real secure auth.
- Added database-less Vitest integration tests in `tests/unit/demo.test.ts` verifying that `/sign-in` and preview routes render successfully without `DATABASE_URL`.
