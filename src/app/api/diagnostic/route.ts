import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getPrisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.DATABASE_URL || "";
  let info = {};
  
  if (url) {
    try {
      const parsed = new URL(url);
      info = {
        present: true,
        protocol: parsed.protocol,
        host: parsed.hostname,
        port: parsed.port,
        hasPassword: !!parsed.password,
        path: parsed.pathname,
        pgbouncer: parsed.searchParams.get("pgbouncer")
      };
    } catch {
      info = { error: "URL parse failed" };
    }
  }

  let dbError = null;
  let dbSuccess = false;
  if (url) {
    try {
      const pool = new Pool({ connectionString: url });
      await pool.query("SELECT 1");
      await pool.end();
      dbSuccess = true;
    } catch (e: unknown) {
      const err = e as Error & { code?: string };
      dbError = {
        name: err.name,
        message: err.message,
        code: err.code
      };
    }
  }

  let prismaError = null;
  let prismaSuccess = false;
  try {
    const prisma = getPrisma();
    await prisma.$queryRaw`SELECT 1`;
    prismaSuccess = true;
  } catch (e: unknown) {
    const err = e as Error & { code?: string };
    prismaError = {
      name: err.name,
      message: err.message,
      code: err.code
    };
  }
  
  return NextResponse.json({ info, dbSuccess, dbError, prismaSuccess, prismaError });
}
