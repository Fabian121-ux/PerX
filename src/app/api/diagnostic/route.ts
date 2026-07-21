import { NextResponse } from "next/server";
import { Pool } from "pg";

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
    } catch (e) {
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
    } catch (e: any) {
      dbError = {
        name: e.name,
        message: e.message,
        code: e.code
      };
    }
  }
  
  return NextResponse.json({ info, dbSuccess, dbError });
}
