# AUTHZ-FIXTURES-1 verification

Starting main: `6b59d5943f1cc7afa9917e41c2195cf7c6408c5a`.
PR #12 was confirmed merged via GitHub and fetched main; the roles action imports
`selfAssignableRoles` from the shared capabilities module. Branch:
`fix/authz-fixtures-green`. Working tree was clean before edits.

## Investigation and baseline

Inspected the authorization suite and every direct import, DB guard and unit
coverage, env loader, Prisma access, session and registration paths, capability
map, opportunity actions, messaging access, public visibility, network queries,
fixture/seed and cleanup scripts, Prisma schema/triggers, scripts, Vitest config,
and the sole CI workflow. Git history across fetched branches and PR search for
authz/authorization fixtures and this filename found prior reports in PRs #7,
#10, #11 and #12, but no separate unfinished fixture repair to reuse. No old
patch was cherry-picked.

The configured database name is `perx_test`. The unchanged test isolation guard
accepted it. A read-only query found **0 current seed identities, 3 legacy seed
identities**, the expected listing present, and all **19 migrations** applied.
The rebrand changed hard-coded lookups from `@perx.test` to `@ptahx.test`; the
suite neither creates those accounts nor invokes the test seed. Renaming local
seed accounts would only mask that dependency.

Initial full DB-enabled baseline (concurrent gates caused resource contention):

```text
npm run lint: exit 0
npm run type-check: exit 0
npm run test: exit 1
Test Files  3 failed | 139 passed (142)
Tests       14 failed | 887 passed (901), 0 skipped
Duration    419.48s
```

That run had the ten fixture failures below, one signup timeout, and three UI
timeouts. A separate isolated unchanged authorization run after the competing
test processes finished established the repeatable baseline:

```text
npm run test -- tests/integration/authorization.test.ts --reporter=verbose
exit 1
Test Files  1 failed (1)
Tests       10 failed | 8 passed (18), 0 skipped
Duration    6.37s
```

The first sandboxed run could not connect to loopback (`EPERM`); it was retained
as an environmental diagnostic, not a fixture result. The first sandboxed build
also failed because Turbopack could not bind a port. The unrestricted unchanged
`npm run build` completed with exit 0, compiling Next.js 16.2.9 in 105s.

## Each original authorization failure

All ten failed before their intended behavior was reached. There were no current
Alice/Bob/Carol rows, hence no roles or capabilities could be resolved for those
identities. Legacy seed roles were intended to be Alice CLIENT/FREELANCER, Bob
CLIENT/FOUNDER, Carol MEMBER, but the tests never checked them. No session was
created by any of these old cases. This was missing fixture setup, not an
observed production authorization denial or grant.

| Original test | Expected behavior | Actual baseline | Required fixture state / relevant authorization |
|---|---|---|---|
| User C cannot access User A/B conversation via direct query | Carol has no participant row | `Seed users missing` | A/B conversation, C excluded; current test calls participant-filtered production providers and proves A/B access too |
| user cannot edit another user's listing (ownership check) | Alice cannot fetch Bob's listing as owner | `Seed users missing` | Bob owns listing; Alice also needs `opportunity:update:own` to reach ownership guard; now both CLIENT with real Alice session |
| verifies seeded APPROVED deal between Alice and Bob qualifies as partner | APPROVED deal found and eligible | `Seed users missing` | Connected client/provider and accepted proposal/version/deal; now production network query proves partner status |
| verifies seeded IN_PROGRESS deal does NOT qualify as partner | IN_PROGRESS deal found and ineligible | `Seed users missing` | Connected client/provider with IN_PROGRESS deal; now positive connection row and false partner flag |
| published content from Alice is discoverable by others excluding draft/paused/rejected | At least one approved published listing | `Seed user missing` | Active public owner with discoverable profile and explicit published/hidden controls; now production feed and slug queries |
| keeps private proposal drafts out of the opportunity owner's received list | Draft absent | User lookup `P2025` | Sender FREELANCER, owner CLIENT, owned listing, DRAFT and SENT proposals; status/ownership query, no session needed at provider seam |
| enforces submitted proposal terms as immutable in PostgreSQL | Trigger rejects changed terms | User lookup `P2025` | Existing proposal plus submitted version; now also proves DRAFT update works and rejected write leaves terms unchanged; database constraint, not role-based |
| rejects a Deal linked to a version from another proposal | Composite FK rejects mismatch | User lookup `P2025` | Two accepted proposals and versions; now requires `P2003` specifically and proves matching pair succeeds; database constraint, not role-based |
| loads conversations with the current messaging schema and legacy JSON snapshots | Participant can load null-snapshot event | User lookup `P2025` | Own participant row, message, event; now creates those rows explicitly |
| filters a participant-locally removed conversation without a render-time query failure | Removed participant sees neither conversation nor messages | User lookup `P2025` | Own participant row with removedAt changed; now proves access before removal and continued access for the other participant |

## Failure preservation

Before repair, strengthened the original signup test to require a persisted user.
Real red output:

```text
Signup must create a user before role assertions can prove anything:
expected null not to be null
Test Files  1 failed (1)
Tests       11 failed | 7 passed (18)
Duration    3.64s
```

The local test configuration defaults registration to `closed`, so signup
returned without creating an account. The old `if (user)` skipped every role
assertion. The fixture now explicitly selects public registration for this case,
provides a valid request boundary, and requires the real success redirect,
MEMBER-only persisted roles, a persisted session resolved by production code,
and the signup audit row. It submits all four privileged role names.

## Architecture and safety

