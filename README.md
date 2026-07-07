# perX

perX is a global trust-based commerce ecosystem built around:

Identity -> Opportunity -> Connection -> Proposal -> Agreement -> Deal -> Transaction -> Delivery -> Review -> Reputation -> New Opportunity

This repository contains a production-oriented MVP scaffold using Next.js App Router, TypeScript, Tailwind CSS, Prisma, PostgreSQL, Zod, database-backed sessions, a PWA foundation, tests, and CI.

## Getting Started

```bash
npm install
npm run db:generate
npm run dev
```

Open `http://localhost:3000`.

## Database

Copy `.env.example` to `.env` and set `DATABASE_URL` to a PostgreSQL database.

```bash
npm run db:dev
npm run db:seed
```

Without `DATABASE_URL`, public pages render demo-safe fallback content, while protected mutations redirect with a database configuration error.

## Demo Preview

Demo Preview is disabled unless `DEMO_MODE_ENABLED=true` is set server-side.

```bash
npm run db:seed-demo
```

The seed command resets and recreates fictional demo users, opportunities, proposals, conversations, deals, escrow records, notifications, reviews and trust signals. The public sign-in page then shows `Enter Demo Preview`, which creates a normal server-side session for the seeded demo account.

## Checks

```bash
npm run lint
npm run type-check
npm run test
npm run build
npm run test:e2e
```

## Docs

- `docs/CURRENT_STATE_AUDIT.md`
- `docs/PERX_MVP_ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/IMAGE_ASSET_MAP.md`
- `docs/DEPLOYMENT.md`

## Image Assets

The original `image_ux_ux` directory is preserved and valid UI/UX reference images are available in `public/image_ux_ux`. They are documented in `docs/IMAGE_ASSET_MAP.md` and used as the visual source of truth for the product interface.
