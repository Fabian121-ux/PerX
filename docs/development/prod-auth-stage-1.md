# PROD-AUTH-STAGE-1 evidence

## Scope and stop point

Dormant rollout only. Keep PR #15 Draft and its branch deployment suppression.
Starting main: `dfee3373bcbdd79adc1019c91756c7760d5f3a17`.
Starting branch: `6317ec07f75f0de5f0624c2994266599432f1275`.
Fresh fetch found main one commit ahead and the auth branch five ahead.
Reconciliation preserves both schemas, regenerates Prisma/manifest and includes
all four integration suites.

## Production preflight — 28 September 2026, 08:22 UTC

Read-only inspection of the verified PtahX production target found:

- 7 application users; 0 Supabase Auth users.
- Designated existing admin present, active, not banned/deactivated, INTERNAL_ADMIN.
- `User.id` text primary key unchanged. `authUserId` and its unique index absent.
- 19 completed migrations; Prisma status on the original auth branch exited 1
  reporting the pending auth-link migration.
- **Blocker:** main includes `20260924150000_social_core`, but production has no
  social migration or Post/PostReaction/PostComment tables. Reconciled
  `migrate deploy` would exceed the one authorized auth migration. Not run.
- Existing Vercel Production deployment `dpl_GSACUjVSihM82iV835a7rqKvuvrj` is
  READY at main `dfee337…`. This is an existing deployment, not this auth rollout.
- `/api/health`: 503, database connected/schema drifted. Public `/`, `/sign-in`,
  `/sign-up`, `/password-recovery`: 200. `/app`: 307 to sign-in.
- Production has no explicit `PERX_AUTH_PROVIDER` entry. `NEXT_PUBLIC_APP_URL`
  is sensitive and unreadable through the inspected API; canonical equality
  has not been established.

No production migration or environment write was performed. There is no
post-migration snapshot or auth deployment to verify. Secure existing test-account
credentials are needed for real legacy sign-in acceptance. The social prerequisite
needs separate rollout authorization before the requested deploy can proceed.
Recheck this dated preflight before any later production mutation.

## Source and copy

Shorter auth descriptions; errors with next steps and no database/provider jargon;
confirmation failure links directly to recovery; partial signup asks the user to
contact support before retrying. Recovery stays conditional on an account match.
Unavailable email delivery no longer falsely claims a request was recorded/sent.
Sign-in footer links wrap on narrow screens. Production authorization is unchanged.

The initial semantic copy run failed all 7 tests (1.44s) before repair. The initial
repaired targeted selection passed 141 tests in 16 files (14.72s).

Reconciliation exposed main test defects: missing jest-dom matcher setup and
unsupported `exact` query options in the landing-page test; a suspension fixture
set only `suspendedUntil` while PtahX requires `suspendedAt` too. An isolated DB
rerun reproduced 1 failed / 67 passed. Adding the missing timestamp, preserving
the deny assertions and production policy, produced 68 passed (4 files, 16.83s).
An earlier overlapping run also timed out under competing validation load; tests
are rerun with bounded workers without weakening timeouts or assertions.

## Browser baseline before rollout

Pinned agent-browser 0.38.1 actually rendered current production sign-in on
desktop and sign-in/sign-up/recovery at 320px. The three mobile pages measured
scrollWidth=clientWidth=320. Screenshots of desktop sign-in and mobile signup
were visually inspected. This verifies the old deployed surfaces only, not the
branch copy or successful sign-in/logout/recovery. No production forms submitted.

## Interrupted workspace recovery

During the pause, the temporary worktree and its local logs disappeared. The
unfinished full-suite run has no retrievable result and is not counted as passed.
The same source changes were restored into a persistent ignored worktree in the
repository; fresh validation follows. Production was not changed during recovery.

## Security audit blocker

