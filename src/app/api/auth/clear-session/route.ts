import { redirect } from "next/navigation";
import { destroySession } from "@/lib/auth/session";
import type { NextRequest } from "next/server";
import { getSafeAuthRedirect } from "@/lib/auth/redirects";

function getRedirectPath(value: FormDataEntryValue | string | null) {
  const nextPath = getSafeAuthRedirect(value, "/app");
  return `/sign-in?returnTo=${encodeURIComponent(nextPath)}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nextParam = searchParams.get("next") || searchParams.get("returnTo");

  await destroySession();

  redirect(getRedirectPath(nextParam));
}

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  const nextParam = formData?.get("next") ?? formData?.get("returnTo") ?? "/app";

  await destroySession();

  redirect(getRedirectPath(nextParam));
}
