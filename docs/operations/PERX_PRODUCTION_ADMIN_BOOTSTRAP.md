# PerX Production Admin Bootstrap

This document describes how to safely bootstrap the first real Production Administrator on the live platform.

## Why this exists
For security, the live Production platform does not allow standard signup flows to grant administrative privileges. Instead of relying on a development seed script (which contains mock data), this dedicated bootstrap script must be run once manually against the production database to create or promote the first administrator.

## Operations Sequence (CRITICAL)

To bootstrap the production environment, the following sequence is strictly enforced to prevent data anomalies. Never run this script unless Supabase is reachable and migrations are up to date.

1. Fix Supabase connectivity (if applicable).
2. Apply migration `0002_open_beta_registration`.
3. Redeploy PerX.
4. Confirm `/api/health` is healthy.
5. Confirm open-beta registration is enabled.
6. Register the intended owner/admin account normally through the UI (preferred route).
7. Run guarded Production promotion script (`npm run admin:bootstrap`).
8. Sign in again (existing sessions are revoked upon promotion).
9. Verify live `/admin` access.
10. Verify normal user is denied.
11. Remove bootstrap variables from your environment.

## Requirements

You must run this command locally (or from a secure ops environment) using the live Production database connection. It should NEVER be run automatically on Vercel deployments or build steps.

Required variables:
- `PERX_ALLOW_PRODUCTION_ADMIN_BOOTSTRAP=true`
- `PERX_ADMIN_BOOTSTRAP_CONFIRM=CREATE_PERX_PRODUCTION_ADMIN`
- `PERX_DEPLOY_ENV=production`
- `PERX_DATABASE_LABEL=perx-production`
- `PERX_PRODUCTION_DATABASE_FINGERPRINT=<owner-confirmed safe fingerprint>`
- `PERX_ADMIN_BOOTSTRAP_MODE=promote_existing` (default) or `create_new`
- `PERX_ADMIN_EMAIL`
- `PERX_ADMIN_USERNAME`
- `PERX_ADMIN_FULL_NAME`

If using `create_new` mode, you must also provide:
- `PERX_ADMIN_CREATE_CONFIRM=I_CONFIRM_NEW_PRODUCTION_ADMIN_CREATION`
*Note: The password is NOT passed via environment variables for `create_new` mode. You will be prompted securely in the terminal to enter a masked password.*

## How to promote an existing account (Recommended)
By default, the script runs in `promote_existing` mode. If the email specified in `PERX_ADMIN_EMAIL` already exists as a `PUBLIC_BETA_USER`, the script will seamlessly promote the account.
- It changes the `accountClassification` to `INTERNAL_ADMIN`.
- It attaches the `ADMIN` role.
- It does NOT overwrite the existing password.
- It revokes existing sessions so a fresh sign-in is required.

Run the command:
```bash
npm run admin:bootstrap
```

## How to create a new live Production administrator
If you explicitly need to bypass the public signup flow, use `PERX_ADMIN_BOOTSTRAP_MODE=create_new` along with `PERX_ADMIN_CREATE_CONFIRM=I_CONFIRM_NEW_PRODUCTION_ADMIN_CREATION`.
Run the command:
```bash
npm run admin:bootstrap
```
The terminal will prompt you to enter the new password securely.

## How to verify the ADMIN role
Check the database to ensure the `User` has `accountClassification: "INTERNAL_ADMIN"` and an associated `UserRole` linked to the `ADMIN` role.

## How to test live `/admin` access
1. Sign in normally through the deployed `/sign-in` page using the promoted or created account.
2. Navigate to `/admin`.
3. You should see the admin dashboard.

## How to remove bootstrap variables afterward
After successful execution, safely remove the `PERX_ADMIN_*` variables from your environment file. 
Removing the environment variables will **not** deactivate the administrator, since the role and classification are persisted safely in the database.

## How to recover access safely
If the password is lost, use the standard password recovery flow or re-run the bootstrap script with a new password if the account was manually deleted.

## How to disable an administrator
Manually update the database to set the administrator's `isActive` flag to `false`, or change their `accountClassification` and remove the `ADMIN` role.

## How to create a second administrator deliberately
Run the script again in `create_new` mode with a different `PERX_ADMIN_EMAIL` and `PERX_ADMIN_USERNAME`, or have them register normally and run `promote_existing`.

## How to review admin audit records
All bootstrap actions create an `AuditLog` entry in the database where `action = "admin.bootstrap"`. You can query this table to review when and who bootstrapped the system. These records use deterministic creation (idempotency) so they aren't duplicated upon script re-runs.
