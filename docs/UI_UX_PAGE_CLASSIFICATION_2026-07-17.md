# PerX UI/UX Page Classification

Date: 2026-07-17

This classification supports the reference-led enhancement pass. It does not remove routes by itself; route behavior should be preserved until redirects and tests are approved.

## Public and Auth

| Route | Classification | Notes |
| --- | --- | --- |
| `/` | ENHANCE | Keep PerX brand and search-led homepage; reduce fake metrics and visual noise. |
| `/discover` | ENHANCE | Primary public discovery surface; align with Contra-style people/work discovery and mobile filters. |
| `/opportunities/[slug]` | ENHANCE | Use Wellfound-style listing hierarchy with owner, compensation, location and response action. |
| `/categories/[slug]` | CONSOLIDATE | Fold into discovery category filtering over time. |
| `/u/[username]` | ENHANCE | Use Malt-style profile hierarchy: identity, trust, skills, experience, reviews, contact. |
| `/about` | KEEP | Static informational page; keep visual consistency only. |
| `/how-it-works` | KEEP | Static trust/workflow explanation; keep beta boundaries clear. |
| `/trust-safety` | KEEP | Important trust content; maintain. |
| `/help` | ENHANCE | Improve support search and categories later. |
| `/privacy` | KEEP | Legal/static content. |
| `/terms` | KEEP | Legal/static content. |
| `/sign-in` | ENHANCE | Keep auth behavior; standardize spacing and form clarity. |
| `/sign-up` | ENHANCE | Preserve role-backed permissions; present choices as onboarding intents. |
| `/password-recovery` | KEEP | Simple recovery request flow. |
| `/offline` | KEEP | Required PWA fallback. |

## Canonical Signed-In App

| Route | Classification | Notes |
| --- | --- | --- |
| `/app` | ENHANCE | Signed-in home should emphasize activity, discovery, messages and agreements. |
| `/app/discover` | ENHANCE | Canonical signed-in discovery route. |
| `/app/opportunities` | ENHANCE | Rename in UI as listings where useful; keep route. |
| `/app/opportunities/new` | ENHANCE | Standardize form hierarchy and beta copy. |
| `/app/messages` | ENHANCE | Keep three-panel workspace; improve mobile height and clarity. |
| `/app/messages/[conversationId]` | ENHANCE | Preserve direct conversation route. |
| `/app/proposals/sent` | KEEP | Working proposal list; visual polish later. |
| `/app/proposals/received` | KEEP | Working proposal list; visual polish later. |
| `/app/deals` | ENHANCE | Present as Agreements in UI while keeping existing deal route and data model. |
| `/app/deals/[dealId]` | ENHANCE | Agreement workspace; reduce escrow/payment wording. |
| `/app/deals/[dealId]/milestones` | KEEP | Functional detail page; polish later. |
| `/app/deals/[dealId]/deliveries` | KEEP | Functional detail page; polish later. |
| `/app/deals/[dealId]/escrow` | COMING LATER | Keep as simulated state only during beta. |
| `/app/profile/setup` | ENHANCE | Required onboarding page; profile completion hierarchy. |
| `/app/profile/edit` | ENHANCE | Profile management form; align with public profile fields. |
| `/app/roles` | RESTRUCTURE | Replace fixed role identity with activity-derived roles after permission migration. |
| `/app/saved` | ENHANCE | Improve saved-item discovery cards later. |
| `/app/notifications` | ENHANCE | Improve filtering and preferences later. |
| `/app/reviews` | KEEP | Trust content; polish later. |
| `/app/settings` | KEEP | Functional settings. |
| `/app/settings/security` | KEEP | Functional security settings. |

## Legacy Workspace Aliases

