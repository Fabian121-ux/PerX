import { NextResponse } from "next/server";

import { getMigrationDrift } from "@/lib/db/migration-drift";
import { getPrisma } from "@/lib/db/prisma";
import { hasDatabaseUrl, getResolvedDataMode } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Coarse schema status for the PUBLIC health payload.
 *
 * This route has no middleware and no auth gate, so it must report THAT drift
 * exists without disclosing anything about it. Migration names are deployment
 * fingerprints; so are counts. Both stay behind `/admin/schema`.
 *
 * `indeterminate` maps to "unknown", not "drifted": a probe that could not run
 * is not evidence of drift, and paging an operator for it would train them to
 * ignore the alert.
 */
function schemaStatus(
  state: Awaited<ReturnType<typeof getMigrationDrift>>["state"],
): "current" | "drifted" | "unknown" {
  if (state === "current") return "current";
  if (state === "pending" || state === "unknown-applied") return "drifted";
  return "unknown";
}

export async function GET() {
  try {
    const mode = getResolvedDataMode();
    if (mode === "mock") {
      return NextResponse.json({ status: "ok", database: "connected" }, { status: 200 });
    }

    if (!hasDatabaseUrl()) {
      return NextResponse.json({ status: "degraded", database: "unavailable" }, { status: 503 });
    }

    await getPrisma().$queryRaw`SELECT 1`;

    /*
     * A connected database is not a healthy one. In September this route
     * returned 200 for 15 days while the schema was behind the code it was
     * serving, because "can I reach Postgres" was the only question asked.
     *
     * The probe is guarded: a failure in the drift check must never degrade a
     * deployment that is actually fine.
     */
    let schema: "current" | "drifted" | "unknown" = "unknown";
    try {
      schema = schemaStatus((await getMigrationDrift()).state);
    } catch {
      schema = "unknown";
    }

    if (schema === "drifted") {
      // 503 is deliberate: a deployment whose schema is behind its code is
      // genuinely degraded, and 503 is what an uptime monitor alerts on. A 200
      // carrying a field nobody configured an alert for is how this was missed.
      return NextResponse.json(
        { status: "degraded", database: "connected", schema },
        { status: 503 },
      );
    }

    return NextResponse.json({ status: "ok", database: "connected", schema }, { status: 200 });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json({ status: "degraded", database: "unavailable" }, { status: 503 });
  }
}
