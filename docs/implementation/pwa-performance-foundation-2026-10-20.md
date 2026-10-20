# PtahX fast-feeling PWA foundation — October 20, 2026

## What we changed
This is the next performance/UX phase, not a million-user capacity claim.

The existing application already has streamed Home feed cards, skeletons,
responsive Next/Image sizes, a 5-minute per-user/tab feed snapshot that is
cleared at logout, and request-scoped DB count deduplication. These were
preserved.

### Offline and installation
- PWA service worker v10 separates the offline shell, hashed build files,
  and **public** image assets into bounded cache buckets.
- Network is authoritative for **all HTML**, including authenticated pages.
  When offline, document navigation shows only the public offline page; it
  never displays a saved copy of somebody's private chats or deals.
- API, SSE, Next RSC, dynamic optimized images, admin content, auth data and
  user uploads are NOT persisted by the service worker.
- Static JS/CSS never receives an HTML fallback. All shared immutable assets
  are checked for HTTP errors, private/no-store flags and HTML/JSON types
  before being cached.
- Stale PtahX cache versions are removed on activation; unrelated caches are
  left alone. Runtime asset storage has a bounded count.
- SW registration waits for page load + 1.2s to avoid competing with first
  paint. On a new app version it offers an **Update** control rather than
  reloading a half-completed form.
- A native **Install** prompt is shown only when the browser actually supports
  `beforeinstallprompt`. Never a decorative no-op install button.
- The offline indicator uses the browser network state; it does not pretend
  the server is reachable merely because mobile data is enabled.

### Network and navigation
- Unread-count fallback polling: 15s → 60s; hidden/offline tabs do not poll.
  Data-saver skips background timer polling. Immediate message events, user
  focus and BroadcastChannel still refresh when appropriate.
- Presence heartbeat skips requests when the device is offline.
- Unread-count API explicitly sets `private, no-store`.
- High-cardinality social and opportunity feed links disable automatic
  Next Link prefetch. Otherwise hundreds of offscreen seller/record links can
  cause unnecessary traffic and dynamic-route work on scroll.
- A lightweight top progress indicator appears only when an internal route
  change takes longer than 140ms, with an 8s safety timeout. Immediate
  pointer feedback from PR #24 remains.

### Measuring speed without paying for more backend infrastructure
- Built-in browser Web Vitals capture records LCP, INP, CLS, FCP, TTFB.
- Each tab holds up to 10 **metric-only** values in sessionStorage.
  No usernames, URLs, devices, location, cookies or personal data collected.
- Add `?perf=1` to a page URL on your phone to open the local diagnostic
  overlay; interact and navigate to see fresh metrics.
- The app sends **zero** metrics requests to Supabase or an analytics server.
  This is an inspection tool, not aggregate RUM telemetry.

## Performance quality targets (not measured outcomes)
- Largest Contentful Paint (LCP) <= 2.5s at p75 on representative mobile.
- Interaction to Next Paint (INP) <= 200ms p75.
- Cumulative Layout Shift (CLS) <= 0.1.
- Reliable click response before any network request.
- Keep the PWA installable and offline-safe.

## Release tests
- Unit/VM tests for service-worker interception, offline fallback,
  private/no-store isolation, no HTML cached as JS, cache quotas.
- CI lint, typecheck, unit + integration, production build.
- Real Playwright on Android-sized screens / offline simulation (manual
  acceptance); Android Chrome PWA install, update, reconnect, message safety.
- Lighthouse mobile baseline and Web Vitals (LCP/INP/CLS) before claiming any
  numerical performance improvement.

## Million-user scale is a later infrastructure task
Front-end asset caching does not make a single free-tier Supabase/Postgres
instance support a million concurrent visitors. The following need real
traffic modelling and staged investment: bounded DB connection pools,
explain-analyze query plans and indices, cursor pagination, CDN/image
transforms, rate limiting and abuse protection, message/event fan-out,
asynchronous work queues, SLO/error budgets, load tests, capacity forecasts,
multi-zone resilience, and production real-user performance monitoring.

Do NOT cache private HTML/RSC/API responses at the edge, even for speed.
No schema or Supabase changes were made in this phase. Logistics V1 remains
separate in draft PR #22.
