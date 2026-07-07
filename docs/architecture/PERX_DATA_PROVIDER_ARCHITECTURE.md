# PerX Data Provider Architecture

## Motivation

Historically, PerX components and server actions called `getPrisma()` directly. This created tight coupling to the database, preventing local development when PostgreSQL was inaccessible and complicating testing.

The Data Provider Architecture introduces a layer of abstraction between the application logic and the data source.

## Interface (`src/lib/data/providers/interfaces.ts`)

The `PerXDataProvider` defines the required data interactions for the application, grouped by domain:
- `opportunities`: Finding, filtering, and managing opportunities.
- `app`: Dashboard metrics, proposals, deals, and conversations.
- `profiles`: User profiles and trust score details.
- `admin`: Platform statistics and lists.

## Implementations

### Prisma Provider
Located in `src/lib/data/providers/prisma-provider.ts`, this implementation executes the actual Prisma queries against the PostgreSQL database.

### Mock Provider
Located in `src/lib/data/providers/mock-provider.ts`, this implementation simulates the database using process-local arrays. It allows for mock writes to test application workflows without persisting data.

## Provider Resolution

The factory function `getPerXDataProvider()` in `src/lib/data/provider.ts` is responsible for selecting the correct implementation based on the `PERX_DATA_MODE` environment variable.

Crucially, it uses **dynamic imports** (`import("./providers/prisma-provider")`) to ensure the Prisma client is never parsed, evaluated, or loaded into memory when running in `mock` mode.

## Usage

Server actions and data fetching utilities must use the provider instead of `getPrisma()`:

```ts
import { getPerXDataProvider } from "@/lib/data/provider";

export async function fetchUserDashboard(userId: string) {
  const provider = await getPerXDataProvider();
  return provider.app.getDashboardMetrics(userId);
}
```
