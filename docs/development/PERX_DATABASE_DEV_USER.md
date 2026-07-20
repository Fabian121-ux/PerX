# Database Development User

When testing PerX in `database` mode (`PERX_DATA_MODE=database`), public "Test Account" buttons and "Demo Preview" pathways are strictly disabled. The system requires real authentication flow and database validation.

To test the application locally in database mode, you must seed a **development test user**.

## 1. Configure the Dev User

Open your local `.env` file and define the development user credentials:

```env
PERX_ALLOW_DEV_SEED=true
PERX_DEPLOY_ENV=development
DEV_TEST_USER_EMAIL="devtest@perx.local"
DEV_TEST_USER_USERNAME="devtest"
DEV_TEST_USER_PASSWORD="a-secure-local-password"
```

*Note: Never commit real passwords to the repository.*

## 2. Seed the Database

Run the Prisma seed command to generate the user and sample opportunities:

```bash
npm run db:seed
```

This script will safely upsert the development user with the specified credentials, classify the account as `INTERNAL_TEST_USER`, and explicitly grant non-admin testing roles (`MEMBER`, `FREELANCER`, `CLIENT`, `FOUNDER`).

**Important:** The standard seed script *never* grants the `ADMIN` role to this user for safety reasons.

## 3. Sign In

Start your database server:

```bash
npm run dev:database
```

Visit `/sign-in` in your browser and enter the credentials you defined in your `.env`. You will be authenticated as a verified user and redirected to the `/dashboard`.

---

## Optional: Admin Seed Policy

If you need to test the `/admin` dashboard locally, you must explicitly configure a separate admin user.

Add the following to your `.env`:

```env
PERX_ALLOW_DEV_SEED=true
PERX_DEPLOY_ENV=development
DEV_ADMIN_EMAIL="admin@perx.local"
DEV_ADMIN_USERNAME="admin"
DEV_ADMIN_PASSWORD="a-secure-admin-password"
```

Re-run the seed script. The user is classified as `INTERNAL_ADMIN`, and the `ADMIN` role is assigned through the normal database-backed `UserRole` relationship. Normal dev test users will be blocked from accessing `/admin` routes.

For remote non-production databases, also set `PERX_SEED_DATABASE_LABEL` to a human-confirmed development or staging database label before running the seed. Never run development seeding in Vercel Production.
