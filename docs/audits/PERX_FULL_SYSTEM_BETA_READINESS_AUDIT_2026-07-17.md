# PerX Full-System Beta-Readiness Audit - 2026-07-17

## 1. Executive Summary

Verdict: **NO-GO** for a 10-user controlled beta.

No P0 critical security/data-loss issue was proven from code inspection, but multiple P1 beta blockers remain. The current local/staging evidence does not prove a safe database-backed beta environment: both configured PostgreSQL URLs fail authentication, `NEXT_PUBLIC_APP_URL` is local, seed is not safe to run against an unknown shared database, database-backed manual flows could not be verified, and `/discover` returns 500 during a database authentication outage. Money/escrow copy also exposes misleading "protected funds" and secure-transaction claims while payments are not integrated.

Controlled-beta score: **3/10**. Public-production score: **1/10**.

## 2. Audit Scope and Limitations

Scope covered: local repository, route inventory, Next.js/Prisma/Supabase code paths, env readers, seed, CI config, build gates, local database-failure behavior, service worker/PWA, auth/session/actions, and security scans.

Limitations:

- No production or staging write actions were executed.
- No deployment, Vercel env, Vercel logs, Supabase dashboard, backup, restore, or monitoring dashboard access was available.
- GitHub connector returned no PR workflow runs for commit `59d3af3`; `gh` CLI is not installed.
- Database-backed manual E2E was blocked because staging could not be proven and the configured DB credentials fail authentication.
- Browser/manual tests with real User A/User B/User C/admin accounts were not completed.

## 3. Repository and Branch State

- Branch: `main`
- Commit: `59d3af381eb0f0aefeddd7b35ec312e8f18e5739`
- Remote: `https://github.com/Fabian121-ux/PerX.git`
- Initial dirty files: `src/lib/env.ts`, `tests/unit/env.test.ts`
- Final dirty files intentionally preserved: `src/lib/env.ts`, `tests/unit/env.test.ts`
- Generated audit scratch files were removed after use.

## 4. Architecture and Route Inventory

Stack observed:

- Next.js `16.2.9`, App Router, React `19.2.4`, TypeScript, Tailwind v4.
- Prisma `7.8.0` with `@prisma/adapter-pg` and generated client in `src/generated/prisma`.
- PostgreSQL/Supabase-style URLs configured locally, but authentication fails.
- Server actions implement core mutations; Prisma provider is dynamically imported outside mock mode.

Primary route groups:

- Public/auth: `/`, `/discover`, `/opportunities/:slug`, `/u/:username`, `/about`, `/help`, `/how-it-works`, `/privacy`, `/terms`, `/trust-safety`, `/sign-in`, `/sign-up`, `/password-recovery`, `/offline`.
- Protected duplicated workspace: `/app/**` and root workspace aliases such as `/dashboard`, `/market`, `/messages`, `/deals`, `/wallet`, `/escrow`.
- Admin: `/admin`, `/admin/users`, `/admin/profiles`, `/admin/opportunities`, `/admin/reports`, `/admin/reviews`, `/admin/disputes`, `/admin/verification`, `/admin/audit-logs`, `/admin/activity`, `/admin/moderation`.
- Preview: `/preview/**`, gated by `PERX_ENABLE_PREVIEW`.
- API: `/api/health`.

Feature classification:

| Feature | Status |
| --- | --- |
| Registration/sign-in/sessions | DB-backed in code, not verified against working DB |
| Profiles/roles | DB-backed in code, not verified against working DB |
| Opportunities | DB-backed; public feed partially degrades, categories do not |
| Saved opportunities | DB-backed, ownership by current user |
| Proposals | DB-backed, authorization present; persistence not manually verified |
| Messages | DB-backed action and participant check; persistence not manually verified |
| Deals/deliveries/reviews | DB-backed, but simulated escrow transitions |
| Reports/moderation/admin lists | DB-backed reads/writes in code; admin mutation depth limited |
| Notifications | Schema/read surface exists; no clear write workflow verified |
| Wallet/root escrow/real estate/logistics/service center | Placeholder or future-phase surfaces |
| Payments/escrow | Simulated/placeholder only; no compliant provider |

