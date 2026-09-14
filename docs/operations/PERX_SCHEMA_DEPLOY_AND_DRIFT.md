# PerX Schema Deploy and Drift Detection

How database migrations reach Production, in what order relative to code, and how
the running application reports when the two have diverged.

## Why this exists

Code auto-deploys to Vercel on merge to `main`. **Schema does not.**
`prisma migrate deploy` exists only as the hand-run `db:migrate` npm script.

In September a merged-but-unapplied migration left Production running code its
database had never seen, for 15 days. The information was available the entire
time — `src/lib/db/prisma.ts` sets `log: ["error"]`, so Prisma printed
`relation does not exist` to the server console on every affected request.
Nothing was watching.

That is an **alerting** problem, not a logging problem. The fix is that the
running application now reports its own drift.

## Deploy order

**Apply migrations before, or together with, the merge that depends on them.**

Because code ships automatically and schema does not, any window where the code
is ahead of the schema is an outage window. The safe orderings are:

1. **Additive migration** (new table, new nullable column, new index):
   apply first, then merge. The old code ignores what it does not know about.
2. **Destructive or narrowing migration** (dropped column, tightened
   constraint, renamed field): this needs two deploys. Ship code tolerant of
   both shapes, apply the migration, then ship the cleanup. Never merge a
   single PR that both narrows the schema and depends on the narrowing.

Never merge first and apply afterwards. That is precisely the September
sequence.

## The command

Migrations are applied from a workstation or a secure ops environment, never
from a Vercel build step.

```sh
PERX_ALLOW_REMOTE_DATABASE_COMMAND=i-understand-this-targets-remote-data \
  npx prisma migrate deploy
```

Three rules, all load-bearing:

- **The opt-in is inlined on the single command.** Never `export` it. An
  exported value persists for the rest of the shell session and will silently
  authorise the *next* database command too, which may not be the one you
  intended.
- **Only `migrate deploy` is ever run against a shared database.** Never
  `migrate dev`, `migrate reset`, or `db push`. `migrate dev` will try to
  reconcile drift by generating and applying a new migration; against
  Production that rewrites history and can drop data.
- **Loopback is the default.** `prisma.config.ts` fails closed for any Prisma
  subcommand that opens a connection unless every database URL resolves to
  loopback. Note that Prisma reads `DIRECT_URL` in preference to `DATABASE_URL`,
  and `prisma.config.ts` loads `.env` — so overriding only `DATABASE_URL` does
  **not** redirect the CLI. For local work use the wrapper, which sets both:

```sh
npm run db:local -- migrate status
npm run db:local -- migrate deploy
```

## Expected baseline drift — do not "fix" this

`prisma migrate status` and `migrate diff` report pre-existing differences
between the migration history and `schema.prisma` on these tables:

| Table | Reported difference |
| --- | --- |
| `Approval` | FK renamed `Approval_milestoneId_fkey` → `Approval_milestoneId_dealId_fkey` |
| `Deal` | FK renamed `Deal_proposalVersionId_fkey` → `Deal_proposalVersionId_proposalId_fkey` |
| `Release` | FK renamed `Release_milestoneId_fkey` → `Release_milestoneId_dealId_fkey` |
| `EnforcementAction` | `updatedAt` default `Now` → `None` |
| `EnforcementAppeal` | `updatedAt` default `Now` → `None` |
| `ModerationCase` | `updatedAt` default `Now` → `None` |

This is **cosmetic and expected**. These are naming and default-value artefacts
of how the migrations were originally authored; the effective schema is
correct and the application behaves identically.

**Do not run `migrate dev` to resolve it.** Doing so generates a "fix"
migration against a shared database and is far more dangerous than the drift it
claims to repair. Treat this table as the known-good baseline: only differences
*outside* this list are real.

Note this baseline drift is a different thing from the drift detection below.
Baseline drift is `schema.prisma` vs migration history. The runtime check is
*migrations this build expects* vs *migrations the database applied* — which is
the one that caused the outage.

## Drift detection at runtime

CI cannot detect that Production is behind. It has no Production credentials
and **must never be given any**. The running application is the only place that
holds both numbers, so that is where the check lives.

### The manifest

`src/generated/migration-manifest.ts` is a generated, committed list of the
migrations a build expects.

```sh
npm run migrations:manifest
```

It is generated rather than read from disk at runtime because `prisma/` is not
reliably present in a Vercel serverless bundle — only what the module graph
imports is guaranteed to ship.

`npm run build` regenerates it, and CI regenerates it and fails on any diff, so
adding a migration without regenerating cannot merge.

### The check

`src/lib/db/migration-drift.ts` queries `_prisma_migrations` for rows that both
finished and were not rolled back, and diffs against the manifest. Results are
cached for **60 seconds**. It never throws: every failure resolves to
`indeterminate`, because a drift check that can fail closed would become an
outage of its own.

States:

| State | Meaning |
| --- | --- |
| `current` | Manifest and database agree. |
| `pending` | **The September failure.** Repo is ahead; migrations are unapplied. |
| `unknown-applied` | Database is ahead — a rollback, or a newer deployment sharing the database. |
| `indeterminate` | The check could not run. **Not** evidence of drift. |

### Where it surfaces

**`GET /api/health` — public.** Reports a coarse `schema` field only:
`"current" | "drifted" | "unknown"`. When drifted it returns
`status: "degraded"` with **HTTP 503**, because a deployment whose schema is
behind its code genuinely is degraded, and 503 is what an uptime monitor
alerts on — a 200 carrying a field nobody configured an alert for is how this
was missed the first time.

This route has no auth gate, so it **never** discloses migration names or
counts. Both are deployment fingerprints.

**`/admin/schema` — gated on `settings:manage`.** Names the specific pending
migrations, so an operator can act on the alert without needing Production
database access.

### Responding to a drift alert

1. Open `/admin/schema` and read the pending migration names.
2. Confirm those migrations are the ones you expect from recent merges.
3. Apply them with the command above.
4. Re-check `/api/health`. Allow up to 60s for the cache to expire.

If the state is `unknown-applied`, stop and investigate before applying
anything: the database has migrations this build does not know about, which
usually means another deployment is ahead of you or a rollback is in progress.

## Not covered here

Automated migration on deploy (a CD workflow holding Production credentials) is
an infrastructure decision and is deliberately **not** implemented. Until it
exists, the manual step above is a required part of every schema-affecting
release.
