# Performance Follow-Ups

Status: recorded 2026-08-23, after Batch 3.

Deferred work identified during the Batch 3 performance pass. Neither item
blocks Batch 4 (Messaging). Both are recorded here so the evidence is not lost.

## 1. Seeded performance fixture

The isolated test database holds 5 users and 2 published posts. At that size,
route timings are dominated by run-to-run variance rather than by application
behaviour: the same commit measured Home at 95.8 ms on an idle machine and
201.9 ms while other suites were running.

Consequence: the performance budgets described in Batch 3 can be *documented*
but not *enforced*. A regression would be indistinguishable from noise.

What would fix it: a seeded fixture with realistic volume (the Batch 2 feed
benchmark used 50,000 posts across 5,000 authors and produced stable, repeatable
numbers - see `scripts/feed-query-benchmark.mjs`), plus a fixed CPU budget for
the measurement run.

Explicitly not started: no large performance-data framework was built. The
existing durable guards are structural rather than time-based, and remain
valid on slow hardware:

- `tests/unit/route-query-budget.test.ts` - database operation counts per route
- `tests/unit/request-dedup.test.ts` - per-request memoisation
- `tests/unit/media-performance.test.tsx` - image sizing, lazy loading, layout

## 2. Server-side image resizing

`sharp` is a declared dependency but is not used anywhere in `src/`. Uploads are
written to Supabase Storage as full-resolution originals, bounded only by
`UPLOAD_MAX_BYTES` (default 5 MB) - see `src/lib/uploads/profile-image.ts` and
`src/lib/uploads/listing-image.ts`.

Batch 3 fixed *delivery*, not *storage*. `next.config.ts` now lists the Supabase
storage hosts in `images.remotePatterns`, so `next/image` will resize and
re-encode to AVIF/WebP on request. Before that change the optimizer refused
those URLs entirely and served the untouched original - a 40 px topbar avatar
could download a 5 MB file.

What remains:

- originals are still stored at full resolution, so storage cost and the
  first-request optimization cost both scale with upload size
- no dimension cap or re-encode at upload time
- no cleanup of superseded originals

Suggested approach for a later media/storage hardening pass: resize and
re-encode on upload with the already-installed `sharp`, retaining a bounded
original only where a larger source is genuinely needed.

Explicitly not started: no new media pipeline was introduced during Batch 3
cleanup.
