# PerX Open Beta Registration Operations

Date: 2026-07-20

## Required Vercel Variables

Configure these in Vercel -> Project -> Settings -> Environment Variables for the intended Preview and Production environments:

```text
PERX_DATA_MODE
PERX_SIGNUP_MODE
PERX_BETA_MAX_USERS
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
```

Optional server-only/internal variables:

```text
ERROR_MONITORING_DSN
PERX_ALLOW_DEV_SEED
PERX_DEPLOY_ENV
PERX_SEED_DATABASE_LABEL
DEV_TEST_USER_EMAIL
DEV_TEST_USER_USERNAME
DEV_TEST_USER_PASSWORD
DEV_ADMIN_EMAIL
DEV_ADMIN_USERNAME
DEV_ADMIN_PASSWORD
```

Do not place database URLs, passwords, session tokens or private keys in public/client variables.

## Registration Modes

Close registration immediately:

```text
PERX_SIGNUP_MODE=closed
```

Enable controlled open beta with the initial ten-user cap:

```text
PERX_SIGNUP_MODE=open_beta
PERX_BETA_MAX_USERS=10
```

Increase the cap without deleting existing users:

```text
PERX_SIGNUP_MODE=open_beta
PERX_BETA_MAX_USERS=25
```

Switch to uncapped public registration only when intentionally approved:

```text
PERX_SIGNUP_MODE=public
```

Missing `PERX_SIGNUP_MODE` defaults safely to `closed`. `open_beta` requires a positive `PERX_BETA_MAX_USERS`. Do not add invitation codes or approved-email allowlists.

## Deployment Steps

1. Set or update Vercel environment variables for the target environment.
2. Apply database migrations with the existing deploy-safe migration command:

```bash
npm run db:migrate
```

3. Generate the Prisma client if needed:

```bash
npx prisma generate
```

4. Trigger a fresh Vercel deployment after environment changes.
5. Confirm the active Production alias points to the latest successful deployment.

Do not run destructive migration reset commands for beta activation.

## Runtime Verification

Check the health route:

```text
GET /api/health
```

Check registration status:

```text
GET /api/registration/status
```

Expected open-beta example:

```json
{
  "mode": "open_beta",
  "registrationOpen": true,
  "maximumUsers": 10,
  "remainingPlaces": 4
}
```

Expected public example:

```json
{
  "mode": "public",
  "registrationOpen": true,
  "maximumUsers": null,
  "remainingPlaces": null
}
```

The status endpoint is informational only. Server-side signup enforcement still happens inside the transaction.

## User Registration

Users register through `/sign-up` with:

```text
Full name
Username
Email address
Password
Confirm password
Terms acceptance
```

Successful registration creates the user, base profile, minimal membership role and session row in one transaction. The HTTP-only session cookie is set only after the transaction succeeds. New users are redirected to `/app/profile/setup`.

## Counting Beta Users Safely

Count only ordinary public beta users:

```sql
SELECT COUNT(*)
FROM "User" u
WHERE u."accountClassification" = 'PUBLIC_BETA_USER'
AND NOT EXISTS (
  SELECT 1
  FROM "UserRole" ur
  JOIN "Role" r ON r.id = ur."roleId"
  WHERE ur."userId" = u.id
  AND r.name = 'ADMIN'
);
```

Do not count `INTERNAL_TEST_USER`, `INTERNAL_ADMIN` or `SYSTEM_ACCOUNT` users toward `PERX_BETA_MAX_USERS`.

## Inspecting Registration Failures

Use Vercel Runtime Logs and search for:

```text
[perx:server-data-error]
auth.sign_up
registration.status
```

Logs are designed to include route, operation, error type, Prisma code and set/missing environment status only. They must not include secrets, cookies, raw database URLs, passwords or private form contents.

## Internal Test Accounts

Internal accounts are never created automatically during build or deployment. They require:

```text
PERX_ALLOW_DEV_SEED=true
PERX_DEPLOY_ENV=development
PERX_SEED_DATABASE_LABEL=<human-confirmed non-production label>
```

or:

```text
PERX_ALLOW_DEV_SEED=true
PERX_DEPLOY_ENV=staging
PERX_SEED_DATABASE_LABEL=<human-confirmed non-production label>
```

Only the normal test user:

```bash
PERX_ALLOW_DEV_SEED=true \
PERX_DEPLOY_ENV=staging \
PERX_SEED_DATABASE_LABEL=perx-beta-staging \
DEV_TEST_USER_EMAIL=<test-email> \
DEV_TEST_USER_USERNAME=<test-username> \
DEV_TEST_USER_PASSWORD=<test-password> \
npx tsx prisma/seed.ts
```

Only the admin user:

```bash
PERX_ALLOW_DEV_SEED=true \
PERX_DEPLOY_ENV=staging \
PERX_SEED_DATABASE_LABEL=perx-beta-staging \
DEV_ADMIN_EMAIL=<admin-email> \
DEV_ADMIN_USERNAME=<admin-username> \
DEV_ADMIN_PASSWORD=<admin-password> \
npx tsx prisma/seed.ts
```

Both internal accounts:

```bash
PERX_ALLOW_DEV_SEED=true \
PERX_DEPLOY_ENV=staging \
PERX_SEED_DATABASE_LABEL=perx-beta-staging \
DEV_TEST_USER_EMAIL=<test-email> \
DEV_TEST_USER_USERNAME=<test-username> \
DEV_TEST_USER_PASSWORD=<test-password> \
DEV_ADMIN_EMAIL=<admin-email> \
DEV_ADMIN_USERNAME=<admin-username> \
DEV_ADMIN_PASSWORD=<admin-password> \
npx tsx prisma/seed.ts
```

The normal test user receives non-admin roles through the database-backed role system. The development admin receives the real `ADMIN` role through `UserRole`. There is no email-based admin bypass.

## Admin Separation Test

After seeding a confirmed non-production database:

1. Sign in as the normal test user.
2. Verify ordinary protected routes such as `/app`, `/app/profile/setup`, `/app/messages`, `/app/deals` and `/app/settings`.
3. Verify `/admin` and every `/admin/**` route deny the normal test user.
4. Sign out.
5. Sign in as the development admin.
6. Verify `/admin`, `/admin/users`, `/admin/profiles`, `/admin/opportunities`, `/admin/reports`, `/admin/reviews`, `/admin/disputes`, `/admin/verification`, `/admin/audit-logs`, `/admin/activity` and `/admin/moderation`.

Record each route as `PASS`, `FAIL` or `BLOCKED`.

## Exporting Users Safely

Export only non-secret account fields needed for operations:

```sql
SELECT
  id,
  email,
  username,
  name,
  "accountClassification",
  "verificationStatus",
  "isActive",
  "createdAt"
FROM "User"
ORDER BY "createdAt" DESC;
```

Do not export `passwordHash`, session tokens, cookies or private message content.