See [the test contract](../development/authorization-testing.md). No production
files, authorization semantics, guard implementation, seed behavior, schema,
or migrations changed. The DB guard received additional tests only.

Each test creates explicit UUID-scoped fixtures in a real PostgreSQL transaction.
A test-only Prisma seam routes action/provider queries to that transaction;
nested action transactions use savepoints. Rollback removes even immutable
proposal versions without deleting protected rows, disabling triggers or resetting
the database. Exceptions propagate; only the exact intentional rollback sentinel
is consumed. Dedicated cases prove failed-fixture rollback and nested rollback.

## Additional concrete findings

- The original conversation and ownership checks constructed their own SQL
  filters instead of calling production authorization. Deleting the production
  guards could not affect those checks. They now invoke production paths.
- Discovery's draft loop could pass with no draft rows. Explicit hidden controls
  now exercise the production feed and lookup filters.
- The composite-FK test accepted any exception; it now requires the actual FK
  error and a successful matching-version control.
- Moderation used an unscoped `findFirst` and could read an unrelated case. Its
  fixture now owns the case, message, scope and event.
- Deleting users is not sufficient cleanup: submitted versions prohibit deletion,
  conversation events use restrictive FKs, and some audit/moderation identifiers
  are not cascading user relations. Transaction rollback handles all of them.
- Existing `scripts/seed-test-data.ts` falls back to `DATABASE_URL` and uses weaker
  substring host checks. It is not invoked or reused by this harness. Repairing
  that legacy script remains separate work.
- Other pre-existing integration files (`auth-protection.test.ts` and
  `messaging.test.ts`) contain mocked-self assertions or catch-and-ignore paths.
  They were inspected and left outside this focused authorization fixture change.

## Mutation testing

Ten temporary mutations were run individually after the 24-case suite passed.
Each run exited 1 with an assertion failure in the named test. Explicit backups
were restored in `finally` after each run; all touched files were checked
byte-for-byte afterward. No mutation is committed.

| Mutation | Expected failure | Actual failing test(s) |
|---|---|---|
| Remove `updateOpportunityAction` capability deny guard | MEMBER owner reaches update instead of forbidden | MEMBER ownership alone does not grant editing capability |
| Remove conversation participant `some` predicate | Outsider can load private conversation | User C cannot access User A/B conversation through production providers |
| Give success-path owner MEMBER instead of CLIENT | Update success is denied | CLIENT owner can edit a listing using database session roles |
| Change success-path listing owner to another CLIENT | Update success is denied by ownership | CLIENT owner can edit a listing using database session roles |
| Omit fixture UserRole relationships | Update success is denied for missing capability | CLIENT owner can edit a listing using database session roles |
| Omit fixture profile relationship | Published listing is no longer discoverable | published content is discoverable by others excluding draft/paused/rejected |
| Omit second conversation participant | Bob's positive message-access control fails | User C cannot access User A/B conversation through production providers |
| Remove received-proposal DRAFT exclusion | Private draft appears in received list | keeps private proposal drafts out of the opportunity owner's received list |
| Disable test database name check | Non-test/ambiguous names accepted | Five parameterized development/ambiguous-name cases plus rejects non-loopback hosts and non-test database names |
| Fall back to application DATABASE_URL | Missing dedicated configuration becomes accepted | never falls back to the application DATABASE_URL when test configuration is absent |

The test DB guard implementation was not changed by the repair; its two mutations
were additional validation of the expanded safety coverage.

## Configured-but-unavailable database

After the session interruption, Colima and the existing `perx-b3-test` container
were stopped. The configured integration command exited 1 with **24 failed / 0
skipped**, reporting `P1001` (database not reachable). The full suite likewise
exited 1 with **890 passed / 24 failed / 0 skipped** (142 files, 129.19s).
This was infrastructure unavailability, not fixture failure, and was not converted
to a skip. Restarted the existing local service and test container; a guarded
read-only check confirmed `perx_test`, PostgreSQL 16.14, all 19 migrations, and
zero leftover authorization fixture users before repeating acceptance.

The required command with explicitly empty dedicated test configuration exited 1
before Vitest, with `Safety Guard: TEST_DATABASE_URL is not provided.`

## Final acceptance gates

Local database: `perx_test`. No manual cleanup between authorization runs.

| Command / mode | Exit | Files passed / failed / skipped | Tests passed / failed / skipped | Duration |
|---|---:|---|---|---|
| `npm run test:authorization`, first run | 0 | 1 / 0 / 0 | 24 / 0 / 0 | 7.98s |
| Same command, second consecutive run | 0 | 1 / 0 / 0 | 24 / 0 / 0 | 8.33s |
| Same command, shuffled seed 42173 | 0 | 1 / 0 / 0 | 24 / 0 / 0 | 8.28s |
| `npm run test` with DB available | 0 | 142 / 0 / 0 | 914 / 0 / 0 | 135.94s |
| `TEST_DATABASE_URL= TEST_DIRECT_URL= npm run test` | 0 | 141 / 0 / 1 | 890 / 0 / 24 | 165.78s |
| `npm run lint` | 0 | N/A | N/A | 89s wall time |
| `npm run type-check` | 0 | N/A | N/A | 14s wall time |
| `npm run build` | 0 | N/A | N/A | 147s wall time; compiled in 54s |

The no-DB skip is the existing absent-dedicated-configuration contract, now
explicitly documented and paired with a required-database command for CI.
The total increased from 901 to 914: six additional authorization/harness cases
and seven additional DB guard cases. No original behavior check was removed.

The installed pg 8 driver emits a deprecation warning about overlapping queries
when existing production provider reads share the harness transaction. Tests
execute against the installed supported versions; no dependency was changed.
