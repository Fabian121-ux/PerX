# PerX Local Mock Mode

## Overview

The `PERX_DATA_MODE` environment variable controls whether the PerX application runs using real database connections or in-memory mock data. This enables local development, UI prototyping, and testing even when a PostgreSQL instance is unavailable or difficult to provision.

## Modes

- `mock`: Forces the application to use the in-memory mock provider. Prisma is completely isolated and never instantiated. `DATABASE_URL` is not required.
- `database`: Forces the application to use the PostgreSQL database via Prisma. If `DATABASE_URL` is missing or invalid, the application fails fast.
- `auto` (Default): Attempts to use the database provider. If `DATABASE_URL` is absent, it gracefully falls back to the mock provider with a console warning.

## Running in Mock Mode

Use the designated `package.json` scripts to run the application in mock mode:

```bash
# Run the development server in mock mode
npm run dev:mock

# Build the production application in mock mode
npm run build:mock
```

## How It Works

When `PERX_DATA_MODE` resolves to `mock`:

1.  **Provider Resolution**: `src/lib/data/provider.ts` returns the `mockProvider`.
2.  **Prisma Isolation**: `src/lib/db/prisma.ts` throws a strict runtime error if any code attempts to invoke `getPrisma()`.
3.  **UI Feedback**: A visual indicator ("Local Mock Data") appears at the bottom of the screen to prevent confusion regarding data persistence.
4.  **Mock Writes**: In-memory arrays (like `dealsStore`, `proposalsStore`) accept writes during the application process lifecycle, allowing you to test complete workflows (e.g., sending a proposal). These resets upon server restart.

## Adding Mock Data

Mock data is seeded from `src/lib/data/mock/preview.ts` and `src/lib/data/mock/demo.ts`. To add new scenarios, update the arrays in these files.