## 5. Pipeline Diagram

```text
Developer machine
  -> Git working tree on main, dirty local env/test changes
  -> GitHub repo Fabian121-ux/PerX
  -> GitHub Actions .github/workflows/ci.yml
       npm ci -> lint -> type-check -> test -> build
       no e2e, no prisma validate, no database migration status
  -> Vercel build/runtime
       no vercel.json or .vercel metadata in repo
       Vercel env/log/deployment status externally unverified
  -> Supabase PostgreSQL
       DATABASE_URL/DIRECT_URL present locally but SELECT 1 fails 28P01
  -> Prisma migrations
       single 0001_init migration; migrate status failed
  -> App runtime
       cookie sessions, server actions, Prisma provider, service worker
```

## 6. Environment Matrix

| Variable | Local `.env` evidence | Preview expectation | Production expectation | Finding |
| --- | --- | --- | --- | --- |
| `PERX_DATA_MODE` | Present, database | database | database only | Mock forbidden in production |
| `DATABASE_URL` | Present, remote DB, auth fails | Supabase pooler | Supabase pooler | P1: not usable |
| `DIRECT_URL` | Present, remote DB, auth fails | direct migration URL | direct migration URL | P1: not usable |
| `NEXT_PUBLIC_SUPABASE_URL` | Present | public project URL | public project URL | Not validated in code |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Present | publishable key | publishable key | Not validated in code |
| `SESSION_COOKIE_NAME` | Present | required | required | Validated |
| `AUTH_SESSION_DAYS` | Present | required | required | Validated |
| `NEXT_PUBLIC_APP_URL` | Present but local | staging URL | production URL | P1: local URL in DB env |
| `UPLOAD_MAX_BYTES` | Present | required if uploads enabled | required | Validated but upload workflow absent |
| `LOG_LEVEL` | Present | required | required | Validated |
| `ERROR_MONITORING_DSN` | Empty | recommended | required for production | P2/P1 ops gap |
| `PERX_ENABLE_PREVIEW` | Present false | false unless review env | false | Not in `src/lib/env.ts` |

Environment-reader gaps: `src/lib/env.ts` validates only `DATABASE_URL`, `PERX_DATA_MODE`, session, app URL, upload, log, DSN. It does not validate `DIRECT_URL`, Supabase public vars, or `PERX_ENABLE_PREVIEW`. It defaults `NEXT_PUBLIC_APP_URL` to localhost (`src/lib/env.ts:3-11`, `src/app/layout.tsx:40`).

## 7. Prisma and Supabase Assessment

Positive:

- Prisma schema validates.
- Prisma Client generates in isolated copy.
- Runtime uses Prisma 7 with `PrismaPg` adapter (`src/lib/db/prisma.ts:1-24`).
- `DATABASE_URL` is used at runtime and `prisma.config.ts` prefers `DIRECT_URL` for CLI operations (`prisma.config.ts:4-17`).
- Money is modeled as `BigInt` minor units in core schema.

Blockers:

- `DATABASE_URL` and `DIRECT_URL` both fail `SELECT 1` with `28P01 password authentication failed for user "postgres"`.
- `npx prisma migrate status` failed with a Prisma schema-engine error after engine load; migration application status remains unverified.
- Seed was not run. It is not safe for unknown staging: it updates role/category labels, updates seeded account password hashes, creates sample opportunities, and creates a new audit log row every run (`prisma/seed.ts:38-55`, `65-68`, `116-119`, `166-234`, `239-245`).
- Seed falls back to a hardcoded local URL if env is missing (`prisma/seed.ts:8-11`).

Database design observations:

