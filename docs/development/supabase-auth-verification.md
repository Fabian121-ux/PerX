# AUTH-SUPABASE-1 verification record

Recorded 2026-09-26. Starting main:
`2ae0970cffa113182954873f234327f8f2f7a15b`. Continued
`auth-supabase-1-user-link` / Draft PR #15 from
`fb8f9ac707119b4a30eab752f3ba8b89aa3cb639` in a separate worktree, preserving
uncommitted SOCIAL-CORE-1 work in the original checkout.

## Real red evidence

Before the Supabase session guard, `supabase-session.test.ts` reported:

```text
Test Files  1 failed (1)
Tests       6 failed | 4 passed (10)
```

Five failures exposed missing provider/UUID validation; one exposed a malformed
suspension fixture, which was corrected to establish both `suspendedAt` and
`suspendedUntil`. That fixture error is not counted as a production defect.

The callback origin regression was added before its correction:

```text
FAIL uses the trusted app origin even when Next supplies an internal request host
Expected: https://app.example.test/app/profile/setup
Received: http://localhost:3100/app/profile/setup
Tests  1 failed | 9 passed (10)
```

Four provider-origin tests failed before structured TLS/origin validation was
added (`4 failed | 10 passed`): remote HTTP, non-HTTP protocol, embedded URL
credentials and a query-bearing provider URL. The corrected configuration and
confirmation suites passed all 24 cases together.

## Mutation testing

Each mutation was made independently after green tests, captured as an actual
nonzero test run, and restored from an explicit byte-for-byte file backup.
No mutation is retained.

| Mutation                                        | Test that failed                                                                | Actual result        |
| ----------------------------------------------- | ------------------------------------------------------------------------------- | -------------------- |
| Bypass provider UUID equality                   | Same email with a different provider UUID cannot reuse the application session  | 1 failed / 9 passed  |
| Remove verified-email requirement               | Unverified provider identity with a valid local session is rejected             | 1 failed / 9 passed  |
| Remove application enforcement deny             | Banned, deactivated and suspended users stay blocked                            | 3 failed / 7 passed  |
| Assign email instead of provider UUID at signup | Signup assigns only the provider identity and server-owned application defaults | 1 failed / 14 passed |
| Use raw callback return path                    | External HTTPS, protocol-relative and backslash-hostile paths are rejected      | 3 failed / 6 passed  |

The PostgreSQL unique index was also removed inside an isolated rollback-only
transaction. The duplicate-UUID test failed (1 failed; 9 unrelated cases filtered
out). Transaction rollback restored the index, the explicit test-file backup was
restored, and all 10 bridge integration cases passed again in 3.77s.

## Database and unit gates

All database writes used the guard-approved `perx_test_auth` database on
loopback. The separate local Supabase Auth stack was disposable. Production
credentials were never substituted into test configuration.

| Command                                                 | Exit | Actual summary                                                               |
| ------------------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| `npm ci`                                                | 0    | Prisma client generated; existing lockfile dependencies installed            |
| `npm run db:local -- validate`                          | 0    | Prisma schema valid                                                          |
| `npm run lint`                                          | 0    | No lint errors                                                               |
| `npm run type-check`                                    | 0    | No TypeScript errors                                                         |
| `npm run test:authorization`                            | 0    | 2 files, 36 passed, 0 failed/skipped; 10.63s                                 |
| Authorization shuffled, seed 42173                      | 0    | 2 files, 36 passed, 0 failed/skipped; 8.36s                                  |
| `npm run test`, DB enabled                              | 0    | 151 files, 993 passed, 0 failed/skipped; 130.36s                             |
| `npm run test`, TEST_DATABASE_URL/TEST_DIRECT_URL empty | 0    | 149 files passed, 2 skipped; 957 tests passed, 36 skipped, 0 failed; 128.95s |

The two optional SQL suites skip only when dedicated test configuration is
absent. `test:authorization` always requires it. No database safety guard or
production capability grant changed. CI's disposable PostgreSQL job includes
the new identity-link suite through the existing authorization command.

`npm run build` exited 0: compilation 42s, TypeScript 44s, and 42 static
pages generated. All 62 browser JavaScript files were scanned; none contained
the synthetic service-role build probe. An exact-value scan of all changed and
untracked files found no matches for configured production or local credentials.
Both local env files remained ignored.

## Real-provider browser acceptance

```text
4 passed (4.2m)
```

Both scenarios passed on desktop and mobile, with the changed signup/recovery/
reset surfaces checked at 320px for horizontal overflow:

1. Actual form signup created an unconfirmed provider identity and a distinct
   application cuid with its UUID bridge. Unverified sign-in failed. Following
   the actual local mailbox confirmation link granted application access.
   Actual sign-out removed the application Session; replayed old cookies failed.
   Recovery used the actual mailbox link and provider password update. The old
   password failed and the replacement signed in. Invalid confirmation with a
   hostile return destination stayed on the application's sign-in route.
2. The operator tool's dry run left an existing application record unlinked.
   Applying it preserved the ID, INTERNAL_ADMIN classification, ADMIN role,
   profile and trust score. Provider recovery established a fresh password
   without copying the legacy hash, and that account signed in successfully.

Earlier failures were investigated rather than skipped: local Docker template
mounts were directories rather than files; local GoTrue request deadlines caused
504s under resource pressure; an acceptance fixture lacked its required
UserRole ID; a five-second assertion deadline triggered fixture cleanup while a
reset action was still running. Corrected local templates, a 60-second timeout
only in the disposable GoTrue instance, explicit fixture IDs and bounded waits
resolved those harness failures. Browser acceptance also found the real
callback-host bug documented above. HTTP status alone was never the proof.

## Release state and findings

Read-only production inspection at 2026-09-26T10:00:16Z found 0 Auth users,
6 application users, no UUID bridge column, and the existing INTERNAL_ADMIN
record active and neither banned nor deactivated. These are dated observations,
not a seed/reset instruction. No production user was modified.

Vercel access was reconnected through its official device flow. Environment
metadata showed that database and Supabase Auth configuration existed only in
production; the earlier green schema-only preview did not exercise real auth.
A dedicated non-production preview project/configuration is required before
claiming preview acceptance. Provider templates, SMTP and redirects also require
verification before production cutover; see supabase-auth.md.

The repository's documented production migration process is additive migration
first, merge second, with a command-scoped remote-target opt-in. No production
migration has been applied in this verification record.

`npm audit` also reported inherited dependency advisories, including the Next.js
16.2.9 AVIF optimizer advisory GHSA-2xp9-vwfh-vxw4; AVIF is enabled in the existing
Next configuration. This auth PR does not silently upgrade the requested Next
version. A security patch/follow-up is required before treating rollout as ready.

Source: https://github.com/advisories/GHSA-2xp9-vwfh-vxw4
