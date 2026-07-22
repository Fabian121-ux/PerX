import { redirect } from "next/navigation";
import { destroySession } from "@/lib/auth/session";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nextParam = searchParams.get("next") || "/app";

  await destroySession();
  
  redirect(`/sign-in?returnTo=${encodeURIComponent(nextParam)}`);
}
