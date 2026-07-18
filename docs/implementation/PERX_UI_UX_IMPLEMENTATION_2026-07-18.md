# PerX UI/UX Implementation Report

Date: 2026-07-18

## Scope

This was an enhancement and consolidation pass. It preserved existing authentication, authorization, protected routes, server actions, data-provider boundaries, database models and PerX branding. The reference sites were used for interaction patterns only: Contra for discovery simplicity, Wellfound for opportunity/business listing hierarchy, Malt for profile hierarchy, Faire for enquiry-based marketplace structure and Airbnb for mobile filters.

## Page Classification

| Route or group | Classification | Notes |
| --- | --- | --- |
| `/` | ENHANCE | Enhanced search-led homepage and activity hierarchy. |
| `/discover`, `/app/discover`, `/preview/discover` | ENHANCE | Unified tabs, search, filters, people results and unavailable states. |
| `/opportunities/[slug]` | ENHANCE | Existing listing detail preserved; hierarchy and response form retained. |
| `/u/[username]` | ENHANCE | Public profile now supports photograph fallback and improved identity hierarchy. |
| `/sign-up` | ENHANCE | Removed permanent self-selected role checkboxes. |
| `/app/profile/setup` | ENHANCE | Added basic profile fields and activity chooser. |
| `/app` | ENHANCE | Removed fake activity/trend data; added welcome, search, profile completion and empty states. |
| `/app/messages`, `/preview/messages` | ENHANCE | Existing workspace preserved; verified responsive behavior. |
| `/app/deals`, `/app/deals/[dealId]`, `/preview/deals/demo-deal` | ENHANCE | Agreement wording and token styling retained; verified responsive behavior. |
| `/app/profile/edit` | ENHANCE | Added profile photo and website fields using existing schema columns. |
| `/categories/[slug]` | CONSOLIDATE | Keep for now; long-term fold into discovery category filters. |
| Legacy workspace aliases (`/dashboard`, `/messages`, `/deals`, `/market`, `/settings`, etc.) | CONSOLIDATE | Preserved; redirects deferred. |
| `/network`, `/roles` | RESTRUCTURE | Future people discovery and activity-derived role model. |
| `/wallet`, `/escrow`, `/real-estate`, `/logistics`, `/travel-stay`, `/services` | COMING_LATER | Future verticals; no live payment/custody claims added. |
| Static legal/help pages | KEEP | No behavioral changes. |
| `/admin/**` | KEEP/ENHANCE | Admin architecture preserved; `/preview/admin` build issue fixed without weakening real admin. |
| `/preview/**` | KEEP | Gated by `PERX_ENABLE_PREVIEW`, static fixtures only. |

## Pages Enhanced

- Homepage
- Discover
- Onboarding/sign-up/profile setup
- Signed-in home
- Person profile
- Opportunity discovery/detail surfaces
- Messages preview/workspace behavior
- Agreements list/detail behavior
- PWA icon surfaces
- Preview admin build path

Business profile remains `COMING_LATER` because there is no dedicated database-backed business model/profile route yet.

## Components Reused

- `SiteHeader`, `MobileNav`
- `AppShell`, `DashboardSidebar`, `DashboardTopbar`, `MobileDashboardDrawer`
- `AppSection`, `MetricGrid`
- `Card`, `EmptyState`, `Badge`, `Button`, `ButtonLink`, `Field`, `Input`, `Textarea`, `Select`
- `DiscoverExperience`, `MobileFilterDrawer`
- `OpportunityCard`
- `MessageWorkspace`
- `FeatureStatusDialog`

## Components Created Or Substantially Extended

- `PersonDiscoveryCard` inside `DiscoverExperience`
- `UnavailableDiscoveryState` inside `DiscoverExperience`
- `ProfileCompletionCard` and `WorkspaceQueueCard` inside signed-in home dashboard
- Homepage `FeaturedPeople` and `PartnershipAndMarketplacePreview` sections

No new UI library was added.

## Navigation Changes

- Public mobile nav now uses Radix Dialog focus handling.
- Workspace mobile drawer now uses Radix Dialog focus handling.
- Workspace topbar search now submits to `/app/discover` or `/preview/discover`.
- Dashboard quick actions now mirror activity choices: Find Work, Offer a Skill, Post Opportunity, Find Co-founder, Find a Partner, Explore Businesses, Buy or Sell.
- Route alias consolidation was documented but deferred.

## Discovery Improvements

- Prominent search remains at the top.
- Tabs now match the requested taxonomy: All, Opportunities, People, Work, Services, Partnerships, Businesses, Marketplace.
- People view renders profile cards.
- Businesses and Marketplace render controlled unavailable beta states.
- Mobile filters are a bottom drawer with focus trap and Escape-to-close.
- Sort control is present and submits with current search parameters.
- Cards retain save, type, location, date, trust and primary action hierarchy.
- Empty and database-unavailable states remain explicit.

## Onboarding Improvements