Fresh `npm audit --omit=dev` reports 14 dependency findings: 5 moderate, 8 high,
1 critical. Not every transitive advisory has been assessed as reachable in
PtahX, but the inherited Next.js AVIF issue is an unresolved release prerequisite:
Next 16.2.9 is in the affected range and `next.config.ts` enables `image/avif`.
The maintainer advisory identifies patched Next 16.3.3 for this issue; npm's
current suggested Next update is 16.3.6. No framework/package upgrade is silently
included in this auth-copy stage. A separate reviewed patch/revalidation is needed.

Source: https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4

Restored-worktree default-provider mutation: switching absent config to Supabase
caused 4 failures / 29 passes (1.59s); the explicit source backup was restored
byte-for-byte. No mutation is committed. The semantic copy red run was repeated
before restoring the copy edits: 7 failed (1.00s).

Read-only production recheck at **2026-09-28 12:46 UTC** confirms the same 7
application users, 0 Auth users, active INTERNAL_ADMIN record, 19 completed
migrations, absent auth-link column/index and absent social tables. These are
two preflight snapshots, not before/after evidence of a migration.

## Restored-worktree validation (final source)

| Check | Exit | Result |
| --- | --- | --- |
| `npm ci` | 0 | Locked dependencies installed; Prisma generated |
| Prisma validate / test DB status | 0 | Valid schema, 21 applied test migrations, strict isolation guard passed |
| `npm run lint` | 0 | 50.08s |
| `npm run type-check` | 0 | 47.25s |
| Targeted auth (two workers) | 0 | 16 files, 147 passed, 0 failed/skipped; Vitest 11.89s |
| `npm run test:authorization` | 0 | 4 files, 68 passed, 0 failed/skipped; 13.42s |
| `npm run test -- --maxWorkers=2`, isolated DB | 0 | 155 files, 1048 passed, 0 failed/skipped; 141.22s |
| Same full command, dedicated TEST URLs explicitly empty | 0 | 151 files passed, 4 skipped; 980 tests passed, 68 skipped, 0 failed; 124.61s |

No-DB skips are the existing intentional optional-integration contract, not a
fallback from a broken configured database. The authorization command requires
the dedicated DB; all 68 DB cases execute when it is supplied. Test DB remains
`perx_test_auth` on loopback, never the application's DATABASE_URL.

The exact-value credential scan covered all 56 modified/untracked source files
and found no configured credential matches; `.env.test.local` remains ignored.
No package version, existing auth migration SQL or deployment suppression rule
changed after the starting branch commit. The inherited social migration comes
from main, not a newly authored schema change in this stage.

`npm run build` exited 0 in 114.23s: compilation 44s and TypeScript 59s, followed
by successful page generation. The nested persistent worktree produces a local
multiple-lockfile/root-inference warning; deployment configuration was not changed
to suppress that environment-specific warning. The final browser-test addition
also passed its targeted ESLint check.


## Browser completion — 1 October 2026

The first local Chromium run reported 46 passed / 1 failed (2.4m): the signup
password-visibility assertion received `password` after clicking Show password.
An unchanged isolated rerun passed both form tests (1.6m); a direct agent-browser
click also changed the field to `text`. No root cause was established and no
assertion, timeout or component was changed to conceal the failure.

The complete rerun exited 0: **47 passed (2.5m), retries disabled**. This includes
five auth states at 320, 360, 375, 390, 412, 430, 768 and 1280px, recovery progress,
dark mode, safe sign-in return paths, and an actual request to the dormant
confirmation route with invalid state and a hostile external return path.
The request stayed on the local sign-in error page with a working recovery link.
This is local legacy-mode acceptance, not remote Supabase email-flow acceptance.

Pinned agent-browser rendered the changed confirmation/sign-in surface at
1280×900 and 320×780. Both screenshots were visually inspected: readable text,
visible controls and no horizontal overflow. Evidence remains in ignored local
storage, not in the PR. No production login or recovery was submitted.

Fresh fetch on 1 October found main and remote PR head unchanged from the starting
SHAs. Production snapshots above remain explicitly dated; no new production
schema/env/Auth operation is claimed. The source update retains Draft status and
the exact branch-specific deployment suppression until all rollout prerequisites
are satisfied. No source changes followed the successful full quality gates;
only verification evidence was added to this document.
