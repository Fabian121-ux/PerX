import { NextResponse } from "next/server";

import { getPrisma } from "@/lib/db/prisma";
import { hasDatabaseUrl, getResolvedDataMode } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const mode = getResolvedDataMode();
  if (mode === "mock") {
    return NextResponse.json({
      database: "mock",
      ok: true,
      service: "perX",
      status: "healthy",
    });
  }

  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      database: "not_configured",
      ok: true,
      service: "perX",
      status: "degraded",
    });
  }

  try {
    await getPrisma().$queryRaw`SELECT 1`;
    return NextResponse.json({ database: "ok", ok: true, service: "perX", status: "healthy" });
  } catch {
    return NextResponse.json({ database: "error", ok: false, service: "perX", status: "unhealthy" }, { status: 503 });
  }
}