- Sign-up no longer asks for Founder, Investor, Freelancer, Client, Worker or Business identity assignment.
- Sign-up collects account basics only.
- Profile setup collects name, username, profile photograph URL, location, introduction, website/portfolio and skills.
- "What would you like to do?" appears as navigation choices only.
- Signup no longer creates `UserRole` rows from self-selected checkboxes.
- Existing role/capability infrastructure remains intact for authorization.

## Dashboard Improvements

- Removed hardcoded connections, activity feed, profile recommendations and opportunity trend percentages.
- Preserved real metrics for agreements and proposals from the data provider.
- Added welcome section, real search entry, quick actions, profile completion and honest empty states for messages/saved/recommendations.
- No balances, fake earnings, fake transaction totals or empty analytics graphs were added.

## Profile Improvements

- Public profile supports `profileImageUrl` with initials fallback.
- Profile setup/edit now persist `profileImageUrl` and `websiteUrl` using existing Prisma columns.
- Malt-inspired hierarchy remains: identity, headline, location, trust, skills, experience, reviews and contact.

## Mobile And Accessibility Improvements

- Public mobile nav, workspace drawer, mobile filters and feature dialogs now use dialog focus behavior.
- Escape-to-close is handled by Radix Dialog for those drawers/dialogs.
- Icon buttons have accessible labels.
- Search inputs have labels.
- Responsive checks at 375, 430, 768, 1024, 1280 and 1440px found no horizontal overflow on public and preview priority pages.
- Existing focus-visible rings were preserved and expanded on new controls.

## Icon Source And Crop Changes

- Source: `public/main_app_logo.png`.
- The generator now detects visible non-white artwork bounds before resizing.
- Excess white padding is removed before compositing.
- Standard icons use a larger target artwork ratio: about 90% of canvas, 92% for 16/32px favicons.
- Maskable icons use separate safe-zone sizing at about 74% target artwork size.
- Background remains white.
- No full horizontal wordmark is used for small app icons.

Measured visible bounds after regeneration:

| Icon | Occupancy |
| --- | --- |
| `favicon-16x16.png` | 93.8% width, 81.3% height |
| `favicon-32x32.png` | 90.6% width, 81.3% height |
| `favicon-48x48.png` | 89.6% width, 79.2% height |
| `apple-touch-icon.png` | 87.8% width, 77.8% height |
| `icon-192.png` | 88.0% width, 78.1% height |
| `icon-512.png` | 87.5% width, 77.7% height |
| `maskable-icon-192.png` | 71.9% width, 64.1% height |
| `maskable-icon-512.png` | 71.9% width, 63.9% height |

The standard 192px icon, 192px maskable icon and 32px favicon were visually inspected.

## Generated Icon List

