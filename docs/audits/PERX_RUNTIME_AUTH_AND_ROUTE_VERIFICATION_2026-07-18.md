# PerX Runtime, Auth and Route Verification Audit

Date: 2026-07-18

## 1. Runtime-error root cause

The deploy-time browser symptom was the generic production Server Component error rendered by the root error boundary:

```text
Content Unavailable
Some live content is temporarily unavailable.
```

The code-level root cause found in this workspace was that public data helpers resolved the runtime data provider before entering their guarded `try` blocks.

For `/`, the failing import/execution chain was:

```text
/
-> src/app/page.tsx
-> FeaturedOpportunities()
-> getOpportunityFeed()
-> getPerXDataProvider()
-> getResolvedDataMode()
-> getServerEnv() / assertDatabaseConfiguration()
```

Because `getPerXDataProvider()` ran outside the section-level catch, any strict environment/provider failure happened before the homepage could render the intended unavailable section state. This can occur before a Prisma query is executed. Prisma query failures inside the provider call were already caught in some helpers, but provider-resolution and strict env failures were not.

The same unsafe pattern affected public discovery/profile/detail helper paths:

```text
/discover
-> getPublicDiscoveryData()
-> getPerXDataProvider()

/opportunities/[slug]
-> getOpportunityBySlug()
-> getPerXDataProvider()

/u/[username]
-> getPublicProfile()
-> getPerXDataProvider()
```

## 2. Failing route and import chain

Primary route fixed:

```text
/
```

Likely affected public routes:

```text
/discover
/categories/[slug]
/opportunities/[slug]
/u/[username]
```

No `/businesses/**` route exists in the current `src/app` inventory.

## 3. Vercel log evidence

Blocked in this workspace.

Evidence of the block:

```text
command -v vercel -> no Vercel CLI found
ls .vercel -> .vercel does not exist
```

Therefore the exact Vercel runtime digest, deployed stack trace, deployment ID and root request log could not be retrieved here. The deployed homepage must still be checked by the project owner after pushing/deploying these changes.

## 4. Environment variables checked

Checked by name only, without printing secret values:

```text
PERX_DATA_MODE
DATABASE_URL
DIRECT_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SESSION_COOKIE_NAME
AUTH_SESSION_DAYS
NEXT_PUBLIC_APP_URL
UPLOAD_MAX_BYTES
LOG_LEVEL
PERX_ENABLE_PREVIEW
ERROR_MONITORING_DSN
```

Production expectations remain:

```text
PERX_DATA_MODE=database
PERX_ENABLE_PREVIEW=false
NEXT_PUBLIC_APP_URL=<actual deployed PerX URL, not localhost>
DATABASE_URL=<runtime pooled database URL>
DIRECT_URL=<server-only direct database URL for Prisma operations>
```

`DATABASE_URL` remains the runtime connection used by `src/lib/db/prisma.ts`. `DIRECT_URL` is not used to create the runtime Prisma pool.

## 5. Files modified

```text
.env.example
package.json
prisma/seed.ts
scripts/audit-route-inventory.mjs
src/app/(auth)/sign-in/page.tsx
src/app/(auth)/sign-up/page.tsx
src/app/(public)/categories/[slug]/page.tsx
src/app/(public)/opportunities/[slug]/page.tsx
src/app/(public)/u/[username]/page.tsx
src/app/page.tsx
src/components/auth/sign-in-form.tsx
src/components/auth/sign-up-form.tsx
src/features/auth/actions.ts
src/lib/auth/redirects.ts
src/lib/auth/session.ts
src/lib/data/opportunities.ts
src/lib/data/profiles.ts
src/lib/env.ts
src/lib/logging/runtime.ts
src/lib/validation/auth.ts
tests/e2e/auth-forms.spec.ts
tests/unit/auth-actions.test.ts
tests/unit/auth-redirects.test.ts
tests/unit/discovery-outage.test.ts
tests/unit/seed-safety.test.ts
```

## 6. Public-page resilience changes

Public provider resolution is now inside guarded helpers:

```text
getOpportunityFeedResult()
getPublicDiscoveryData()
getOpportunityBySlugResult()
getCategoriesResult()
getPublicProfileResult()
```

Optional public sections now render truthful fallbacks:

```text
This section is temporarily unavailable.
Please try again shortly.
```

No mock fixture fallback is introduced in database mode. Forbidden production mock-mode errors are rethrown and remain fatal.

Safe server logs now use `logServerDataError()` and include route, operation, error type, Prisma code and set/missing environment status only. Database URLs, cookies, tokens and keys are not logged.

