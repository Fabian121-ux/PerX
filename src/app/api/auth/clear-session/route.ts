import { destroySession } from "@/lib/auth/session";
import { NextResponse, type NextRequest } from "next/server";
import { getSafeAuthRedirect } from "@/lib/auth/redirects";

function getRedirectPath(value: FormDataEntryValue | string | null) {
  const nextPath = getSafeAuthRedirect(value, "/app");
  return `/sign-in?returnTo=${encodeURIComponent(nextPath)}`;
}

function redirectToSignIn(request: NextRequest, next: FormDataEntryValue | string | null) {
  return NextResponse.redirect(new URL(getRedirectPath(next), request.url), 303);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nextParam = searchParams.get("next") || searchParams.get("returnTo");

  // Safe recovery navigation for stale sessions. GET must never revoke a
  // valid session; successful sign-in replaces an expired session cookie.
  return redirectToSignIn(request, nextParam);
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form" }, { status: 400 });
  }
  const nextParam = formData.get("next") ?? formData.get("returnTo") ?? "/app";

  await destroySession();

  return redirectToSignIn(request, nextParam);
}
