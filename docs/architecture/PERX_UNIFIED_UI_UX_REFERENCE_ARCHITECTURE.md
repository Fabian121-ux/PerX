# perX Unified UI/UX Reference Architecture

Date: 2026-07-17

## 1. Scope

This document is the Stage 1 audit and architecture proposal for a unified perX UX. It uses the requested public platforms only as interaction references:

- Contra: visual simplicity, discovery, profile and opportunity card patterns.
- Wellfound: startup, job, company, compensation, and search structure.
- Faire: commercial marketplace taxonomy, category navigation, supplier/storefront patterns.
- LinkedIn Services: broad service category and provider discovery patterns.

No Contra, Wellfound, Faire, or LinkedIn branding, wording, assets, proprietary content, or exact UI was copied. No full visual rewrite was implemented in this pass.

## 2. Current UX Audit

### Existing Public Pages

- `/`
- `/discover`
- `/opportunities/[slug]`
- `/categories/[slug]`
- `/u/[username]`
- `/about`
- `/how-it-works`
- `/trust-safety`
- `/help`
- `/privacy`
- `/terms`
- `/sign-in`
- `/sign-up`
- `/password-recovery`
- `/offline`

### Existing Protected Pages

Canonical-looking `/app/**` pages:

- `/app`
- `/app/discover`
- `/app/opportunities`
- `/app/opportunities/new`
- `/app/messages`
- `/app/messages/[conversationId]`
- `/app/proposals/sent`
- `/app/proposals/received`
- `/app/deals`
- `/app/deals/[dealId]`
- `/app/deals/[dealId]/milestones`
- `/app/deals/[dealId]/deliveries`
- `/app/deals/[dealId]/escrow`
- `/app/profile/setup`
- `/app/profile/edit`
- `/app/roles`
- `/app/saved`
- `/app/notifications`
- `/app/reviews`
- `/app/settings`
- `/app/settings/security`

Route-group aliases outside `/app/**`:

- `/dashboard`
- `/market`
- `/network`
- `/messages`
- `/deals`
- `/escrow`
- `/wallet`
- `/services`
- `/real-estate`
- `/logistics`
- `/travel-stay`
- `/service-center`
- `/reports`
- `/settings`

Admin:

- `/admin`
- `/admin/users`
- `/admin/profiles`
- `/admin/opportunities`
- `/admin/reports`
- `/admin/reviews`
- `/admin/disputes`
- `/admin/verification`
- `/admin/activity`
- `/admin/audit-logs`
- `/admin/moderation`

Preview, disabled by default:

- `/preview/**`

### Duplicate Routes

The app currently maintains two competing signed-in route systems:

- `/app/**`
- route-group public-looking aliases such as `/dashboard`, `/messages`, `/deals`, `/market`

This makes navigation, auth redirects, sidebar active state, testing, and user support harder. The recommended canonical route system is `/app/**`, with safe redirects from legacy aliases.

### Current Navigation Systems

- `src/lib/navigation/app-routes.ts`
- `src/lib/navigation/sidebar-items.ts`
- `src/components/layout/app-shell.tsx`
- public header through `src/components/layout/site-header.tsx`
- preview shell through `/preview/**`

Issues:

- Sidebar labels include "Money" and "Escrow" while real payments/escrow are inactive.
- `discover` maps to `/market` in `app-routes.ts`, while `/app/discover` also exists.
- `opportunities` maps to `/market`, while `/app/opportunities` exists.
- Workspace aliases use `/messages`, `/deals`, etc., while newer pages exist under `/app`.

### Fixed-Role Onboarding Assumptions

The sign-up flow still asks users to select roles:

- Freelancer
- Client
- Founder
- Investor
- Property Owner

Those roles are tied to authorization capabilities. This conflicts with the new direction that descriptive ecosystem roles should come from completed activities and should not grant capabilities.

### Pages With Excessive Complexity

Beta-material complexity:

- Home page shows future-scale commerce positioning and fake metrics before beta basics are proven.
- Discovery mixes opportunities, profiles, trend metrics, trust claims, filters, and future investment language.
- Dashboard/app home presents trend and connection cards without verified backing.
- Finance-adjacent wallet/escrow surfaces were present even though functionality is unavailable; wording has now been tightened.

### Dead or Placeholder Links

Potential beta confusion:

- `/wallet`
- `/escrow`
- `/real-estate`
- `/logistics`
- `/travel-stay`
- `/services`
- `/market`

These should be hidden, marked unavailable, or placed under a secondary future menu until functional.

### Mobile-Navigation Problems

Current audit findings from code inspection:

