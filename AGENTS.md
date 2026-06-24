<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. Read relevant guides in `node_modules/next/dist/docs/` before writing code. Use App Router conventions, async request APIs, and `src/proxy.ts` instead of legacy middleware.
<!-- END:nextjs-agent-rules -->

# Repository Instructions for Agents

## Product Identity

Display the product name exactly as `perX`.

Do not display legacy names or alternate capitalization in the user interface.

## Product Backbone

Build around this sequence:

Users -> Opportunities -> Chat -> Proposals -> Deals -> Trust -> Escrow -> Reputation

Avoid implementing disconnected pages that do not support this workflow.

## Repository Baseline

This repository started as an image-only workspace with no application code. The original `image_ux_ux` directory must be preserved.

Valid UI/UX reference images now exist in `public/image_ux_ux`. Use them as the approved visual direction for layout, colours, navigation, cards, messaging, escrow, dashboard and profile patterns. Do not insert the screenshots randomly as decorative content.

## Engineering Rules

- Use Next.js App Router, TypeScript strict mode, Tailwind CSS, Prisma, PostgreSQL, and Zod.
- Use Server Components by default.
- Use Client Components only for real interaction.
- Keep features organised by domain.
- Validate all server inputs.
- Enforce authentication, object ownership, and capabilities on the server.
- Never trust IDs, roles, prices, trust scores, or deal states from the client.
- Store money in integer minor units and currency codes.
- Do not use floating-point numbers for escrow or deal values.
- Do not cache private data in the service worker.
- Do not commit secrets.

## Quality Gates

Before reporting a phase as complete, run the relevant checks:

- `npm run lint`
- `npm run type-check`
- `npm run test`
- `npm run build`

If a check cannot run or fails, report it directly.

## Documentation

Keep these files updated as the implementation changes:

- `docs/CURRENT_STATE_AUDIT.md`
- `docs/PREX_MVP_ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/IMAGE_ASSET_MAP.md`
- `docs/DEPLOYMENT.md`
