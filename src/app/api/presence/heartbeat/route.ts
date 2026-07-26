import { NextResponse } from "next/server";

import { touchCurrentSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST() {
  const touched = await touchCurrentSession();
  return NextResponse.json({ status: touched ? "ok" : "ignored" });
}
