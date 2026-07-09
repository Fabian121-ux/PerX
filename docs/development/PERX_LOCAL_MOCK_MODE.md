# PerX Local Mock Mode

## Overview

PerX supports a **local mock mode** designed for rapid UI prototyping, offline development, and completely static deployments.

In mock mode, the application runs entirely without a database. It bypasses Prisma initialization and instead relies on static data generators defined in `src/lib/data/providers/mock-provider.ts`.

## Configuration

Mock mode is enabled via the environment variable `PERX_DATA_MODE`.

```env
PERX_DATA_MODE=mock
```

To run a development server in mock mode without requiring `DATABASE_URL`, use the built-in script:

```bash
npm run dev:mock
```

To build a fully static version of the application using mock data:

```bash
npm run build:mock
```

## Key Differences from Database Mode

| Feature | Mock Mode | Database Mode |
|---------|-----------|---------------|
| **Data Source** | Hardcoded static generators. | PostgreSQL / Prisma. |
| **Authentication** | Simulated via a local test session. | Real JWT / Database-backed sessions. |
| **State Persistence** | Session-only (resets on reload). | Persistent in the database. |
| **DATABASE_URL** | Ignored and not required. | Strictly required and validated. |

## Why Demo/Test Buttons Were Removed

Previously, PerX exposed "Test Account" and "Demo Preview" buttons directly on the public landing and sign-in pages. While useful for early prototypes, this bypassed authentication entirely and created a severe security vulnerability in production (Database Mode).

Now, test features are correctly isolated.

* **Database Mode**: Demands real credentials and standard sign-in workflows.
* **Mock Mode**: Automatically simulates the test session under the hood but does not expose it as a public "skip login" button. 
* **Preview Routes**: Are explicitly gated behind `PERX_ENABLE_PREVIEW=true` to prevent unauthorized discovery.