## 7. Account-creation changes

The initial signup flow now collects:

```text
Full name
Username
Email address
Password
Confirm password
Terms acceptance
```

It does not ask for permanent identity choices such as Founder, Investor, Freelancer, Client, Worker or Business.

Server action behavior:

```text
Normalize email and username.
Validate password requirements and confirmation.
Return field-level duplicate email/username messages.
Return controlled database-unavailable messages.
Preserve non-secret valid fields after errors.
Create user, base profile, baseline roles and session row inside one Prisma transaction.
Set the HTTP-only session cookie after the transaction succeeds.
Redirect successful signup to /app/profile/setup.
```

Baseline roles are created through the existing authorization system and deliberately exclude `ADMIN`.

## 8. Onboarding changes

New users are redirected to:

```text
/app/profile/setup
```

The foundational onboarding remains focused on profile basics:

```text
Profile image URL
Display name
Username
Location
Professional headline
Website or portfolio
Short introduction
Skills
```

The existing “What would you like to do?” choices remain navigation actions, not security roles.

## 9. Normal test-account implementation

Normal test account variables:

```text
DEV_TEST_USER_EMAIL
DEV_TEST_USER_USERNAME
DEV_TEST_USER_PASSWORD
```

When explicitly enabled, the normal test account receives ordinary beta roles:

```text
FREELANCER
CLIENT
FOUNDER
```

It does not receive:

```text
ADMIN
admin:access
authorization bypasses
cross-user ownership bypasses
```

## 10. Admin test-account implementation

Admin test account variables:

```text
DEV_ADMIN_EMAIL
DEV_ADMIN_USERNAME
DEV_ADMIN_PASSWORD
```

When explicitly enabled, the admin test account receives the real database-backed `ADMIN` role through `UserRole`. No email-based bypass or fake client-side session was added.

## 11. Test-account safety guards

Optional account creation requires:

```text
PERX_ALLOW_DEV_SEED=true
```

Remote non-production seed targets must also provide:

```text
PERX_DEPLOY_ENV=development | staging | audit
PERX_SEED_DATABASE_LABEL=<human-verified non-production database label>
```

The seed remains:

```text
Disabled by default.
Idempotent.
Non-destructive.
Password-preserving for existing matching users.
Protected against username/email ownership conflicts.
Free of audit-log writes.
Free of hardcoded passwords.
Refusing production / Vercel production environments.
```

Safe command template:

```bash
PERX_ALLOW_DEV_SEED=true \
PERX_DEPLOY_ENV=development \
PERX_SEED_DATABASE_LABEL=local-dev \
DEV_TEST_USER_EMAIL=<normal-email> \
DEV_TEST_USER_USERNAME=<normal-username> \
DEV_TEST_USER_PASSWORD=<normal-password> \
DEV_ADMIN_EMAIL=<admin-email> \
DEV_ADMIN_USERNAME=<admin-username> \
DEV_ADMIN_PASSWORD=<admin-password> \
npx tsx prisma/seed.ts
```

This command was not run because no test-account variables were present and the configured database target was not positively identified as a safe seed target.

## 12. Route inventory

Generated with:

```bash
npm run route:inventory
```

Summary:

```text
PUBLIC: /, /discover, /sign-in, /sign-up, /how-it-works, /trust-safety, /privacy, /terms, /help, /about, /offline, /api/health, /categories/:slug, /opportunities/:slug, /u/:username
AUTHENTICATED: /app, /app/discover, /app/messages, /app/deals, /app/proposals/*, /app/roles, /app/settings, /dashboard, /market, /messages, /deals, /settings, and workspace aliases
OWNER_ONLY: /app/profile/edit, /app/profile/setup, /app/opportunities, /profile/edit, /profile/setup
PARTICIPANT_ONLY: /app/messages/:conversationId, /app/deals/:dealId, /app/deals/:dealId/*
ADMIN_ONLY: /admin and /admin/*
PREVIEW_DISABLED: /preview and /preview/*
COMING_LATER: saved, notifications and reviews placeholder routes
```

The full generated table is reproducible from the script.

## 13. Route-access matrix

