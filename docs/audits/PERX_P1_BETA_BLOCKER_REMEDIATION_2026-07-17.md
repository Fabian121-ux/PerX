# perX P1 Beta-Blocker Remediation Report

Date: 2026-07-17
Branch: `main`
Commit: `59d3af381eb0f0aefeddd7b35ec312e8f18e5739`

## 1. Staging Database Connection Result

Safe environment summary, without printing secrets:

- `PERX_DATA_MODE`: present
- `DATABASE_URL`: present
- `DIRECT_URL`: present
- `NEXT_PUBLIC_SUPABASE_URL`: present
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: present
- `NEXT_PUBLIC_APP_URL`: present
- Supabase project ref from public URL: `qtmvausduxiqcguckfql`
- Runtime pooler host: `aws-0-eu-north-1.pooler.supabase.com`
- Runtime pooler port: `6543`
- Runtime username: `postgres.qtmvausduxiqcguckfql`
- Direct/migration host: `aws-0-eu-north-1.pooler.supabase.com`
- Direct/migration port: `5432`
- Direct/migration username: `postgres.qtmvausduxiqcguckfql`
- App URL host: `localhost`

Read-only connection checks:

- `DATABASE_URL` lightweight read: FAIL, PostgreSQL error code `28P01`, password authentication failed.
- `DIRECT_URL` lightweight read: FAIL, PostgreSQL error code `28P01`, password authentication failed.

Result: staging is not positively identified or working. `NEXT_PUBLIC_APP_URL` still points to localhost. No write-based manual tests or seed operations were run.

## 2. Migration Status

`npx prisma migrate status` result:

- Exit code: 1
- Datasource printed by Prisma: PostgreSQL database `postgres`, schema `public`, host `aws-0-eu-north-1.pooler.supabase.com:5432`
- Error: `Schema engine error:` with no detailed message

Result: migration status is blocked until the Supabase credentials and migration URL are corrected.

## 3. Environment-Validation Changes

Updated `src/lib/env.ts`:

