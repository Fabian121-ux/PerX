# Deployment

## Required Environment

- `DATABASE_URL`
- `SESSION_COOKIE_NAME`
- `AUTH_SESSION_DAYS`
- `NEXT_PUBLIC_APP_URL`
- `UPLOAD_MAX_BYTES`
- `ERROR_MONITORING_DSN`
- `DEMO_MODE_ENABLED` defaults to disabled unless explicitly set to `true`

## Setup

1. Provision PostgreSQL.
2. Set environment variables from `.env.example`.
3. Run `npm ci`.
4. Run `npm run db:generate`.
5. Run `npm run db:migrate`.
6. Run `npm run db:seed` for initial demo/admin data if appropriate.
7. Run `npm run build`.
8. Start with `npm run start`.

## Demo Preview

Demo Preview is intended for review and staging environments. It is disabled by default and must not be enabled in production unless deliberately approved.

1. Set `DEMO_MODE_ENABLED=true` only in the review environment.
2. Run `npm run db:seed-demo` to reset and recreate fictional demo accounts and connected demo data.
3. Use the `Enter Demo Preview` button on `/sign-in`.
4. Use `Exit Demo` in the authenticated shell to clear the server-side session.

The seed command creates fictional users only under the `@demo.prex.local` email domain. It resets demo opportunities, conversations, proposals, deals, milestones, simulated escrow ledger entries, reviews, notifications and trust signals before recreating them.

Demo accounts cannot change passwords, email addresses, roles, uploads, destructive deletes or destructive moderation actions. Demo login is rate-limited and logged without sensitive credentials.

## Health Check

Use `/api/health`. It returns degraded status when `DATABASE_URL` is absent and unhealthy if the database query fails.

## Backups and Migrations

- Take a database backup before every production migration.
- Run migrations in deployment, not from application request handlers.
- Keep the Prisma schema, generated migration files, and deployment release aligned.
- Test restore procedures with a staging database before relying on backups.

## Monitoring

`ERROR_MONITORING_DSN` is reserved as the integration point for an error monitoring provider. Do not log secrets, session tokens, private messages, or sensitive deal data.
