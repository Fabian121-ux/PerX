import { NextResponse } from "next/server";

import { getPrisma } from "@/lib/db/prisma";
import { hasDatabaseUrl, getResolvedDataMode } from "@/lib/env";

export const dynamic = "force-dynamic";

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
    return NextResponse.json({ status: "ok", database: "connected" }, { status: 200 });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json({ status: "degraded", database: "unavailable" }, { status: 503 });
  }
}