- Useful indexes exist for sessions, opportunity feed, bookmarks, messages, proposals, deals, notifications, audit logs.
- Many relations cascade on user deletion. For beta, this is acceptable only if no admin UI can delete users; public production needs explicit retention/data-deletion policy.
- `BlockedUser` has no relations to `User`; it cannot enforce referential integrity.

## 8. Vercel and CI Assessment

CI:

- CI runs `npm ci`, lint, type-check, test, build (`.github/workflows/ci.yml:17-21`).
- CI does not run e2e, Prisma validate/generate/migrate status, brand generation, production mock-mode gate, or database-mode build with real env.

Vercel:

- No `vercel.json`.
- No `.vercel/project.json`.
- No `.openai/hosting.json`.
- Vercel deployments/env/logs/status were not externally verified.
- Database-mode build succeeds locally, but because DB credentials fail and many pages are dynamic, this does not prove Vercel runtime DB connectivity.

## 9. Authentication and Authorization Assessment

Positive:

- Passwords use bcrypt cost 12 (`src/lib/auth/password.ts:3-8`).
- Sessions are opaque random tokens stored hashed in DB; cookie is `httpOnly`, `sameSite: "lax"`, and `secure` in production (`src/lib/auth/session.ts:32-57`).
- Deactivated users are denied in `getCurrentUser()` (`src/lib/auth/session.ts:90-91`).
- `/app/**` and root workspace layout require a user; `/admin/**` requires `admin:access`.
- Normal users cannot add `ADMIN` via roles action (`src/features/roles/actions.ts:28-37`).
- Server actions generally call `requireUser()` and validate inputs.

Findings:

- No rate limiting for sign-up/sign-in/password recovery.
- No explicit CSRF token. Server Actions get Next.js origin checks, but no extra CSRF defense is visible.
- Sign-up role creation errors are swallowed after user creation, which can leave partially-created users (`src/features/auth/actions.ts:99-108`).
- Deal delivery approval/release allows any deal participant to approve and release simulated escrow state, not specifically the buyer/client (`src/features/deals/actions.ts:71-150`).
- Manual auth flows could not be verified against PostgreSQL due DB auth failure.

## 10. Feature Persistence Matrix

| Feature | DB-backed in code | Auth | Ownership/authz | Refresh persistence verified | Limitations |
| --- | --- | --- | --- | --- | --- |
| Registration | Yes | Public create | N/A | No | DB unreachable |
| Sign-in/out | Yes | Cookie session | Deactivated denied | No | DB unreachable |
| Profile setup/edit | Yes | Yes | `user.id` | No | Not manually verified |
| Roles | Yes | Yes | self only, ADMIN stripped | No | Role update deletes/recreates non-admin roles |
| Opportunities | Yes | Yes for create | create capability | No | Public category outage causes 500 |
| Saved opportunities | Yes | Yes | current user unique key | No | Input not schema-validated as CUID |
| Proposals | Yes | Yes | create/decide capability and owner check on accept | No | No manual persistence proof |
| Messages | Yes | Yes | participant check on write; read selected from user conversation list | No | Persistence after refresh/restart blocked |
| Deals | Yes | Yes | participant read/write | No | Simulated state only |
| Deliveries | Yes | Yes | participant only | No | Participant role not constrained |
| Reviews | Yes | Yes | participant/eligible deal | No | No duplicate handling verified |
| Reports | Yes | Yes | reporter is session user | No | Admin resolution workflow minimal |
| Notifications | Schema/read count | Yes | user-scoped count | No | No create/read workflow verified |
| Admin functions | Yes reads | Admin capability | admin role | No | Mostly list views; no live dashboard verification |

## 11. Security Findings

See P1/P2/P3 sections for severity. High-signal scan covered TODO/FIXME/HACK, test/demo/mock, hardcoded password, console logging, dangerous HTML/eval, ADMIN, env, redirect, and Prisma usage.

No `dangerouslySetInnerHTML`, `eval(`, or committed secret value was found in source. `.env` is ignored. `NEXT_PUBLIC_*` values observed are public-class values, not server secrets.