- There are multiple route targets for the same concept.
- Filter button in discovery exists but does not open a functional mobile drawer.
- Wide right rails and dashboard cards may crowd smaller viewports.
- Some tables require overflow wrappers; admin and escrow-like pages need focused mobile checks after staging is fixed.

### Inconsistent Cards, Buttons and Forms

Components exist, but pages use mixed rounded values and mixed layout shells:

- `Card`
- `EmptyState`
- `Button`
- `ButtonLink`
- `Field`
- `Input`
- `Textarea`
- `Select`
- `Badge`
- `AppSection`
- `WorkspaceEmptyPage`
- `DiscoverExperience`
- `OpportunityCard`

Recommended action: standardize pages around these components and remove ad hoc route-specific variants.

### Features Shown as Active but Not Implemented

Must remain disabled or labelled unavailable:

- Real payments
- Real escrow
- Wallet balances
- Commodity checkout
- Commercial goods checkout
- Investment custody
- Property transactions
- Logistics fulfillment
- Financial settlement

Copy has been tightened in this pass for active wallet/escrow/deal surfaces.

## 3. Proposed Sitemap

Public:

- Home
- Discover
- Work
- Partnerships
- Businesses
- Marketplace
- Opportunities
- People
- How perX Works
- Trust & Safety
- Sign In
- Join perX

Controlled-beta visible primary navigation:

- Discover
- Work
- Partnerships
- Businesses

Secondary or unavailable:

- Marketplace
- Investments
- Property
- Logistics
- Wallet
- Real escrow

Signed-in:

- Home
- Discover
- My Activity
- Listings
- Connections
- Messages
- Agreements
- Saved
- Notifications
- Profile
- Business
- Settings

Admin:

- Overview
- Users
- Profiles
- Opportunities/Listings
- Reports
- Reviews
- Disputes
- Verification
- Audit Logs
- Moderation

## 4. Public Navigation Map

Primary beta nav:

- Discover -> `/discover`
- Work -> `/discover?type=JOB`
- Partnerships -> `/discover?type=PARTNERSHIP`
- Businesses -> future `/businesses` or `/discover?type=BUSINESS`

Secondary menu:

- Opportunities
- People
- Marketplace, labelled "Not available during beta" where needed
- How perX Works
- Trust & Safety

Authentication:

- Sign In -> `/sign-in`
- Join perX -> `/sign-up`

## 5. Signed-In Navigation Map

Canonical target: `/app/**`

- Home -> `/app`
- Discover -> `/app/discover`
- My Activity -> `/app/activity` or `/app`
- Listings -> `/app/opportunities`
- Connections -> `/app/connections` or existing messages/network consolidation
- Messages -> `/app/messages`
- Agreements -> `/app/deals`
- Saved -> `/app/saved`
- Notifications -> `/app/notifications`
- Profile -> `/app/profile/edit`
- Business -> future `/app/business`
- Settings -> `/app/settings`

Alias redirects after approval:

- `/dashboard` -> `/app`
- `/messages` -> `/app/messages`
- `/deals` -> `/app/deals`
- `/market` -> `/app/discover`
- `/opportunities/new` -> `/app/opportunities/new`
- `/profile/edit` -> `/app/profile/edit`

## 6. User Journey Map

Visitor:

1. Lands on Home.
2. Searches or opens Discover.
3. Reviews opportunity/person/business cards.
4. Opens detail page.
5. Joins perX or signs in to save, propose, message, or post.

New user:

1. Creates account without fixed-role selection.
2. Completes foundational profile.
3. Chooses "What would you like to do?"
4. Completes an activity.
5. Receives descriptive ecosystem role from the completed activity.

Worker/professional:

1. Offer a skill or respond to work.
2. Message around an opportunity.
3. Submit proposal.
4. Work through agreement/delivery.
5. Earn trust/reputation signal.

Job creator/client:

1. Post work or opportunity.
2. Review proposals.
3. Accept proposal.
4. Manage agreement/delivery.
5. Leave review.

## 7. Page-by-Page Structure

Home:

- Simple hero with search/explore CTA.
- Main action cards.
- Active beta categories.
- Featured opportunities/workers/businesses only when backed by real or clearly demo data.
- How perX works.
- Trust and verification.
- Beta boundary disclosure for unavailable finance.

Discover:

- One prominent search input.
- Category tabs: All, Opportunities, People, Work, Services, Partnerships, Businesses, Marketplace.
- Filter button opens a mobile drawer.
- Consistent cards with save, location, type, date, trust indicator, and primary action.
- Controlled database-error state.

