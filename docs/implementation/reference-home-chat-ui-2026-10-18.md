# Home and Messages screenshot alignment — frontend follow-up

This branch extends PR #17. The provided screenshots are visual references,
not claims that PtahX already supports encrypted messaging, payments,
shipment tracking, product variants, video or real sales statistics.

## Home
- Dark navy, compact mobile discovery header with actual search and category
  destinations. Mobile first; desktop continues to use the existing reading
  column and discovery rail.
- Product cards put their existing cover media above the title/price/summary,
  preserving the original source-backed budget and seller trust. A product
  enquiry routes to the existing response form; no pretend checkout.
- Non-product opportunities retain their text-first editorial layout.
- Only the first opportunity cover image is eagerly requested; the others are
  lazy. The same 640px responsive sizes remain in force.
- Image dimensions/ratios reserve layout space so feed items do not jump as
  photos load. Single cover per feed item avoids unreviewed DB reads.

## Messages
- Conversation list: navy header, 44px search and filter targets, clearer
  conversation cards, unread count, context and actual Deal-record badge.
- Deals filter includes both conversations with existing records and those
  eligible to create a proposal. "Find people" leads to actual connection
  discovery; it does **not** imply arbitrary cold-message permission.
- Conversation detail: warm chat canvas, white incoming and pale green outgoing
  bubbles, better mobile spacing and send-button contrast.
- Existing Make a Deal and View Deal shortcuts are placed above the composer,
  preserving actual actions without presenting unavailable attachments,
  tracking, calling or end-to-end encryption.
- Avatar fallback colors are deterministic; loaded avatar images use async
  decoding and lazy loading. React.memo avoids unnecessary avatar renders.
- Keep existing SSE/reconnect/read acknowledgements, history restoration,
  multi-conversation drafts, permission checks, and keyboard/safe-area CSS.

## Safety / validation
No changes to DB schema, RLS, Supabase, Auth or money flows. No additional
third-party packages. Backend claims remain evidence-driven.

Before shipping: `npm ci`, lint, type-check, unit and database integration
tests, Next production build, responsive visual tests at 320/360/390/430px,
conversation keyboard and SSE tests, real-device spot checks, and Vercel
Preview review. CI only measures build/regressions, *not* real Core Web Vitals;
measure LCP/INP/CLS in deployed browsers separately.