- `public/favicon.ico` with 16, 32 and 48px entries
- `public/icons/favicon-16x16.png`
- `public/icons/favicon-32x32.png`
- `public/icons/favicon-48x48.png`
- `public/icons/apple-touch-icon.png`
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`
- `public/icons/maskable-icon-192.png`
- `public/icons/maskable-icon-512.png`

## Manifest, Metadata And Service Worker

- `src/app/layout.tsx` references `/favicon.ico`, 16/32/48 png favicons, Apple icon and PWA icons.
- `src/app/manifest.ts` uses `purpose: "any"` for standard icons.
- `src/app/manifest.ts` uses `purpose: "maskable"` for adaptive icons.
- `public/sw.js` cache version changed to `perx-public-shell-v5`.
- Service worker now caches favicon PNGs and Apple touch icon alongside PWA icons.

## Preview Admin Build Failure Root Cause

Import chain:

`/preview/admin` prerender -> `src/app/layout.tsx` root layout -> `MockModeIndicator` -> `getResolvedDataMode()` -> `getServerEnv()` -> strict Vercel validation.

The strict required list included `ERROR_MONITORING_DSN`, so a disabled preview route could fail prerender before the preview gate could return `notFound()`. `PERX_DATA_MODE` was also pulled into the root render path through the same indicator.

Fixes:

- `MockModeIndicator` now reads only `process.env.PERX_DATA_MODE` and does not initialize the data layer.
- `ERROR_MONITORING_DSN` was removed from the strict required variable list.
- Non-empty monitoring DSNs are still URL-validated by the schema.
- `PERX_DATA_MODE=mock` remains forbidden in production.
- `next.config.ts` fails production mock builds with the explicit production-mock error.
- Preview modules continue to use static fixtures and do not import Prisma/provider code at module scope.

## Environment Variable Matrix

| Variable | Local development | Vercel Preview | Vercel Production | Visibility | Timing |
| --- | --- | --- | --- | --- | --- |
| `PERX_DATA_MODE` | Required for selected mode; `mock` allowed locally | Required, set `database` | Required, set `database` | Server-only | Build-time and runtime |
| `DATABASE_URL` | Required for database mode | Required | Required | Server-only secret | Build-time and runtime |
| `DIRECT_URL` | Required for database mode and Prisma | Required | Required | Server-only secret | Build-time and runtime |
| `NEXT_PUBLIC_SUPABASE_URL` | Required for database mode | Required | Required | Public | Build-time and runtime |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Required for database mode | Required | Required | Public | Build-time and runtime |
| `NEXT_PUBLIC_APP_URL` | Optional locally, defaults localhost | Required, non-localhost | Required, production URL | Public | Build-time metadata and runtime |
| `PERX_ENABLE_PREVIEW` | Optional, defaults `false`; set `true` only for local/demo review | Set `false` unless deliberately reviewing preview routes | Set `false` | Server-only | Build-time and runtime |
| `ERROR_MONITORING_DSN` | Optional; empty disables monitoring | Optional until provider configured | Optional until provider configured | Server-only unless provider documents otherwise | Build-time validation and runtime |
| `SESSION_COOKIE_NAME` | Optional default `perx_session` | Optional/default | Optional/default | Server-only | Runtime |
| `AUTH_SESSION_DAYS` | Optional default `30` | Optional/default | Optional/default | Server-only | Runtime |
| `UPLOAD_MAX_BYTES` | Optional default `5242880` | Optional/default | Optional/default | Server-only | Build-time and runtime |
| `LOG_LEVEL` | Optional default `info` | Optional/default | Optional/default | Server-only | Runtime |
| Seed/dev variables | Local only | Not required | Not required | Server-only secret where used | Seed-time only |

Configure these exact names in Vercel Project -> Settings -> Environment Variables for Preview and Production:

- `PERX_DATA_MODE=database`
- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `PERX_ENABLE_PREVIEW=false`

Optional in Vercel:

- `ERROR_MONITORING_DSN`
- `SESSION_COOKIE_NAME`
- `AUTH_SESSION_DAYS`
- `UPLOAD_MAX_BYTES`
- `LOG_LEVEL`

Values added only to local `.env` are not available to Vercel deployments.

## Validation Results

| Command | Result |
| --- | --- |
| `npm run lint` | PASS, 0 errors, 5 pre-existing warnings |
| `npm run type-check` | PASS |
| `npm run test` | PASS, 14 files and 62 tests |
| `npm run test:e2e` | PASS, 14 tests after updating expected homepage CTA |
| `npm run brand:generate` | PASS |
| `npx prisma validate` | PASS |
| `npx prisma generate` | PASS |
| `npm run build` | PASS after sandbox escalation for Turbopack internal worker/port |
| `npx next build --debug-prerender` | PASS after sandbox escalation |
| `npx cross-env NODE_ENV=production PERX_DATA_MODE=mock npm run build` | FAILS AS EXPECTED with `PERX_DATA_MODE=mock is strictly prohibited in production.` |
| `node scratch/verify-responsive.mjs` | PASS, no failures at 375/430/768/1024/1280/1440 |
| `env PERX_ENABLE_PREVIEW=true node scratch/verify-responsive.mjs` | PASS, no failures including preview messages and agreement pages |

The first un-escalated `npm run build` failed because the sandbox prevented Turbopack from spawning/binding an internal worker. The escalated build passed.

## Files Modified

Key code and asset paths changed:

- `.env.example`
- `next.config.ts`
- `scripts/generate-brand-icons.mjs`
- `public/favicon.ico`
- `public/icons/*`
- `public/sw.js`
- `src/app/layout.tsx`
- `src/app/manifest.ts`
- `src/app/page.tsx`
- `src/app/(auth)/sign-up/page.tsx`
- `src/app/(public)/discover/page.tsx`
- `src/app/(public)/u/[username]/page.tsx`
- `src/app/(preview)/preview/discover/page.tsx`
- `src/app/app/page.tsx`
- `src/app/app/discover/page.tsx`
- `src/app/app/profile/setup/page.tsx`
- `src/app/app/profile/edit/page.tsx`
- `src/app/app/deals/[dealId]/page.tsx`
- `src/components/dashboard/*`
- `src/components/discover/*`
- `src/components/layout/*`
- `src/components/shared/feature-status-dialog.tsx`
- `src/features/auth/actions.ts`
- `src/features/profiles/actions.ts`
- `src/features/profiles/setup-action.ts`
- `src/lib/env.ts`
- `src/lib/validation/auth.ts`
- `src/lib/data/profiles.ts`
- `tests/unit/env.test.ts`
- `tests/unit/auth-actions.test.ts`
- `tests/e2e/primary-flow.spec.ts`
- `docs/architecture/PERX_UNIFIED_UI_UX_REFERENCE_ARCHITECTURE.md`
- `docs/implementation/PERX_UI_UX_IMPLEMENTATION_2026-07-18.md`
- `docs/DEPLOYMENT.md`

## Work Intentionally Deferred

- Automatic deployment.
- Real checkout, real payment, real escrow, wallet, settlement or custody behavior.
- Dedicated business profile route and database-backed business discovery.
- Dedicated commercial listing model and checkout.
- Permanent route alias removal or redirect migration.
- Full admin visual redesign.
- Activity-derived role inference and capability migration.
- Broad data-model changes for businesses, services or marketplace inventory.
