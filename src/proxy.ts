import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { usesSupabaseAuth } from "@/lib/auth/provider";
import { refreshSupabaseSession } from "@/lib/auth/supabase-proxy";

const securityHeaders = {
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

export async function proxy(request: NextRequest) {
  const response = usesSupabaseAuth()
    ? await refreshSupabaseSession(request)
    : NextResponse.next();

  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }

  if (request.headers.has("x-middleware-subrequest")) {
    response.headers.set("x-ptahx-blocked-header", "x-middleware-subrequest");
  }

  const { pathname } = request.nextUrl;
  const isProtectedPage = pathname.startsWith("/app");

  const cookieName = process.env.SESSION_COOKIE_NAME || "ptahx_session";
  const sessionCookie = request.cookies.get(cookieName);

  if (!sessionCookie && isProtectedPage) {
    const returnTo = encodeURIComponent(pathname);
    const denied = NextResponse.redirect(
      new URL(`/sign-in?next=${returnTo}`, request.url),
    );
    for (const cookie of response.cookies.getAll()) denied.cookies.set(cookie);
    for (const [key, value] of response.headers)
      if (!key.startsWith("x-middleware")) denied.headers.set(key, value);
    denied.headers.set("Cache-Control", "private, no-store");
    return denied;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
