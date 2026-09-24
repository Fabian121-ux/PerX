# Authorization integration tests

`npm run test` runs unit and integration tests. `authorization.test.ts` has an
intentional optional-database contract: when `TEST_DATABASE_URL` is absent or
empty, its database cases skip. A configured database that is unsafe, unreachable,
unmigrated, or broken **fails**; connection errors never become skips.

Vitest loads `.env.test.local`, then `.env.test`, without overriding existing
shell variables. It does not load `.env`. Use a dedicated loopback PostgreSQL
database whose name matches `perx_test`, `perx_test_*`, `perx_e2e`, or `perx_e2e_*`.
Configure `TEST_DATABASE_URL` in the ignored test env file; `TEST_DIRECT_URL` is
optional and must satisfy the same guard. Never use development, preview, or
production data. The guard rejects production fingerprints, remote hosts,
ambiguous database names, non-Postgres URLs, and target-overriding parameters.
The application `DATABASE_URL` is never a fallback for this suite.

Apply the repository's existing migrations to that designated database:

```sh
node --import tsx --input-type=module -e 'import { loadTestEnv } from "./tests/utils/load-test-env.ts"; import { enforceTestDatabaseIsolation } from "./tests/e2e/utils/db-guard.ts"; loadTestEnv(); enforceTestDatabaseIsolation();'
npm run db:local -- migrate deploy
```

No development or sample seed is required. Do not use `db push`: the suite tests
PostgreSQL triggers and constraints created by migrations.

```sh
npm run test:authorization
npm run test:authorization
npm run test:authorization -- --sequence.shuffle --sequence.seed=42173
npm run test
```

`test:authorization` is a **required-database** command. Missing configuration
fails before Vitest starts, preventing a green integration job made entirely of
skips. It accepts ordinary Vitest options for diagnostic runs; acceptance runs
must not select a subset of cases.

To exercise the ordinary no-database mode while an ignored env file exists:

```sh
TEST_DATABASE_URL= TEST_DIRECT_URL= npm run test
```

The explicitly empty dedicated variables override dotenv loading. No application
configuration file needs to be moved or changed. Without local test env files,
unsetting these two variables has the same effect.

## Fixture boundaries

Cases create the UUID-scoped users, persisted roles and resource
relationships they need. Membership, CLIENT, FREELANCER and ADMIN fixtures are explicit.
Sessions are created and resolved by production code against real database rows;
only Next's cookie/header request context and cache revalidation are supplied by
the test. Redirects retain their real Next.js control flow.

The test's `getPrisma` seam routes production queries into one real PostgreSQL
transaction per case. All fixtures, role upserts, sessions, audit rows and resource
changes roll back, including when an assertion throws. Submitted proposal
versions prohibit deletion, so rollback avoids disabling their triggers or
inventing destructive database cleanup. Nested callback transactions use SQL
savepoints, preserving atomic rollback of failed actions and recovery after
expected constraint errors. Array transactions are deliberately unsupported and
fail loudly. This harness proves authorization and persistence inside a real
transaction; it does not claim to test independent concurrent transaction commits
or HTTP transport.

The suite checks that fixture users are absent after rollback, that fixture
failures propagate, and that nested action failures roll back their writes.
No whole-database reset, seed ordering, or pre-existing user is required.

## CI

The existing `checks` job has no database and exercises the optional no-DB
contract. The `authorization-integration` job starts a disposable PostgreSQL 16
service bound to runner loopback, validates the same isolation guard, applies
existing migrations, runs the required authorization command twice (including
shuffled order), and runs the full suite with Postgres available. Service trust
authentication is confined to this disposable loopback service. There are no
external database credentials, paid infrastructure, or deployment changes.
