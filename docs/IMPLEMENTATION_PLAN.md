# perX Implementation Plan

Last updated: 2026-06-27

## Completed In This Correction Pass

- Visually inspected and mapped all UI reference images in `public/image_ux_ux`.
- Replaced the black-and-gold dominant theme with reference-led semantic tokens.
- Regenerated brand and PWA icons from `MAIN_LOGO.jpg`.
- Centralized brand rendering in `src/components/brand-logo.tsx`.
- Fixed app/preview shell structure so only the content region scrolls.
- Rebuilt the app sidebar from the `IMG-20260423-WA0067.jpg` reference with one approved 15-link navigation list and clean workspace routes.
- Redesigned the landing page, dashboard, Discover and Messages around the references.
- Added `src/lib/data/temporary-images.ts` so temporary content imagery is controlled.
- Removed stale SVG logo paths and legacy icon references from active code.

## Remaining Priority Work

1. Align future development with the newly established PerX Master Blueprint and phased roadmap.
2. Continue applying reference patterns to lower-priority routes: notifications, profile, saved, settings and admin detail pages.
3. Replace temporary Unsplash imagery with owned perX content assets.
4. Improve the logo crossing if a higher-quality official transparent source becomes available.
5. Review npm audit findings and remediate without forced breaking upgrades.

## Guardrails

- Do not rebuild the app or replace working architecture.
- Do not use UI screenshots as opportunity thumbnails or decorative content.
- Keep Preview Mode and Test Account database-free.
- Keep route shells isolated: clean authenticated workspace links stay on top-level app routes, and preview links stay under `/preview`.
- Use the Feature Under Development dialog instead of silent or dead controls.
