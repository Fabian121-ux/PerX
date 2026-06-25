# perX Implementation Plan

Last updated: 2026-06-25

## Completed In This Correction Pass

- Visually inspected and mapped all UI reference images in `public/image_ux_ux`.
- Replaced the black-and-gold dominant theme with reference-led semantic tokens.
- Regenerated brand and PWA icons from `MAIN_LOGO.jpg`.
- Centralized brand rendering in `src/components/brand-logo.tsx`.
- Fixed app/preview shell structure so only the content region scrolls.
- Redesigned the landing page, dashboard, Discover and Messages around the references.
- Added `src/lib/data/temporary-images.ts` so temporary content imagery is controlled.
- Removed stale SVG logo paths and legacy icon references from active code.

## Remaining Priority Work

1. Continue applying reference patterns to lower-priority routes: notifications, profile, saved, settings and admin detail pages.
2. Replace temporary Unsplash imagery with owned perX content assets.
3. Improve the logo crossing if a higher-quality official transparent source becomes available.
4. Review npm audit findings and remediate without forced breaking upgrades.

## Guardrails

- Do not rebuild the app or replace working architecture.
- Do not use UI screenshots as opportunity thumbnails or decorative content.
- Keep Preview Mode and Test Account database-free.
- Keep route shells isolated: `/app` links stay in app, `/preview` links stay in preview.
- Use the Feature Under Development dialog instead of silent or dead controls.
