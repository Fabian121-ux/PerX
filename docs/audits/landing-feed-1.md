# LANDING-FEED-1 verification

Starting main: `61150bfed82474e749d1c861e109eb7735a362d7` (PR #13 merged).
Branch: `ux/public-feed-landing`.

## Result and boundaries

Anonymous `/` is a compact account header, a single 640px public feed and six
support/legal footer links. Root no longer renders the hero, tagline, search,
category wall, activity paths, pillars, workflow explanation, featured people,
partnership/marketplace previews or closing CTA. Their standalone routes and
reusable components remain. Authenticated root still redirects to `/app` before
fetching public content.

`getPublicFeedResult()` calls the existing `getPublicOpportunityPage` with a
fixed page size of 12. Its `buildPublicOpportunityWhere` remains unchanged:
published, approved, non-null publication date, eligible discoverable author,
and existing investment/property restrictions. Ordering remains publication
date descending, then ID descending. The existing query reads one extra row as
a page probe; at most 12 cards are rendered. This release deliberately has no
public infinite-scroll endpoint or public cursor; further browsing links to
`/discover`.

The shared card projection now separates public fields from authenticated
`viewerHasSaved`. Public queries read no bookmarks or network relationships.
The card's explicit public mode renders a safe `/sign-in?next=...` link instead
of `FeedSaveButton`; the canonical content path passes through the existing
safe auth redirect helper. Existing authenticated actions and API guards are
unchanged. Empty results and query failures have separate compact messages;
errors use redacted operational logging and preserve Next navigation exceptions.

`SponsoredSlot` already renders a compact, labelled, dismissible card. It is
retained after the third public post, at most once, with no monetization changes.

Reactions/comments are intentionally NOT implemented in LANDING-FEED-1.
They require a separate persistence + authorization work item, SOCIAL-ENGAGEMENT-1.

## Tests first

Before changing production code:

```text
npx vitest run tests/unit/public-landing.test.tsx
exit 1
Test Files  1 failed (1)
Tests       4 failed | 2 passed (6)
Duration    6.77s
```

The feed-first test failed because the actual root tree still contained the
old marketing headings. Guest save navigation and both compact result-state
tests also failed. Redirect and password-recovery tests already passed.

## Mutation evidence

Each mutation was applied independently, executed, and restored byte-for-byte
from an explicit file backup. Every mutation run exited 1.

| Mutation | Test that failed | Observed failure |
| --- | --- | --- |
| M1: remove publication/moderation predicates | anonymous landing feed uses public visibility without private viewer state | forbidden fixture ID appeared |
| M1 extra: remove moderation alone | same test | rejected fixture appeared |
| M1 extra: remove publication status alone | same test | non-public fixture appeared |
| M2: bypass save session guard using the listing owner's identity | anonymous feed save action refuses before any bookmark write | promise resolved `{ success: true }` instead of rejecting |
| M3: restore Main activity paths heading | makes anonymous root a single public feed without the marketing stack | forbidden heading appeared |
| M4: change recovery destination to /help | keeps password recovery reachable from sign-in | expected /password-recovery, received /help |

Focused mutation runs used `-t`; nonselected tests were reported as skipped by
the runner. No test declaration or normal skip contract was changed.

## Browser and database acceptance

```text
npx playwright test tests/e2e/public-landing.spec.ts --workers=1 --retries=0
exit 0
2 passed (2.7m)
desktop chromium: 56.7s
mobile chromium, 320px viewport: 29.6s
```

Both exercised real Postgres data, feed ordering/scrolling, exclusion of
controlled draft/paused/rejected fixtures, public detail/profile pages, guest
save navigation, sign-in, sign-up, password recovery, real sign-in returning to
the selected post, authenticated root redirect, authenticated feed rendering,
and actual fixture content in the authenticated API response. Anonymous API
requests returned 401. Both asserted no horizontal overflow and a maximum
640px reading column. Desktop/mobile screenshots were visually inspected.

This was not inferred from successful HTTP status codes: the sign-in form
invoked `signInAction`, exactly one session row existed for the fixture, the
browser returned to the chosen post, and the API returned the expected post ID.

Test DB name: `perx_test`. The existing isolation guard ran before connections
and cleanup. Browser fixtures use unique IDs and exact owned-user cleanup;
integration fixtures use PR #13's rollback transactions. A final guarded query
found zero remaining landing users and zero remaining landing posts.

## Findings during verification

- Playwright's CommonJS loader cannot directly load this generated Prisma
  client's `import.meta`. Browser fixtures use the repository's guarded `pg`
  pattern; Vitest continues using the shared Prisma transaction fixtures.
- A guessed cookie name made an early browser fixture unauthenticated because
  local application configuration overrides the default. The final test uses
  real sign-in and the server-issued cookie, without changing auth configuration.
- Own posts belong to the authenticated network segment. An early browser
  assertion incorrectly looked for them in discovery; the final check uses the
  default authenticated endpoint. No ranking or visibility rule changed.
- A malformed generated `.next/dev/types/routes.d.ts` blocked one type-check
  after dev-server verification. `next typegen` regenerated it with the server
  stopped; no generated-file workaround is committed.
- Existing pg overlapping-query deprecation and Next image-loading warnings
  remain outside this landing composition change.

## Final gates

```text
npm run lint: exit 0 (64.17s wall time)
npm run type-check: exit 0 (57.04s wall time)
npm run test: exit 0
  Test Files 144 passed (144)
  Tests 926 passed (926), 0 failed, 0 skipped
  Duration 137.21s
npm run build: exit 0 (126.24s wall time)
  Next.js 16.2.9; compiled successfully in 48s
npm run test:authorization: exit 0
  26 passed, 0 failed, 0 skipped
TEST_DATABASE_URL= TEST_DIRECT_URL= npm run test: exit 0
  Test Files 143 passed | 1 skipped (144)
  Tests 900 passed | 26 skipped (926), 0 failed
  Duration 102.16s
```

The no-DB skips are PR #13's documented missing-test-database contract for the
entire authorization file, including the two added cases. The DB-enabled run
executes all 26; no configured-database failure is converted into a skip.

PR #13's disposable PostgreSQL CI job already runs the authorization file twice
and the full DB suite. The two new database cases are in that file, so they run
in the existing job without workflow changes. Browser acceptance remains an
explicit local Playwright command.

No private content became public; no authorization or password-recovery rule
was weakened. No fake engagement features, migration, credential, production/dev
DB mutation, direct main push, merge or deployment is part of this work.