Security gaps:

- No CSP header; proxy sets only Permissions-Policy, Referrer-Policy, nosniff, and X-Frame-Options (`src/proxy.ts:4-9`).
- Proxy only tags `x-middleware-subrequest`; it does not block the request (`src/proxy.ts:18-20`). App auth is server-side, so this is not primary auth risk.
- Auth endpoints have no visible throttling.
- Logging uses `console.error` in several server paths; errors are not redacted/structured. Dev DB logs included DB user name and auth error.

## 12. Database and Migration Findings

- One migration exists: `prisma/migrations/0001_init/migration.sql`.
- Schema validates.
- Prisma generate passes in isolated copy.
- Migration status failed; applied migration state not verified.
- Connection pooling uses `pg.Pool` singleton behind `globalThis.__perxPrisma`, appropriate for avoiding repeated client creation in a single runtime instance.
- Supabase pooler/direct host/port consistency could not be verified beyond local URL classification because the URLs are not printed and auth fails.

## 13. Reliability and Error Handling Findings

Positive:

- Global/root/app/admin error boundaries exist.
- `/api/health` performs read-only `SELECT 1` and returns safe `503` on failure (`src/app/api/health/route.ts:8-24`).
- Protected `/app` failed closed to `/sign-in?next=/app`.
- Mock fallback did not occur in database mode.

Blocker:

- With invalid DB credentials, `/discover` returns HTTP 500. Root cause: `getOpportunityFeed()` catches DB errors, but `getCategories()` does not (`src/lib/data/opportunities.ts:3-20`).

## 14. UI, Mobile, and Accessibility Findings

Evidence completed:

- Playwright mock E2E ran on Desktop Chrome and Pixel 7.
- Smoke covered `/`, `/discover`, `/sign-in`, `/app`, `/admin`, `/preview`.
- Protected database-backed app surfaces were not manually verified with real accounts.

Material beta issues:

- Root workspace duplicates (`/dashboard`, `/messages`, `/deals`) and `/app/**` duplicates can confuse navigation and tests.
- Placeholder/future pages are exposed in navigation: wallet, escrow, real estate, logistics, services, service center.
- The root escrow placeholder says "protected funds" even though no provider is integrated (`src/app/(workspace)/escrow/page.tsx:5-8`).
- The e2e primary public journey timed out once on both desktop and mobile and passed only on retry.

## 15. PWA and Icon Findings

Positive:

- Metadata references `/favicon.ico`, Apple touch icon, 16/32/192/512 icons (`src/app/layout.tsx:29-40`).
- Manifest references 192, 512, and maskable icons (`src/app/manifest.ts`).
- `npm run brand:generate` passes in isolated copy and states icons are generated from `public/main_app_logo.png`.
- Service worker excludes `/api`, `/app`, `/admin`, messages and deals from cache (`public/sw.js:40-48`).

Gaps:

- Service worker pre-caches `/brand/perx-logo-horizontal-light.png` and dark wordmarks; acceptable as brand assets, but full PWA installed-icon verification was not manually performed.
- PWA install was not verified in a real staging browser session.

## 16. Performance Assessment for 10 Users

Likely capacity for 10 invited users is acceptable if DB credentials/pooler are corrected:

- Queries are mostly bounded with `take: 20`/`take: 30`.
- Key indexes exist for feed, messages, proposals, deals, sessions.
- Prisma client is singleton-like per runtime instance.

Risks:

- Public search uses `contains` across title/summary/description without full-text index.
- Some admin list includes joins may grow but are bounded.
- No real staging concurrency test was run because DB auth fails.

## 17. Operational-Readiness Findings

Not verified or absent from repo:

- Deployed beta environment.
- Database backup and restore procedure.
- Rollback procedure tied to Vercel and migrations.
- Admin account in staging.
- User invitation process.
- Bug-reporting channel/support contact.
- Error-log access and monitoring alerts.
- Test-data cleanup process.
- User feedback form.
- Beta agreement beyond basic terms/privacy pages.
- Clear simulated-payment disclosure on every money/escrow surface.