Person profile:

- Identity, headline, location, skills, services, experience, portfolio, reviews, trust indicators, availability, connect action.

Business profile:

- Business identity, industry, location, description, team, opportunities, products/services, partnership interests, trust indicators, contact action.

Opportunity page:

- Title, creator, type, summary, requirements, location, value/compensation, timeline, trust information, apply/express-interest action, similar opportunities.

Work/service page:

- Provider, skill category, description, experience, delivery approach, availability, location, reviews, request/contact action.

Partnership page:

- Objective, creator, business context, needed contribution, expected contribution, location, timeline, expression-of-interest action.

Commercial listing page:

- Product/commodity, seller, category, description, quantity, location, availability, verification status, contact seller.
- Enquiry-only during beta.

## 8. Reusable Component Inventory

Reusable now:

- `AppShell`
- `AppSection`
- `PublicPageShell`
- `WorkspaceEmptyPage`
- `DiscoverExperience`
- `OpportunityCard`
- `BrandLogo`
- `Card`
- `EmptyState`
- `Badge`
- `Button`
- `ButtonLink`
- `Field`
- `Input`
- `Textarea`
- `Select`
- `MessageWorkspace`

Needed:

- `SearchBar`
- `FilterDrawer`
- `ListingCard`
- `PersonCard`
- `BusinessCard`
- `UnavailableFeatureState`
- `BetaDisclosureBanner`
- `ActionChooser`
- `CanonicalNav`

## 9. Desktop Wireframe Descriptions

Home desktop:

- Header with compact nav and auth actions.
- Left-aligned hero with search.
- Action cards in a restrained grid.
- Discovery preview sections stacked vertically.
- No fake metrics above the fold.

Discover desktop:

- Search and filters top band.
- Category chips below.
- Left filter rail on wide screens.
- Two or three-column card grid.
- Right rail only when content is useful; otherwise remove.

Signed-in home desktop:

- Compact app header/sidebar.
- "My Activity" summary.
- Action queue.
- Recent messages/proposals/deals.
- No duplicate route destinations.

## 10. Mobile Wireframe Descriptions

Mobile home:

- Header with logo, menu, sign-in/join.
- Hero search first.
- Action cards in one column.
- Sections short and scannable.

Mobile discover:

- Sticky search at top of content.
- Horizontal category chips.
- Filter drawer opened by one button.
- Single-column cards.
- Clear empty/unavailable state.

Mobile signed-in app:

- Bottom nav for Home, Discover, Messages, Activity, Profile.
- Secondary actions in menus.
- Forms full width with large touch targets.
- Modals/drawers constrained to viewport height.

## 11. Route Consolidation Plan

1. Choose `/app/**` as canonical signed-in routing.
2. Add redirects from route-group aliases.
3. Update `app-routes.ts` and `sidebar-items.ts`.
4. Update tests to use canonical routes.
5. Remove duplicate page implementations after redirect coverage.
6. Keep preview isolated under `/preview/**`.

Do not remove aliases until telemetry/manual tests confirm no broken links.

## 12. Fixed-Role Removal Plan

1. Remove role checkboxes from sign-up UI.
2. Update auth validation to require name, email, password only.
3. Stop creating self-selected `UserRole` rows at sign-up.
4. Add post-onboarding action chooser.
5. Introduce descriptive ecosystem roles from activity completion.
6. Keep server capabilities separate.
7. Remove or repurpose `/app/roles` after capability grant design is approved.

## 13. Beta and Future-Feature Separation

Active beta:

- Profiles
- Businesses, if backed by real model or clearly basic profile grouping
- Opportunities
- Work requests
- Skill/service offers
- Partnership requests
- Discovery
- Messaging
- Proposals/expressions of interest
- Reputation/trust signals

Unavailable during beta:

- Real payments
- Real escrow
- Commodity checkout
- Investment custody
- Property transactions
- Logistics fulfillment
- Wallet
- Financial settlement

## 14. Exact Files to Modify

Navigation and IA:

- `src/lib/navigation/app-routes.ts`
- `src/lib/navigation/sidebar-items.ts`
- `src/components/layout/app-shell.tsx`
- `src/components/layout/site-header.tsx`

Role-free onboarding:

- `src/app/(auth)/sign-up/page.tsx`
- `src/features/auth/actions.ts`
- `src/lib/validation/auth.ts`

Discovery:

- `src/app/(public)/discover/page.tsx`
- `src/app/app/discover/page.tsx`
- `src/components/discover/discover-experience.tsx`
- new shared filter drawer/card components

Templates:

- `src/app/(public)/opportunities/[slug]/page.tsx`
- `src/app/(public)/u/[username]/page.tsx`
- future business/service/partnership pages

Future-feature gating:

- `src/app/(workspace)/wallet/page.tsx`
- `src/app/(workspace)/escrow/page.tsx`
- `src/app/(workspace)/market/page.tsx`
- `src/app/(workspace)/services/page.tsx`
- `src/app/(workspace)/real-estate/page.tsx`
- `src/app/(workspace)/logistics/page.tsx`

Tests:

- `tests/e2e/primary-flow.spec.ts`
- `tests/e2e/smoke.spec.ts`
- unit tests for onboarding and role inference once approved

## 15. Implementation Phases

Phase 1:

- Keep beta boundaries clear.
- Fix misleading finance wording.
- Document IA and role model.
- Do not run full redesign.

Phase 2:

- Remove fixed-role onboarding.
- Add action chooser.
- Consolidate signed-in routes.
- Make discovery simpler with mobile filter drawer.

Phase 3:

- Introduce `EcosystemRole`.
- Add role inference from completed activities.
- Split security capabilities from descriptive roles.

Phase 4:

- Expand listing taxonomy after beta evidence.
- Add business/service/partnership templates.

Phase 5:

- Consider real payments/escrow only with compliant provider, legal review, and operational monitoring.

## 16. Risks and Migration Considerations

- Route consolidation can break saved links unless redirects are explicit.
- Removing role selection can break capability checks unless temporary default capabilities or server-owned grants are designed.
- Discovery unification can overcomplicate filters; keep beta categories simple.
- Marketplace expansion can produce false promises; unavailable modules must be visibly disabled.
- Public references can over-influence the UI; perX must retain its own identity, colors, logo, and broader trust-commerce vision.

## 17. Implementation Status in This Pass

Implemented now:

- Architecture proposal document.
- Payment/escrow copy tightened on active pages.
- Public static copy aligned with activity-derived role direction.

Not implemented pending review:

- Full visual rewrite.
- Route consolidation.
- Fixed-role onboarding removal.
- New listing taxonomy migration.
- Business/marketplace/people page build-out.

## 18. 2026-07-18 Enhancement Status

This follow-up pass implemented the approved reference-led enhancement without replacing the existing perX architecture.

Implemented:

- Homepage hero now communicates: "Discover trusted people, businesses and opportunities."
- Homepage now includes search, main activity paths, featured opportunities, people preview, partnership discovery, marketplace/business beta boundary, how it works, trust and final CTA sections.
- Discover now uses the requested category model: All, Opportunities, People, Work, Services, Partnerships, Businesses and Marketplace.
- Discover has a real mobile filter drawer with focus trapping, Escape-to-close and accessible labels.
- Businesses and Marketplace use controlled unavailable states instead of fake production data.
- Sign-up no longer asks users to permanently self-select Founder, Investor, Freelancer, Client, Worker or Business identities.
- Profile setup now focuses on name, username, profile photograph URL, location, introduction, website/portfolio and skills.
- Profile setup includes "What would you like to do?" navigation choices only; these choices do not grant roles or capabilities.
- Signed-in home no longer fabricates activity, trend analytics, balances, earnings or transaction totals.
- Workspace search now submits to signed-in or preview discovery instead of opening a placeholder dialog.
- Mobile public and workspace navigation drawers now use dialog focus handling.
- Public profile rendering supports profile photographs while preserving initials fallback.
- Agreement detail styling is consolidated under PerX tokens.
- App icons and favicon are regenerated from `public/main_app_logo.png` after visible-artwork cropping.
- `favicon.ico` now includes 16px, 32px and 48px entries.
- Manifest normal icons use `purpose: "any"` and maskable icons use `purpose: "maskable"`.
- Service-worker cache was incremented to `perx-public-shell-v5`.
- Root layout no longer depends on remote Google font downloads during build.
- `/preview/admin` no longer imports strict data-mode validation through the root mock-mode indicator during prerender.
- `ERROR_MONITORING_DSN` is optional until a provider is configured; non-empty values remain URL-validated.
- `PERX_DATA_MODE=mock` is explicitly rejected in production build/config and runtime data-mode resolution.

Still deferred:

- Full route alias consolidation from legacy workspace aliases into canonical `/app/**` redirects.
- Dedicated database-backed business profiles and business discovery routes.
- Dedicated service/provider listings separate from opportunity types.
- Real marketplace checkout, payment, escrow, wallet, custody, settlement and protected-funds claims.
- Activity-derived ecosystem roles to replace capability roles after authorization design is approved.
