# perX MVP Architecture

This file documents the official product architecture.

## Product Backbone

perX is a global trust-based commerce ecosystem structured around:

Identity -> Opportunity -> Connection -> Proposal -> Agreement -> Deal -> Transaction -> Delivery -> Review -> Reputation -> New Opportunity

Each major route should reinforce this workflow rather than becoming a disconnected page.

## Application Layers

- Public website: landing, discover, opportunity detail, profile and informational pages.
- Authenticated app: clean workspace routes for dashboard, network, real estate, logistics, travel and stay, services, market, wallet, escrow, service center, messages, notifications, saved, reports and settings.
- Preview Mode: database-free route set under `/preview` for visual and product review.
- Test Account: database-free local authenticated experience preserving app shell behavior without requiring a database.
- Admin: protected operational pages under `/admin`.

## Data and Security

- Prisma remains the production ORM with PostgreSQL as the target database.
- Test Account and Preview Mode use local fixtures and must not require a database.
- Server operations must validate authentication, object ownership and capabilities.
- Money values are represented in integer minor units with currency codes. User-facing platform amounts use NGN formatting.
- Escrow remains provider-independent and simulated until a regulated provider is connected.

## UI System

- Official brand source: `public/image_ux_ux/MAIN_LOGO.jpg`.
- UI reference source: all screenshots in `public/image_ux_ux`, mapped in `docs/UI_REFERENCE_PAGE_MAP.md`.
- Semantic tokens live in `src/app/globals.css`.
- Reusable shell and brand rendering live in `src/components/layout` and `src/components/brand-logo.tsx`.
- Public, app, preview and admin routes must share the same perX visual language while preserving route-appropriate layouts.
- Sidebar navigation is centralized in `src/lib/navigation/sidebar-items.ts` and must remain limited to the approved workspace links.

## PWA

- Manifest: `src/app/manifest.ts`.
- Service worker: `public/sw.js`.
- Offline route: `src/app/offline/page.tsx`.
- Cache policy excludes private app, admin, messages, deals and mutation routes.