## 18. Exact Automated Command Results

| Command | Result |
| --- | --- |
| `npm run lint` | PASS, 0 errors, 5 warnings |
| `npm run type-check` | PASS |
| `npm run test` | Initial sandbox `spawn EPERM`; escalated PASS, 12 files/44 tests |
| `npm run test:e2e` | Initial sandbox `spawn EPERM`; escalated exit 0, 12 passed, 2 flaky passed on retry |
| `npm run brand:generate` | PASS in isolated copy |
| `npx prisma validate` | Initial engine download/network fail; escalated PASS |
| `npx prisma generate` | Initial engine download/network fail in isolated copy; escalated PASS in isolated copy |
| `npx prisma migrate status` | Initial engine fail; escalated FAIL: schema-engine error, no migration status |
| `npm run db:seed` | BLOCKED, not executed; staging not proven and seed is unsafe for shared data |
| `npm run build:mock` | FAIL: `PERX_DATA_MODE=mock is strictly prohibited in production` during prerender |
| `npx cross-env PERX_DATA_MODE=mock npm run build` | FAIL for same correct mock-production prohibition |
| `npx cross-env PERX_DATA_MODE=database npm run build` | PASS |
| `npx cross-env NODE_ENV=production PERX_DATA_MODE=mock npm run build` | FAIL for correct mock-production prohibition |
| `npm run build` | PASS |

Additional diagnostics:

- `DATABASE_URL` read-only `SELECT 1`: FAIL `28P01`.
- `DIRECT_URL` read-only `SELECT 1`: FAIL `28P01`.
- `/api/health` in database mode with bad DB: 503 safe JSON.
- `/`: 200, no Prisma/DB credential text in HTML.
- `/app`: 307 to `/sign-in?next=/app`.
- `/preview`: 404.
- `/discover`: 500 during DB auth failure.

## 19. Exact Manual-Test Results

Manual database-backed staging tests were **blocked**. Reason: staging was not proven and both configured DB URLs fail authentication.

| Test | Route | Account | Expected | Actual | Result |
| --- | --- | --- | --- | --- | --- |
| Public visitor root | `/` | Public | Loads without secret leakage | 200, no DB secret text | PASS |
| Health outage | `/api/health` | Public | Safe 503 | 503 `{"status":"degraded","database":"unavailable"}` | PASS |
| Protected fail closed | `/app` | Public | Redirect sign-in | 307 `/sign-in?next=/app` | PASS |
| Preview blocked | `/preview` | Public | 404 | 404 | PASS |
| Discover outage | `/discover` | Public | Controlled empty/error state | 500 | FAIL |
| Registration | `/sign-up` | User A | Create DB user | Blocked | BLOCKED |
| Messaging persistence | `/messages` | User A/B/C | Persist after refresh/restart and deny C | Blocked | BLOCKED |
| Deal flow | `/deals` | User A/B | Create/transition deal | Blocked | BLOCKED |
| Admin access | `/admin` | Admin | Admin-only access | Blocked | BLOCKED |
| PWA install | Browser | Public/auth | Install icon/offline behavior | Blocked | BLOCKED |

## 20. Externally Unverified Items

- GitHub Actions execution history for current branch/commit.
- Vercel environment variables, deployment status, runtime logs, domains, and functions connectivity.
- Supabase dashboard settings, backups, network restrictions, pooler configuration, and monitoring.
- Production/staging app URL correctness.
- Error monitoring and alert routing.

Manual owner checks required:

- Confirm Vercel project envs for Preview and Production separately.
- Confirm `NEXT_PUBLIC_APP_URL` is not localhost in staging/production.
- Confirm Supabase project ref, pooler host/user/port, direct URL, password encoding, and backups.
- Confirm latest GitHub Actions runs and branch protection.
- Confirm Vercel logs after a staging request to `/api/health`, `/discover`, `/sign-in`, `/app`.

