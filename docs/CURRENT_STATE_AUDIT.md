# perX Current State Audit

Last updated: 2026-06-27

## Repository Shape

- Framework: Next.js App Router with TypeScript, React 19, Tailwind CSS v4 tokens in `src/app/globals.css`.
- Routing: public routes under `src/app`, clean authenticated workspace routes under `src/app/(workspace)`, legacy authenticated routes under `src/app/app`, preview routes under `src/app/(preview)/preview`, admin routes under `src/app/admin`.
- Data: Prisma 7 with PostgreSQL support, plus database-free Test Account and Preview Mode fixtures.
- Authentication: server-side session helpers in `src/lib/auth`, proxy protection in `src/proxy.ts`, local Test Account support in `src/lib/dev/test-auth.ts`.
- PWA: `src/app/manifest.ts`, `public/sw.js`, offline page, generated icons under `public/icons`.
- Brand/UI source: approved UI reference images live in `public/image_ux_ux`; official logo source is `public/image_ux_ux/MAIN_LOGO.jpg`.

## Current UI Correction Pass

- The old gold-dominant dashboard theme has been replaced with the reference-led navy, off-white, blue, purple and charcoal system.
- `MAIN_LOGO.jpg` is copied to `public/brand/source/perx-original-reference.jpg` and used by `scripts/generate-brand-icons.mjs` to create all brand/icon derivatives.
- App and preview shells now use a fixed viewport-height layout: desktop sidebar and header remain fixed while the content region scrolls.
- The app sidebar now uses one typed approved navigation configuration with 15 links: Home Dashboard, Network/Friends, Real Estate, Logistics, Travel & Stay, Services, Market, Wallet, Escrow, Service Center, Messages, Notifications, Saved, Reports and Settings.
- Dashboard, Discover, Messages and Landing routes have been redesigned around the approved reference patterns without inserting UI screenshots as content images.
- Temporary content imagery is centralized in `src/lib/data/temporary-images.ts`.

## Checks Run During This Pass

- `npm run type-check`: passed.
- `npm run lint`: passed.
- `npm run test`: passed, 5 files and 13 tests.
- `npm run test:e2e`: passed, 2 Playwright projects.
- `npm run build`: passed.
- `npx prisma validate`: passed.
- `npm run brand:generate`: passed.
- PWA manifest, icon dimensions, maskable safe-zone and service-worker cache checks: passed.
- Visual screenshots: created and validated under `docs/visual-verification/final-correction/`.
- Repository search for visible stale brand spelling: clean except non-visible script/env identifiers.
- Repository search for stale SVG logo paths and legacy icon paths: clean.
- Repository search for `USD` and `US$`: clean.
- Repository search for dead `href="#"` style links: clean.

## Known Risks

- The approved `MAIN_LOGO.jpg` contains legacy center text over the infinity crossing. The derivative script masks that text, which leaves visible source-artifact limitations around the crossing. The derivatives remain based only on the approved source.
- `npm install --save-dev sharp` reported 5 moderate audit findings. No audit fix was applied because forced remediation may introduce breaking changes.
- Full screenshot and build verification should be rerun after any further UI changes.