| Route group | Public visitor | Normal test user | Admin test user | Failure behavior |
| --- | --- | --- | --- | --- |
| Public pages | Allowed | Allowed | Allowed | Section-level unavailable state for optional data |
| `/app/**` | Redirect to `/sign-in` | Allowed | Allowed | Auth/session failure denies access |
| Profile edit/setup | Redirect to `/sign-in` | Own profile only | Own profile only | Uses current session user ID |
| Opportunity owner pages | Redirect to `/sign-in` | Own listings only | Own listings only unless admin route | Owner ID filtered server-side |
| Messages detail | Redirect to `/sign-in` | Participant only | Participant only unless participant | Selected from current user conversations |
| Deals detail/actions | Redirect to `/sign-in` | Participant only | Participant only unless participant | `getDealForUser` and action participant checks |
| Delivery approval | Redirect to `/sign-in` | Correct client only | Correct client only unless participant client | Provider cannot approve own delivery |
| `/admin/**` | Redirect to `/sign-in` | Denied | Allowed with real `ADMIN` role | Capability check fails closed |
| `/preview/**` | 404 with preview disabled | 404 | 404 | `notFound()` from preview layout |

## 14. Sign-up test results

Covered by unit and e2e tests:

```text
Duplicate email -> field error.
Duplicate username -> field error.
Password mismatch -> inline field error.
Successful database signup -> transaction creates user/profile/baseline roles/session row and redirects to /app/profile/setup.
Password visibility toggle works.
Submit button disables while invalid/pending.
Required labels render on desktop and mobile.
```

## 15. Sign-in test results

Covered by unit and e2e tests:

```text
Invalid credentials -> generic invalid message.
Deactivated account -> deactivated message.
Successful login -> session creation and redirect to /app or safe callback.
External callback URLs are rejected.
Password visibility toggle works.
Existing authenticated user redirect is implemented with a safe internal callback.
```

## 16. Authorization test results

Verified locally:

```text
Public visitor redirected away from /app.
Public visitor redirected away from /admin.
Normal roles do not grant admin:access.
ADMIN role grants admin:access through the normal capability system.
Provider/freelancer cannot approve their own delivery.
Unrelated users cannot approve a deal.
Invalid deal status cannot be approved.
Duplicate release approval is rejected.
Preview routes return 404 when PERX_ENABLE_PREVIEW=false.
```

Blocked without live seeded database sessions:

```text
Normal Test User A vs Normal Test User B profile edit attempts.
User C reading/writing A/B messages.
User C accessing A/B deal.
Users modifying listings they do not own.
Admin test user browser session across all /admin/* routes.
```

These require the guarded seed command to be run against a verified non-production database.

## 17. Production-build results

Final local results:

```text
npm run lint -> PASS, 0 errors, 5 existing warnings.
npm run type-check -> PASS.
npm run test -> PASS, 15 files, 69 tests.
npm run test:e2e -> PASS, 18 tests.
npx prisma validate -> PASS.
npx prisma generate -> PASS.
npm run build -> PASS.
npx next build --debug-prerender -> PASS.
npx cross-env NODE_ENV=production PERX_DATA_MODE=mock npm run build -> FAILED AS EXPECTED with "PERX_DATA_MODE=mock is strictly prohibited in production."
```

Final local production server probe:

```text
/ -> 200, no Content Unavailable, no Server Components render text
/api/health -> 200, no Content Unavailable, no Server Components render text
/discover -> 200, no Content Unavailable, no Server Components render text
/sign-up -> 200, no Content Unavailable, no Server Components render text
/sign-in -> 200, no Content Unavailable, no Server Components render text
/preview -> 404, no Content Unavailable, no Server Components render text
```

## 18. E2E results

Final Playwright result:

```text
18 passed
```

Notes:

```text
The prior run showed transient mobile network/timeouts during local dev-server startup and passed on retry.
The final run passed without failures.
```

## 19. Remaining blocked checks

Blocked by missing Vercel access from this workspace:

```text
Exact deployed Vercel error digest.
Exact deployed stack trace.
Confirming deployment used the latest commit.
Confirming Vercel environment variable assignment.
Confirming a new deployment occurred after env changes.
Opening Vercel Runtime Logs.
Verifying deployed /, /api/health, /discover, /sign-up and /sign-in after deployment.
Confirming production runtime logs contain no unhandled Server Component error.
```

Blocked by absent test-account env variables and unidentified database target:

```text
Actually creating Normal Test User A/B/C and Admin Test User.
Browser-session route matrix with seeded normal/admin accounts.
Cross-user database-backed ownership and participant checks in a live environment.
```

## 20. Final deployment status

Local code/build/runtime verification passed.

Deployment repair is not yet confirmed because the workspace has no Vercel CLI/project linkage or runtime-log access. The owner must push/deploy this code, ensure Vercel env vars are configured for the correct environment, then verify runtime logs and the deployed public/auth routes.