## 21. P0 Findings

None proven.

## 22. P1 Findings

1. **No verified working staging database/app environment**
   - Evidence: DB probes failed `28P01`; local app URL classified as localhost.
   - Impact: core flows cannot be verified or used.
   - Beta impact: blocks pilot.
   - Remediation: fix Supabase credentials/URL encoding and staging URL; verify read/write with disposable staging accounts.
   - Effort: 0.5-1 day.
   - Blocks 10-user pilot: yes.

2. **Database-backed manual persistence verification blocked**
   - Evidence: registration, messaging, proposals, deals, admin tests were not run.
   - Impact: cannot claim real-user beta readiness.
   - Remediation: provide staging URL/DB proof and run manual matrix.
   - Effort: 1-2 days.
   - Blocks 10-user pilot: yes.

3. **Seed is unsafe for unknown staging**
   - Evidence: updates seeded password hashes and creates audit log every run (`prisma/seed.ts:65-68`, `116-119`, `239-245`).
   - Impact: can alter shared staging users and pollute audit logs.
   - Remediation: split immutable baseline seed from disposable audit seed; require explicit env guard.
   - Effort: 0.5-1 day.
   - Blocks 10-user pilot: yes if seed is part of release gate.

4. **Public `/discover` 500 on database outage**
   - Evidence: local failure-mode test returned 500; `getCategories()` lacks catch (`src/lib/data/opportunities.ts:18-20`).
   - Impact: public discovery fails hard during DB auth/outage.
   - Remediation: catch category/feed failures and render controlled empty/degraded state.
   - Effort: 0.5 day.
   - Blocks 10-user pilot: yes.

5. **Misleading money/escrow wording without provider**
   - Evidence: root escrow says "protected funds" (`src/app/(workspace)/escrow/page.tsx:5-8`); metadata says "transacting securely" (`src/app/layout.tsx:27-28`).
   - Impact: users may believe PerX holds or protects real funds.
   - Remediation: label all wallet/escrow surfaces as simulated/unavailable until provider integration.
   - Effort: 0.5 day.
   - Blocks 10-user pilot: yes.

6. **Simulated escrow release can be triggered by any participant**
   - Evidence: `approveDeliveryAction` checks only participant membership (`src/features/deals/actions.ts:71-150`).
   - Impact: wrong participant can move deal state/reputation.
   - Remediation: enforce buyer/client role and current state; add tests.
   - Effort: 0.5-1 day.
   - Blocks 10-user pilot: yes for deal-flow beta.

7. **Environment validation incomplete for deployment**
   - Evidence: env schema omits `DIRECT_URL`, Supabase vars, `PERX_ENABLE_PREVIEW`; defaults app URL to localhost (`src/lib/env.ts:3-11`).
   - Impact: production can build/run with missing or wrong required envs.
   - Remediation: add environment-specific validation and fail production/preview clearly.
   - Effort: 0.5 day.
   - Blocks 10-user pilot: yes.

## 23. P2 Findings

1. **No auth rate limiting**
   - Impact: brute-force/sign-up abuse risk.
   - Remediation: add edge/app rate limits for sign-in, sign-up, password recovery.
   - Effort: 1 day.

2. **No CSP**
   - Evidence: proxy has basic headers only (`src/proxy.ts:4-9`).
   - Impact: less defense-in-depth against XSS.
   - Remediation: add staged CSP report-only, then enforce.
   - Effort: 1 day.

3. **Health endpoint claims mock DB connected**
   - Evidence: mock branch returns `database: "connected"` (`src/app/api/health/route.ts:10-13`).
   - Impact: misleading ops signal.
   - Remediation: return `database: "mock-disabled"` or `not_applicable`.
   - Effort: 0.25 day.