- Adds validation for `DIRECT_URL`.
- Adds validation for `NEXT_PUBLIC_SUPABASE_URL`.
- Adds validation for `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Adds parsing/defaulting for `PERX_ENABLE_PREVIEW`, default `false`.
- Keeps production mock-mode prohibition.
- Requires complete database configuration in database mode.
- Rejects localhost `NEXT_PUBLIC_APP_URL` in Vercel preview/production or explicit staging/production deploy environments.
- Separates local `next build` semantics from deployed Vercel/staging strictness so local production builds can run without pretending to be a deployment.
- Reports missing variable names without printing secret values.

Updated `tests/unit/env.test.ts` with local, database, preview/staging, production mock, and preview-default coverage.

## 4. `/discover` Outage-Handling Result

Updated:

- `src/lib/data/opportunities.ts`
- `src/app/(public)/discover/page.tsx`
- `src/components/discover/discover-experience.tsx`
- `tests/unit/discovery-outage.test.ts`

Result:

- Public discovery now catches opportunity feed/category/detail database errors.
- `/discover` receives a controlled `dataUnavailable` state.
- The UI shows a controlled unavailable message.
- No mock data is substituted in database outage paths.
- Internal failures are logged with safe error name/message only.

## 5. Seed-Safety Changes

Refactored `prisma/seed.ts`:

- Removed hardcoded local database fallback URL.
- Baseline seed creates immutable roles/categories only.
- Baseline role/category upserts use `update: {}`.
- Development users require `PERX_ALLOW_DEV_SEED=true`.
- Sample marketplace data requires `PERX_ALLOW_SAMPLE_DATA=true`.
- Optional seed paths require a clearly non-production target through `PERX_DEPLOY_ENV=development`, `staging`, or `audit`, or localhost.
- Existing dev/admin users are not password-hash overwritten.
- Sample opportunities are idempotent.
- Duplicate audit-log creation was removed.
- Added `PERX_SEED_DRY_RUN=true` summary mode.

Updated:

- `.env.example`
- `tests/unit/seed-safety.test.ts`

`npm run db:seed` was not run because the configured database is not proven staging and database credentials fail authentication.

## 6. Payment/Escrow Wording Changes

Updated active and preview surfaces:

- `src/app/(workspace)/escrow/page.tsx`
- `src/app/(workspace)/wallet/page.tsx`
- `src/app/app/deals/page.tsx`
- `src/app/app/deals/[dealId]/page.tsx`
- `src/app/app/deals/[dealId]/deliveries/page.tsx`
- `src/app/app/deals/[dealId]/escrow/page.tsx`
- `src/app/app/proposals/received/page.tsx`
- `src/app/layout.tsx`
- `src/app/manifest.ts`
- `src/app/page.tsx`
- `src/app/(auth)/sign-in/page.tsx`
- preview wallet/escrow/deal pages
- `src/lib/data/static-pages.ts`
- `src/lib/data/preview.ts`
- `src/components/dashboard/trust-hero-card.tsx`

Result:

- Active UI now states payment and escrow are not active during beta.
- Active UI states no real funds are collected, held, transferred, or released by perX.
- Approval button now reads as a simulated release-state action.
- Remaining finance-related state is labelled simulated or unavailable.

## 7. Deal Authorization Changes

Updated:

- `src/features/deals/actions.ts`
- `src/features/deals/authorization.ts`
- `tests/unit/escrow.test.ts`

Result:

- Delivery approval now checks the stored `DealParticipant` role.
- Only stored `client` or `buyer` participants can approve eligible delivery.
- Freelancer/provider cannot approve their own delivery.
- Unrelated users are rejected.
- Invalid statuses are rejected before writes.
- Existing release records reject duplicate approval.
- Denials are audit-logged with safe metadata.
- Release ledger notes explicitly state simulated state only and no real funds.

## 8. Agent Markdown Cleanup

Changed:

- Deleted tracked non-runtime `AGENTS.md`.
- Deleted tracked non-runtime `CLAUDE.md`.
- Expanded `.gitignore` for future local agent instruction files:
  - `AGENTS.md`
  - `CLAUDE.md`
  - `**/AGENTS.md`
  - `**/CLAUDE.md`
  - `*.agent.md`
  - `*.agents.md`
  - `agent-notes.md`
  - `agents-notes.md`

## 9. Architecture Documents Created

Created:

- `docs/architecture/PERX_ACTIVITY_BASED_ROLE_AND_COMMERCE_TAXONOMY.md`
- `docs/architecture/PERX_UNIFIED_UI_UX_REFERENCE_ARCHITECTURE.md`

Scope:

- These documents record the required audits and proposed architecture.
- No Prisma role schema migration was performed.
- No full UI rewrite was started.
- Fixed-role onboarding remains to be implemented after review/approval.

## 10. Automated Command Results

Commands run from `C:\Users\cruzan\Documents\project\PerX`.

| Command | Result |
|---|---|
| `npm.cmd run lint` | PASS with 0 errors and 5 existing warnings |
| `npm.cmd run type-check` | PASS |
| `npm.cmd run test` | PASS after sandbox escalation, 14 files / 60 tests |
| `npm.cmd run test:e2e` | PASS after sandbox escalation, 14 Playwright tests |
| `npm.cmd run brand:generate` | PASS after sandbox escalation |
| `npx.cmd prisma validate` | PASS after escalation |
| `npx.cmd prisma generate` | PASS after escalation, Prisma Client 7.8.0 generated |
| `npx.cmd prisma migrate status` | FAIL, schema engine error against configured Supabase host |
| `npx.cmd cross-env PERX_DATA_MODE=database npm.cmd run build` | PASS after escalation |
| `npx.cmd cross-env NODE_ENV=production PERX_DATA_MODE=mock npm.cmd run build` | FAIL as intended: `PERX_DATA_MODE=mock is strictly prohibited in production.` |

Notes:

- `npm run test` and `npm run test:e2e` first hit sandbox `spawn EPERM`; escalated reruns passed.
- `brand:generate` first hit sandbox copy `EPERM`; escalated rerun passed.
- `prisma validate` first hit restricted engine-download/network behavior; escalated rerun passed.

## 11. Manual Staging-Test Results

Manual staging matrix was not run.

Reason:

- `NEXT_PUBLIC_APP_URL` is still localhost.
- Runtime database read fails with `28P01`.
- Direct/migration database read fails with `28P01`.
- Staging database cannot be proven dedicated, disposable, backed up, or non-production.

Blocked tests:

- Registration
- Duplicate email/username handling
- Sign-in/sign-out/session persistence
- Deactivated-user denial
- `/app` and `/admin` protection with real accounts
- Profile setup/edit
- Role changes and `ADMIN` self-grant denial
- Opportunity creation/publish/discovery
- Proposal submit/accept/reject
- Messaging persistence after refresh and restart
- User C conversation denial
- Deal delivery/approval/rejection
- Admin report/moderation isolation

No write-based staging test was executed.

## 12. Operational Beta Basics

Current status:

- Staging URL: NOT VERIFIED. Current app URL host is `localhost`.
- Staging admin account: NOT VERIFIED.
- Database backup procedure: NOT VERIFIED in Supabase dashboard.
- Restore procedure: NOT VERIFIED.
- Rollback/shutdown procedure: NOT VERIFIED.
- Vercel log access: NOT VERIFIED.
- Supabase log access: NOT VERIFIED.
- Health endpoint: code exists at `/api/health`; live staging behavior not verified.
- Bug-reporting channel: NOT VERIFIED.
- Support contact: NOT VERIFIED.
- Tester invitation process: NOT VERIFIED.
- Feedback collection method: NOT VERIFIED.
- Test-data cleanup process: NOT VERIFIED.

Owner dashboard checks still required:

- Confirm Vercel Preview/Production environment variables.
- Confirm Supabase project `qtmvausduxiqcguckfql` is dedicated staging, not production.
- Confirm backup/restore availability.
- Confirm log access and retention.
- Confirm a staging admin account.
- Confirm tester support and feedback channels.

## 13. Remaining P0 Findings

No P0 was proven in this pass.

## 14. Remaining P1 Findings

### P1-1: Staging database/runtime configuration is still broken

- Evidence: `DATABASE_URL` and `DIRECT_URL` read-only checks fail with `28P01`.
- Evidence: `NEXT_PUBLIC_APP_URL` host is `localhost`.
- Impact: Cannot verify real beta persistence or auth flows.
- Blocks 10-user pilot: Yes.

### P1-2: Prisma migration status cannot be verified

- Evidence: `npx prisma migrate status` fails with schema engine error against the configured Supabase host.
- Impact: Cannot prove migrations are applied in staging.
- Blocks 10-user pilot: Yes.

### P1-3: Manual User A/User B/User C/Admin staging matrix is blocked

- Evidence: staging cannot be positively identified and database auth fails.
- Impact: Messaging, proposal, deal, admin, and cross-user denial flows are not proven against PostgreSQL.
- Blocks 10-user pilot: Yes.

### P1-4: Fixed-role onboarding remains unresolved pending architecture approval

- Evidence: `src/app/(auth)/sign-up/page.tsx` still presents fixed role checkboxes; `UserRole` still maps user-selected roles to capabilities.
- Impact: Conflicts with new Founding Office direction and can grant non-admin capabilities from self-selected labels.
- Blocks 10-user pilot: Conditional. If beta invites are tightly controlled and role changes are monitored, this can be treated as a required pre-invite product decision; the recommended remediation is documented but not implemented in this pass because the request required audit before schema/onboarding changes.

## 15. Remaining P2 Findings

- No live error monitoring DSN/dashboard verification.
- No verified Vercel/Supabase logs access.
- Discovery still contains fake metrics/trend cards that should be removed before a polished beta.
- Duplicate signed-in route systems remain (`/app/**` and route-group aliases).
- Preview routes remain statically generated, gated by layout when visited.

## 16. Remaining P3 Findings

- Lint has five existing warnings unrelated to this remediation.
- Several future feature pages remain as placeholders and should be hidden or grouped under future modules.
- Documentation still needs a short operator runbook once real staging is configured.

## 17. Controlled-Beta Readiness Score

Score: 5/10

Reason: core local P1 code issues were remediated and automated gates mostly pass, but the real staging database and manual multi-user verification remain blocked.

## 18. Public-Production Readiness Score

Score: 2/10

Reason: production readiness still lacks verified deployment configuration, monitoring, backups/restore, legal/payment posture, route consolidation, and real operational procedures.

## 19. Final Verdict

`NO-GO`

Do not invite 10 real users yet. The controlled beta cannot begin while staging database connectivity, migration status, and real PostgreSQL manual verification remain blocked.

## 20. Exact Remaining Actions Before Inviting Users

1. Correct Supabase credentials for both runtime and migration URLs using URL-encoded password values.
2. Set `NEXT_PUBLIC_APP_URL` to the actual staging domain.
3. Confirm Supabase project `qtmvausduxiqcguckfql` is a dedicated non-production staging project.
4. Confirm staging backup/restore procedure or disposable audit-data policy.
5. Rerun:
   - `npx prisma validate`
   - `npx prisma generate`
   - `npx prisma migrate status`
   - runtime `SELECT 1`
   - direct/migration `SELECT 1`
6. Only after staging is proven, run the manual User A/User B/User C/Admin matrix.
7. Decide whether fixed-role onboarding must be removed before this beta or can be tightly controlled for the first internal pilot.
8. Verify Vercel/Supabase log access and `/api/health` on staging.
9. Prepare admin account, tester invitation process, support contact, bug-reporting channel, feedback form, and test-data cleanup plan.