| Route | Classification | Notes |
| --- | --- | --- |
| `/dashboard` | CONSOLIDATE | Legacy alias for `/app`; keep until redirect coverage is approved. |
| `/market` | CONSOLIDATE | Legacy alias for discovery; prefer `/app/discover` when signed in. |
| `/network` | RESTRUCTURE | Fold into people discovery/connections. |
| `/messages` | CONSOLIDATE | Legacy alias for `/app/messages`. |
| `/messages/[conversationId]` | CONSOLIDATE | Legacy alias for `/app/messages/[conversationId]`. |
| `/deals` | CONSOLIDATE | Legacy alias for `/app/deals`; label as Agreements. |
| `/deals/[dealId]` | CONSOLIDATE | Legacy alias for `/app/deals/[dealId]`. |
| `/escrow` | COMING LATER | Real escrow inactive; keep unavailable/simulated language only. |
| `/wallet` | COMING LATER | Real wallet and settlement inactive during beta. |
| `/services` | COMING LATER | Future service marketplace expansion. |
| `/real-estate` | COMING LATER | Future vertical; do not present as active transaction flow. |
| `/logistics` | COMING LATER | Future vertical; do not present as active fulfillment flow. |
| `/travel-stay` | COMING LATER | Future vertical. |
| `/service-center` | ENHANCE | Support destination; improve later. |
| `/reports` | KEEP | Operational/reporting area. |
| `/settings` | CONSOLIDATE | Legacy alias for `/app/settings`. |
| `/settings/security` | CONSOLIDATE | Legacy alias for `/app/settings/security`. |
| `/saved` | CONSOLIDATE | Legacy alias for `/app/saved`. |
| `/notifications` | CONSOLIDATE | Legacy alias for `/app/notifications`. |
| `/reviews` | CONSOLIDATE | Legacy alias for `/app/reviews`. |
| `/profile/setup` | CONSOLIDATE | Legacy alias for `/app/profile/setup`. |
| `/profile/edit` | CONSOLIDATE | Legacy alias for `/app/profile/edit`. |
| `/proposals/sent` | CONSOLIDATE | Legacy alias for `/app/proposals/sent`. |
| `/proposals/received` | CONSOLIDATE | Legacy alias for `/app/proposals/received`. |
| `/opportunities/new` | CONSOLIDATE | Legacy alias for `/app/opportunities/new`. |
| `/roles` | RESTRUCTURE | Same role-model concern as `/app/roles`. |

## Admin

| Route | Classification | Notes |
| --- | --- | --- |
| `/admin` | KEEP | Admin shell is functional and separate. |
| `/admin/users` | KEEP | Operational list. |
| `/admin/profiles` | ENHANCE | Improve profile review cards later. |
| `/admin/opportunities` | ENHANCE | Improve listing moderation hierarchy later. |
| `/admin/reports` | KEEP | Operational list. |
| `/admin/reviews` | KEEP | Operational list. |
| `/admin/disputes` | KEEP | Operational list. |
| `/admin/verification` | KEEP | Operational list. |
| `/admin/activity` | KEEP | Operational overview. |
| `/admin/audit-logs` | KEEP | Security/audit surface. |
| `/admin/moderation` | KEEP | Moderation overview. |

## Preview

| Route Pattern | Classification | Notes |
| --- | --- | --- |
| `/preview/**` | KEEP | Isolated demo/preview environment; keep separate from production IA. |
| `/preview/market`, `/preview/services`, `/preview/real-estate`, `/preview/logistics`, `/preview/travel-stay` | COMING LATER | Preview-only future verticals; do not imply production readiness. |
| `/preview/deals/**`, `/preview/escrow`, `/preview/wallet` | COMING LATER | Simulated only; no real funds, checkout or settlement. |

## Current Priority Status

| Priority Page | Status In This Pass |
| --- | --- |
| Homepage | ENHANCED |
| Discover | ENHANCED |
| Onboarding | ENHANCED |
| Signed-in home | ENHANCED |
| Person profile | ENHANCED |
| Business profile | COMING LATER, no dedicated model-backed route yet |
| Opportunity details | ENHANCED |
| Messages | ENHANCED |
| Agreements | ENHANCED |