4. **CI is incomplete**
   - Evidence: no e2e/prisma/migration gates in `.github/workflows/ci.yml`.
   - Impact: regressions can merge.
   - Remediation: add non-prod-safe gates and DB-free build checks.
   - Effort: 0.5-1 day.

5. **Operational monitoring not configured**
   - Evidence: `ERROR_MONITORING_DSN` empty; no alert docs.
   - Impact: beta issues may go unnoticed.
   - Remediation: configure error monitoring/log access/alerts.
   - Effort: 0.5-1 day.

6. **Root workspace and `/app/**` duplicate routes**
   - Impact: navigation/policy confusion.
   - Remediation: choose canonical protected URL set and redirect aliases.
   - Effort: 0.5-1 day.

## 24. P3 Findings

1. Lint has 5 warnings.
2. E2E primary public journey is flaky on first attempt.
3. `build:mock` script conflicts with production mock-mode prohibition; decide whether static mock build is still supported.
4. Docs mention old Test Account/mock behavior in places; update to current behavior.
5. `prisma.config.ts` only warns when DB URLs are absent; production migration scripts should fail clearer.

## 25. Controlled-Beta Score

**3/10**

The codebase has a credible MVP skeleton and many server-side checks, but the beta cannot start until staging DB/app configuration works, persistence is manually verified, misleading money copy is corrected, seed is made safe, and `/discover` outage behavior is fixed.

## 26. Public-Production Score

**1/10**

Public production needs all beta blockers fixed plus provider/compliance decisions, backups/restore, rollback, monitoring, rate limiting, CSP, operational runbooks, privacy/terms review, and real deployment evidence.

## 27. Final Verdict

**NO-GO**

Do not invite 10 real users while P1 blockers remain.

## 28. Ordered Remediation Plan

1. Fix staging environment: correct Supabase URLs/password encoding, set staging `NEXT_PUBLIC_APP_URL`, verify `SELECT 1` for `DATABASE_URL` and `DIRECT_URL`.
2. Add production/preview env validation for all required vars; forbid localhost app URL outside local.
3. Fix `/discover` DB outage handling for categories and opportunity detail pages.
4. Replace misleading escrow/wallet copy with explicit simulated/unavailable wording.
5. Split seed into safe baseline seed and disposable audit seed; make audit log idempotent or skip in seed.
6. Enforce deal role/state authorization for delivery approval/release.
7. Run database-backed manual E2E with User A, User B, User C, and admin.
8. Add CI gates for e2e, Prisma validate/generate, database-mode build, production mock-mode failure, and migration status against staging.
9. Configure monitoring, backups, rollback, support channel, and beta feedback process.
10. Add rate limiting and CSP hardening before public production.

## 29. Five-to-Seven-Day Pilot Plan for 10 Invited Users

Day 0-1:

- Fix P1 blockers and verify staging DB/app.
- Create disposable audit/admin accounts.
- Confirm backups and rollback.

Day 2:

- Run full manual E2E matrix and record screenshots/logs.
- Invite 2 internal testers.

Day 3:

- Invite 3 external trusted testers.
- Focus on sign-up, profile, roles, opportunity creation, proposals.

Day 4:

- Invite remaining 5 testers.
- Focus on messaging persistence, deal state, reviews, reports.

Day 5:

- Review logs, bug reports, support requests, and DB records.
- Patch only approved critical fixes.

Day 6-7:

- Re-run release gates and manual smoke.
- Decide continue/pause based on stop-test conditions.

## 30. Stop-Test Conditions

Pause beta immediately if any occurs:

- Unauthorized user can read/write another user's conversation, profile, deal, proposal, saved item, or admin data.
- DB writes fail for more than one core flow.
- Real-money or protected-funds claim appears without explicit simulated/unavailable wording.
- Health is red for more than 15 minutes.
- Prisma/DB credentials, session tokens, private messages, or stack traces appear in public UI/log drains.
- More than two users cannot sign in or recover from invalid sessions.
- Any migration/seed threatens non-disposable data.

