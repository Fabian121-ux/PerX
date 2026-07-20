import { NextResponse } from "next/server";

import { getSafeRegistrationStatus } from "@/lib/registration/status";

export async function GET() {
  const status = await getSafeRegistrationStatus("/api/registration/status");
  return NextResponse.json(status);
}
